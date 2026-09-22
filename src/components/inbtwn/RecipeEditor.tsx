import { useMemo, useState } from "react";
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

const uid = () => Math.random().toString(36).slice(2);

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
  const [method, setMethod] = useState(version?.method ?? "");
  const [changeNotes, setChangeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickIng, setPickIng] = useState(false);
  const [pickComp, setPickComp] = useState(false);
  const [newIng, setNewIng] = useState(false);
  const [search, setSearch] = useState("");

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
    const t = search.trim().toLowerCase();
    return (ingredients.data ?? []).filter((i) => !t || i.name.toLowerCase().includes(t));
  }, [ingredients.data, search]);

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

  const addIngredient = (i: { id: string; name: string; base_unit: string }) => {
    const b = i.base_unit as BaseUnit;
    setIngLines((l) => [
      ...l,
      { key: uid(), ingredient_id: i.id, name: i.name, base: b, qty: "", unit: b === "each" ? "each" : b, prep_note: "" },
    ]);
    setPickIng(false);
    setSearch("");
  };

  const addComponent = (r: { id: string; name: string; active_version_id: string | null; base: BaseUnit }) => {
    if (!r.active_version_id) return;
    setCompLines((l) => [
      ...l,
      { key: uid(), version_id: r.active_version_id!, recipe_id: r.id, name: r.name, base: r.base, qty: "", unit: r.base === "each" ? "each" : r.base },
    ]);
    setPickComp(false);
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
      </div>

      <div>
        <SectionHeading
          title="Ingredients"
          action={
            <button type="button" onClick={() => setPickIng(true)} className="font-mono text-[12px] underline">
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
            <button type="button" onClick={() => setPickComp(true)} className="font-mono text-[12px] underline">
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
      <Drawer open={pickIng} onOpenChange={setPickIng}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto max-h-[75vh] w-full max-w-md overflow-y-auto px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add ingredient</DrawerTitle>
            <div className="mt-3 space-y-2">
              <TextInput placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              <GhostButton onClick={() => { setPickIng(false); setNewIng(true); }} className="w-full">
                + Create ingredient
              </GhostButton>
              {filteredIngredients.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => addIngredient(i)}
                  className="tap flex w-full items-center justify-between rounded-sm bg-cream px-3 py-2.5 text-left"
                >
                  <span className="text-[14px]">{i.name}</span>
                  <span className="font-mono text-[11px] text-ink-soft">{i.base_unit}</span>
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Inline ingredient creation — recipe state is preserved */}
      <Drawer open={newIng} onOpenChange={setNewIng}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">New ingredient</DrawerTitle>
            <div className="mt-3">
              <IngredientForm
                compact
                onCancel={() => setNewIng(false)}
                onSaved={async (row) => {
                  await qc.invalidateQueries({ queryKey: ["ingredients"] });
                  await qc.invalidateQueries({ queryKey: ["recipe-graph"] });
                  const fresh = await supabase
                    .from("ingredients")
                    .select("id, name, base_unit")
                    .eq("id", row.id)
                    .maybeSingle();
                  if (fresh.data) addIngredient(fresh.data);
                  setNewIng(false);
                  toast.success("Ingredient added");
                }}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Component picker */}
      <Drawer open={pickComp} onOpenChange={setPickComp}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto max-h-[75vh] w-full max-w-md overflow-y-auto px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add sub-recipe</DrawerTitle>
            <div className="mt-3 space-y-2">
              {componentCandidates.length === 0 ? (
                <EmptyNote>No other recipes available to use as a component.</EmptyNote>
              ) : null}
              {componentCandidates.map((r) => {
                const b = (r.active_version?.base_yield_unit as BaseUnit) ?? "g";
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addComponent({ id: r.id, name: r.name, active_version_id: r.active_version_id, base: b })}
                    className="tap flex w-full items-center justify-between rounded-sm bg-cream px-3 py-2.5 text-left"
                  >
                    <span className="text-[14px]">{r.name}</span>
                    <span className="font-mono text-[11px] text-ink-soft">
                      {r.active_version ? fmtQty(Number(r.active_version.base_yield_quantity), b) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
