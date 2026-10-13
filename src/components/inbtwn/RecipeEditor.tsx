import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import {
  Field,
  TextInput,
  SelectInput,
  TextArea,
  PrimaryButton,
  GhostButton,
  StickyActions,
  SectionHeading,
  EmptyNote,
} from "@/components/inbtwn/bits";
import { IngredientForm } from "@/components/inbtwn/IngredientForm";
import { RECIPE_CATEGORIES, CUISINES } from "@/lib/constants";
import {
  graphQuery,
  ingredientsQuery,
  recipesQuery,
  type RecipeVersionRow,
  type RecipeRow,
} from "@/lib/recipe-queries";
import {
  BASE_UNITS,
  toBase,
  fromBase,
  unitsFor,
  fmtQty,
  type BaseUnit,
  type DisplayUnit,
} from "@/lib/units";

type IngLine = {
  key: string;
  ingredient_id: string;
  name: string;
  base: BaseUnit;
  qty: string;
  unit: DisplayUnit;
  prep_note: string;
};
type CompLine = {
  key: string;
  version_id: string;
  recipe_id: string;
  name: string;
  base: BaseUnit;
  qty: string;
  unit: DisplayUnit;
};

type IngredientPick = { id: string; name: string; base_unit: string };
type ComponentPick = { id: string; name: string; active_version_id: string | null; base: BaseUnit };

type IngredientDraft = {
  search: string;
  selected: IngredientPick | null;
  qty: string;
  unit: DisplayUnit;
  prep_note: string;
};

type ComponentDraft = {
  search: string;
  selected: ComponentPick | null;
  qty: string;
  unit: DisplayUnit;
};

const uid = () => Math.random().toString(36).slice(2);
const defaultUnitFor = (base: BaseUnit): DisplayUnit => base;

const emptyIngredientDraft = (): IngredientDraft => ({
  search: "",
  selected: null,
  qty: "",
  unit: "g",
  prep_note: "",
});

const emptyComponentDraft = (): ComponentDraft => ({
  search: "",
  selected: null,
  qty: "",
  unit: "g",
});

export function RecipeEditor({
  recipe,
  version,
  onSaved,
}: {
  recipe?: RecipeRow | null;
  version?: RecipeVersionRow | null;
  onSaved: (recipeId: string) => void;
}) {
  const qc = useQueryClient();
  const ingredients = useQuery(ingredientsQuery);
  const recipes = useQuery(recipesQuery);
  const graph = useQuery(graphQuery);
  const editing = !!recipe;

  const [name, setName] = useState(recipe?.name ?? "");
  const [category, setCategory] = useState(recipe?.category ?? "Main");
  const [cuisine, setCuisine] = useState(recipe?.cuisine ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");

  const yieldBase = (version?.base_yield_unit as BaseUnit) ?? "g";
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(yieldBase);
  const [yieldUnit, setYieldUnit] = useState<DisplayUnit>(
    yieldBase === "g" ? "kg" : yieldBase === "ml" ? "L" : "each",
  );
  const [yieldQty, setYieldQty] = useState(
    version
      ? String(fromBase(Number(version.base_yield_quantity), yieldBase === "g" ? "kg" : yieldBase === "ml" ? "L" : "each"))
      : "",
  );
  const [portion, setPortion] = useState(
    version?.default_portion_quantity != null ? String(version.default_portion_quantity) : "",
  );
  const [buffer, setBuffer] = useState(String(version?.default_buffer_percentage ?? 5));
  const presetStr = (v: number | null | undefined) => (v != null ? String(v) : "");
  const [presets, setPresets] = useState({
    small: presetStr(version?.portion_small),
    medium: presetStr(version?.portion_medium),
    large: presetStr(version?.portion_large),
  });
  const [method, setMethod] = useState(version?.method ?? "");
  const [changeNotes, setChangeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickIng, setPickIng] = useState(false);
  const [pickComp, setPickComp] = useState(false);
  const [newIng, setNewIng] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraft>(() => emptyIngredientDraft());
  const [componentDraft, setComponentDraft] = useState<ComponentDraft>(() => emptyComponentDraft());
  const savedScrollY = useRef<number | null>(null);

  const [ingLines, setIngLines] = useState<IngLine[]>([]);
  const [compLines, setCompLines] = useState<CompLine[]>([]);
  const [hydrated, setHydrated] = useState(!version);

  // Hydrate existing formulation once the graph is available.
  if (!hydrated && version && graph.data) {
    const v = graph.data.versions[version.id];
    if (v) {
      setIngLines(
        [...v.ingredients]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((ri) => {
            const ing = graph.data!.ingredients[ri.ingredient_id];
            const b = ing?.base_unit ?? "g";
            const display: DisplayUnit = b === "g" ? (ri.quantity >= 1000 ? "kg" : "g") : b === "ml" ? (ri.quantity >= 1000 ? "L" : "ml") : "each";
            return {
              key: uid(),
              ingredient_id: ri.ingredient_id,
              name: ing?.name ?? "Ingredient",
              base: b,
              qty: String(fromBase(ri.quantity, display)),
              unit: display,
              prep_note: ri.prep_note ?? "",
            };
          }),
      );
      setCompLines(
        [...v.components]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((rc) => {
            const child = graph.data!.versions[rc.child_recipe_version_id];
            const b = child?.base_yield_unit ?? "g";
            const display: DisplayUnit = b === "g" ? (rc.quantity >= 1000 ? "kg" : "g") : b === "ml" ? (rc.quantity >= 1000 ? "L" : "ml") : "each";
            return {
              key: uid(),
              version_id: rc.child_recipe_version_id,
              recipe_id: child?.recipe_id ?? "",
              name: child?.recipe_name ?? "Recipe",
              base: b,
              qty: String(fromBase(rc.quantity, display)),
              unit: display,
            };
          }),
      );
    }
    setHydrated(true);
  }

  const filteredIngredients = useMemo(() => {
    const t = ingredientDraft.search.trim().toLowerCase();
    return (ingredients.data ?? []).filter((i) => !t || i.name.toLowerCase().includes(t));
  }, [ingredients.data, ingredientDraft.search]);

  /** Recipes that may be used as a component without creating a cycle. */
  const componentCandidates = useMemo(() => {
    const g = graph.data;
    const list = (recipes.data ?? []).filter((r) => r.active_version_id && r.id !== recipe?.id);
    if (!g || !recipe) return list;
    const containsMe = (recipeId: string, seen: string[] = []): boolean => {
      if (seen.includes(recipeId)) return false;
      const vers = Object.values(g.versions).filter((v) => v.recipe_id === recipeId);
      for (const v of vers) {
        for (const c of v.components) {
          const child = g.versions[c.child_recipe_version_id];
          if (!child) continue;
          if (child.recipe_id === recipe.id) return true;
          if (containsMe(child.recipe_id, [...seen, recipeId])) return true;
        }
      }
      return false;
    };
    return list.filter((r) => !containsMe(r.id));
  }, [recipes.data, graph.data, recipe]);

  const filteredComponents = useMemo(() => {
    const t = componentDraft.search.trim().toLowerCase();
    return componentCandidates.filter((r) => !t || r.name.toLowerCase().includes(t));
  }, [componentCandidates, componentDraft.search]);

  const rememberScroll = () => {
    if (typeof window === "undefined") return;
    savedScrollY.current = window.scrollY;
  };

  const restoreScroll = () => {
    if (typeof window === "undefined") return;
    const y = savedScrollY.current;
    if (y === null) return;
    savedScrollY.current = null;
    window.requestAnimationFrame(() => window.scrollTo(0, y));
  };

  const openIngredientPicker = () => {
    rememberScroll();
    setIngredientDraft(emptyIngredientDraft());
    setPickIng(true);
  };

  const closeIngredientPicker = () => {
    setPickIng(false);
    setIngredientDraft(emptyIngredientDraft());
    restoreScroll();
  };

  const openComponentPicker = () => {
    rememberScroll();
    setComponentDraft(emptyComponentDraft());
    setPickComp(true);
  };

  const closeComponentPicker = () => {
    setPickComp(false);
    setComponentDraft(emptyComponentDraft());
    restoreScroll();
  };

  const selectIngredient = (i: IngredientPick) => {
    const b = i.base_unit as BaseUnit;
    setIngredientDraft((draft) => ({
      ...draft,
      selected: i,
      unit: defaultUnitFor(b),
    }));
  };

  const addIngredientDraft = (mode: "close" | "another") => {
    const selected = ingredientDraft.selected;
    if (!selected) return void toast.error("Choose an ingredient first");
    if (!(Number(ingredientDraft.qty) > 0)) return void toast.error("Enter a quantity");
    const b = selected.base_unit as BaseUnit;
    setIngLines((l) => [
      ...l,
      {
        key: uid(),
        ingredient_id: selected.id,
        name: selected.name,
        base: b,
        qty: ingredientDraft.qty,
        unit: ingredientDraft.unit,
        prep_note: ingredientDraft.prep_note,
      },
    ]);
    if (mode === "another") {
      setIngredientDraft(emptyIngredientDraft());
      return;
    }
    closeIngredientPicker();
  };

  const selectComponent = (r: ComponentPick) => {
    setComponentDraft((draft) => ({
      ...draft,
      selected: r,
      unit: defaultUnitFor(r.base),
    }));
  };

  const addComponentDraft = (mode: "close" | "another") => {
    const selected = componentDraft.selected;
    if (!selected || !selected.active_version_id) return void toast.error("Choose a sub-recipe first");
    if (!(Number(componentDraft.qty) > 0)) return void toast.error("Enter a quantity");
    const versionId = selected.active_version_id;
    setCompLines((l) => [
      ...l,
      {
        key: uid(),
        version_id: versionId,
        recipe_id: selected.id,
        name: selected.name,
        base: selected.base,
        qty: componentDraft.qty,
        unit: componentDraft.unit,
      },
    ]);
    if (mode === "another") {
      setComponentDraft(emptyComponentDraft());
      return;
    }
    closeComponentPicker();
  };

  const move = <T extends { key: string }>(arr: T[], idx: number, dir: -1 | 1): T[] => {
    const next = [...arr];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return arr;
    const a = next[idx]!;
    next[idx] = next[to]!;
    next[to] = a;
    return next;
  };

  const save = async (): Promise<void> => {
    const yq = Number(yieldQty);
    if (!name.trim()) return void toast.error("Give the recipe a name");
    if (!(yq > 0)) return void toast.error("Base yield must be greater than zero");
    if (Number(buffer) < 0) return void toast.error("Buffer cannot be negative");
    for (const [k, v] of Object.entries(presets))
      if (baseUnit === "each" && v !== "" && !(Number(v) > 0)) return void toast.error(`${k} portion must be greater than zero`);
    for (const l of ingLines) {
      if (!(Number(l.qty) > 0)) return void toast.error(`Enter a quantity for ${l.name}`);
    }
    for (const l of compLines) {
      if (!(Number(l.qty) > 0)) return void toast.error(`Enter a quantity for ${l.name}`);
    }
    setSaving(true);

    const meta = {
      name: name.trim(),
      category,
      cuisine: cuisine || null,
      description: description.trim() || null,
    };

    let recipeId = recipe?.id ?? "";
    if (editing) {
      const up = await supabase.from("recipes").update(meta).eq("id", recipeId);
      if (up.error) {
        setSaving(false);
        return void toast.error(up.error.message);
      }
    } else {
      const ins = await supabase.from("recipes").insert(meta).select("id").maybeSingle();
      if (ins.error || !ins.data) {
        setSaving(false);
        return void toast.error(ins.error?.message ?? "Could not create recipe");
      }
      recipeId = ins.data.id;
    }

    const existingVersions = await supabase
      .from("recipe_versions")
      .select("version_number")
      .eq("recipe_id", recipeId)
      .order("version_number", { ascending: false })
      .limit(1);
    const nextNumber = (existingVersions.data?.[0]?.version_number ?? 0) + 1;

    const vIns = await supabase
      .from("recipe_versions")
      .insert({
        recipe_id: recipeId,
        version_number: nextNumber,
        base_yield_quantity: toBase(yq, yieldUnit),
        base_yield_unit: baseUnit,
        default_portion_quantity: portion === "" ? null : Number(portion),
        default_portion_unit: portion === "" ? null : baseUnit,
        default_buffer_percentage: Number(buffer),
        portion_small: baseUnit === "each" && presets.small !== "" ? Number(presets.small) : null,
        portion_medium: baseUnit === "each" && presets.medium !== "" ? Number(presets.medium) : null,
        portion_large: baseUnit === "each" && presets.large !== "" ? Number(presets.large) : null,
        method: method.trim() || null,
        change_notes: changeNotes.trim() || (nextNumber === 1 ? "Initial version" : null),
      })
      .select("id")
      .maybeSingle();
    if (vIns.error || !vIns.data) {
      setSaving(false);
      return void toast.error(vIns.error?.message ?? "Could not save recipe version");
    }
    const versionId = vIns.data.id;

    if (ingLines.length) {
      const res = await supabase.from("recipe_ingredients").insert(
        ingLines.map((l, idx) => ({
          recipe_version_id: versionId,
          ingredient_id: l.ingredient_id,
          quantity: toBase(Number(l.qty), l.unit),
          unit: l.base,
          prep_note: l.prep_note.trim() || null,
          sort_order: idx,
        })),
      );
      if (res.error) {
        setSaving(false);
        return void toast.error(res.error.message);
      }
    }
    if (compLines.length) {
      const res = await supabase.from("recipe_components").insert(
        compLines.map((l, idx) => ({
          parent_recipe_version_id: versionId,
          child_recipe_version_id: l.version_id,
          quantity: toBase(Number(l.qty), l.unit),
          unit: l.base,
          sort_order: idx,
        })),
      );
      if (res.error) {
        setSaving(false);
        return void toast.error(
          res.error.message.includes("Circular") || res.error.message.includes("itself")
            ? res.error.message
            : res.error.message,
        );
      }
    }

    const act = await supabase.from("recipes").update({ active_version_id: versionId }).eq("id", recipeId);
    if (act.error) {
      setSaving(false);
      return void toast.error(act.error.message);
    }

    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["recipe-graph"] });
    qc.invalidateQueries({ queryKey: ["recipe-versions", recipeId] });
    qc.invalidateQueries({ queryKey: ["recipe-version-buffers"] });
    qc.invalidateQueries({ queryKey: ["event-menu"] });
    setSaving(false);
    toast.success(editing ? `Saved as v${nextNumber}` : "Recipe created (v1)");
    onSaved(recipeId);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <SectionHeading title="Basics" />
        <Field label="Recipe name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Butter Chicken" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cuisine">
            <SelectInput value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              <option value="">—</option>
              {CUISINES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" />
        </Field>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Yield" />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Measured in">
            <SelectInput
              value={baseUnit}
              onChange={(e) => {
                const b = e.target.value as BaseUnit;
                setBaseUnit(b);
                setYieldUnit(b === "g" ? "kg" : b === "ml" ? "L" : "each");
              }}
            >
              {BASE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Base yield" required>
            <TextInput type="number" inputMode="decimal" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} placeholder="5" />
          </Field>
          <Field label="Unit">
            <SelectInput value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value as DisplayUnit)}>
              {unitsFor(baseUnit).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Standard portion (${baseUnit})`}>
            <TextInput type="number" inputMode="decimal" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="150" />
          </Field>
          <Field label="Default buffer %">
            <TextInput type="number" inputMode="decimal" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
          </Field>
        </div>
        {baseUnit === "each" ? (
          <div>
            <div className="label-mono mb-1 text-ink-soft">Portions per guest (items)</div>
            <div className="grid grid-cols-3 gap-2">
              {(["small", "medium", "large"] as const).map((k) => (
                <Field key={k} label={{ small: "Small", medium: "Medium", large: "Large" }[k]}>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    step="0.05"
                    value={presets[k]}
                    onChange={(e) => setPresets({ ...presets, [k]: e.target.value })}
                    placeholder={portion !== "" ? String(Math.round(Number(portion) * { small: 0.5, medium: 0.75, large: 1 }[k] * 100) / 100) : "—"}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 font-mono text-[10px] text-ink-soft">
              Fractions allowed, e.g. 0.75 sandwiches. Blank uses the standard portion × 0.5 / 0.75 / 1.
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <SectionHeading
          title="Ingredients"
          action={
            <button type="button" onClick={openIngredientPicker} className="font-mono text-[12px] underline">
              + Add
            </button>
          }
        />
        <div className="space-y-2">
          {ingLines.length === 0 ? <EmptyNote>No ingredients yet.</EmptyNote> : null}
          {ingLines.map((l, idx) => (
            <div key={l.key} className="torn bg-cream px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[14px]">{l.name}</div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
                  <button type="button" onClick={() => setIngLines((a) => move(a, idx, -1))}>↑</button>
                  <button type="button" onClick={() => setIngLines((a) => move(a, idx, 1))}>↓</button>
                  <button
                    type="button"
                    className="text-flame"
                    onClick={() => setIngLines((a) => a.filter((x) => x.key !== l.key))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={l.qty}
                  placeholder="Qty"
                  onChange={(e) =>
                    setIngLines((a) => a.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))
                  }
                />
                <SelectInput
                  value={l.unit}
                  onChange={(e) =>
                    setIngLines((a) =>
                      a.map((x) => (x.key === l.key ? { ...x, unit: e.target.value as DisplayUnit } : x)),
                    )
                  }
                >
                  {unitsFor(l.base).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </SelectInput>
                <TextInput
                  value={l.prep_note}
                  placeholder="Prep note"
                  onChange={(e) =>
                    setIngLines((a) => a.map((x) => (x.key === l.key ? { ...x, prep_note: e.target.value } : x)))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading
          title="Components (sub-recipes)"
          action={
            <button type="button" onClick={openComponentPicker} className="font-mono text-[12px] underline">
              + Add
            </button>
          }
        />
        <div className="space-y-2">
          {compLines.length === 0 ? <EmptyNote>No sub-recipes.</EmptyNote> : null}
          {compLines.map((l, idx) => (
            <div key={l.key} className="torn bg-cream px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[14px]">{l.name}</div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
                  <button type="button" onClick={() => setCompLines((a) => move(a, idx, -1))}>↑</button>
                  <button type="button" onClick={() => setCompLines((a) => move(a, idx, 1))}>↓</button>
                  <button
                    type="button"
                    className="text-flame"
                    onClick={() => setCompLines((a) => a.filter((x) => x.key !== l.key))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={l.qty}
                  placeholder="Qty"
                  onChange={(e) =>
                    setCompLines((a) => a.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))
                  }
                />
                <SelectInput
                  value={l.unit}
                  onChange={(e) =>
                    setCompLines((a) =>
                      a.map((x) => (x.key === l.key ? { ...x, unit: e.target.value as DisplayUnit } : x)),
                    )
                  }
                >
                  {unitsFor(l.base).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </SelectInput>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading title="Method" />
        <TextArea value={method} onChange={(e) => setMethod(e.target.value)} className="min-h-[140px]" />
      </div>

      {editing ? (
        <Field label="What changed?" hint="saved as a new version">
          <TextInput value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} placeholder="Reduced cream, more chilli" />
        </Field>
      ) : null}

      <StickyActions>
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save as new version" : "Create recipe"}
        </PrimaryButton>
      </StickyActions>

      {/* Ingredient picker */}
      <Drawer
        open={pickIng}
        onOpenChange={(open) => {
          if (!open) closeIngredientPicker();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add ingredient</DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Ingredient">
                <TextInput
                  placeholder="Search ingredients"
                  value={ingredientDraft.search}
                  onChange={(e) => setIngredientDraft((draft) => ({ ...draft, search: e.target.value }))}
                />
              </Field>
              <GhostButton onClick={() => { setPickIng(false); setNewIng(true); }} className="w-full" type="button">
                + Create ingredient
              </GhostButton>
              <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                {filteredIngredients.length === 0 ? <EmptyNote>No ingredients found.</EmptyNote> : null}
                {filteredIngredients.map((i) => {
                  const selected = ingredientDraft.selected?.id === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => selectIngredient(i)}
                      className={`tap flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left ${selected ? "bg-ink text-cream" : "bg-cream text-ink"}`}
                    >
                      <span className="text-[14px]">{i.name}</span>
                      <span className={`font-mono text-[11px] ${selected ? "text-cream/80" : "text-ink-soft"}`}>{i.base_unit}</span>
                    </button>
                  );
                })}
              </div>
              {ingredientDraft.selected ? (
                <div className="torn space-y-3 bg-cream px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[14px]">{ingredientDraft.selected.name}</div>
                      <div className="font-mono text-[11px] text-ink-soft">Measured in {ingredientDraft.selected.base_unit}</div>
                    </div>
                    <button
                      type="button"
                      className="font-mono text-[11px] text-flame underline"
                      onClick={() => setIngredientDraft((draft) => ({ ...draft, selected: null, qty: "", prep_note: "" }))}
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <Field label="Quantity" required>
                      <TextInput
                        type="number"
                        inputMode="decimal"
                        value={ingredientDraft.qty}
                        onChange={(e) => setIngredientDraft((draft) => ({ ...draft, qty: e.target.value }))}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Unit">
                      <SelectInput
                        value={ingredientDraft.unit}
                        onChange={(e) => setIngredientDraft((draft) => ({ ...draft, unit: e.target.value as DisplayUnit }))}
                      >
                        {unitsFor(ingredientDraft.selected.base_unit as BaseUnit).map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label="Prep note">
                    <TextInput
                      value={ingredientDraft.prep_note}
                      onChange={(e) => setIngredientDraft((draft) => ({ ...draft, prep_note: e.target.value }))}
                      placeholder="diced, toasted, soaked…"
                    />
                  </Field>
                </div>
              ) : null}
            </div>
            <div className="-mx-5 mt-auto grid grid-cols-2 gap-2 border-t border-ink/10 bg-paper/95 px-5 py-3">
              <GhostButton type="button" onClick={closeIngredientPicker}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" onClick={() => addIngredientDraft("close")}>
                Add ingredient
              </PrimaryButton>
              <GhostButton type="button" onClick={() => addIngredientDraft("another")} className="col-span-2">
                Add & add another
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Inline ingredient creation — recipe state is preserved */}
      <Drawer
        open={newIng}
        onOpenChange={(open) => {
          setNewIng(open);
          if (!open) setPickIng(true);
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">New ingredient</DrawerTitle>
            <div className="mt-3">
              <IngredientForm
                compact
                onCancel={() => {
                  setNewIng(false);
                  setPickIng(true);
                }}
                onSaved={async (row) => {
                  await qc.invalidateQueries({ queryKey: ["ingredients"] });
                  await qc.invalidateQueries({ queryKey: ["recipe-graph"] });
                  const fresh = await supabase
                    .from("ingredients")
                    .select("id, name, base_unit")
                    .eq("id", row.id)
                    .maybeSingle();
                  if (fresh.data) selectIngredient(fresh.data);
                  setNewIng(false);
                  setPickIng(true);
                  toast.success("Ingredient ready");
                }}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Component picker */}
      <Drawer
        open={pickComp}
        onOpenChange={(open) => {
          if (!open) closeComponentPicker();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add sub-recipe</DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Sub-recipe">
                <TextInput
                  placeholder="Search recipes"
                  value={componentDraft.search}
                  onChange={(e) => setComponentDraft((draft) => ({ ...draft, search: e.target.value }))}
                />
              </Field>
              {componentCandidates.length === 0 ? (
                <EmptyNote>No other recipes available to use as a component.</EmptyNote>
              ) : null}
              {componentCandidates.length > 0 && filteredComponents.length === 0 ? <EmptyNote>No recipes found.</EmptyNote> : null}
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {filteredComponents.map((r) => {
                  const b = (r.active_version?.base_yield_unit as BaseUnit) ?? "g";
                  const selected = componentDraft.selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectComponent({ id: r.id, name: r.name, active_version_id: r.active_version_id, base: b })}
                      className={`tap flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left ${selected ? "bg-ink text-cream" : "bg-cream text-ink"}`}
                    >
                      <span className="text-[14px]">{r.name}</span>
                      <span className={`font-mono text-[11px] ${selected ? "text-cream/80" : "text-ink-soft"}`}>
                        {r.active_version ? fmtQty(Number(r.active_version.base_yield_quantity), b) : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {componentDraft.selected ? (
                <div className="torn space-y-3 bg-cream px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[14px]">{componentDraft.selected.name}</div>
                      <div className="font-mono text-[11px] text-ink-soft">Required amount</div>
                    </div>
                    <button
                      type="button"
                      className="font-mono text-[11px] text-flame underline"
                      onClick={() => setComponentDraft((draft) => ({ ...draft, selected: null, qty: "" }))}
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <Field label="Quantity" required>
                      <TextInput
                        type="number"
                        inputMode="decimal"
                        value={componentDraft.qty}
                        onChange={(e) => setComponentDraft((draft) => ({ ...draft, qty: e.target.value }))}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Unit">
                      <SelectInput
                        value={componentDraft.unit}
                        onChange={(e) => setComponentDraft((draft) => ({ ...draft, unit: e.target.value as DisplayUnit }))}
                      >
                        {unitsFor(componentDraft.selected.base).map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="-mx-5 mt-auto grid grid-cols-2 gap-2 border-t border-ink/10 bg-paper/95 px-5 py-3">
              <GhostButton type="button" onClick={closeComponentPicker}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" onClick={() => addComponentDraft("close")}>
                Add sub-recipe
              </PrimaryButton>
              <GhostButton type="button" onClick={() => addComponentDraft("another")} className="col-span-2">
                Add & add another
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
