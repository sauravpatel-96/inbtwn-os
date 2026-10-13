import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, PrimaryButton, GhostButton, EmptyNote } from "@/components/inbtwn/bits";
import { recipesQuery, type RecipeWithVersion } from "@/lib/recipe-queries";
import {
  menuItemsQuery,
  fmtPortion,
  portionQuantity,
  portionLabel,
  PORTION_SIZES,
  type PortionSize,
  type MenuItem,
  menuDishName,
  acceptedQuoteDishesQuery,
  importAcceptedDishes,
} from "@/lib/menu-queries";
import type { BaseUnit } from "@/lib/units";
import { useNavigate } from "@tanstack/react-router";
import { versionBuffersQuery, dishBuffer, dishTarget, fmtProdQty } from "@/lib/production";
import { invalidateMenuDownstream, reconcileMenuRemoval } from "@/lib/menu-safety";

function standardOf(r: RecipeWithVersion): { portion: number | null; base: BaseUnit; presets: RecipeWithVersion["active_version"] } {
  const v = r.active_version;
  return {
    presets: v,
    portion: v?.default_portion_quantity != null ? Number(v.default_portion_quantity) : null,
    base: ((v?.base_yield_unit as BaseUnit) ?? "g"),
  };
}

export function EventMenu({ eventId, guestCount }: { eventId: string; guestCount: number | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const items = useQuery(menuItemsQuery(eventId));
  const recipes = useQuery(recipesQuery);
  const accepted = useQuery(acceptedQuoteDishesQuery(eventId));
  const [linking, setLinking] = useState<MenuItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<"library" | "custom">("library");
  const [dishName, setDishName] = useState("");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RecipeWithVersion | null>(null);
  const [size, setSize] = useState<PortionSize>("medium");
  const [qtyMode, setQtyMode] = useState<"per_guest" | "fixed">("per_guest");
  const [fixedQty, setFixedQty] = useState("");
  const buffers = useQuery(versionBuffersQuery);
  const guests = guestCount ?? 0;
  /** Production target preview using the shared rule. */
  const targetText = (row: { quantity_unit: string; quantity_per_guest: number | null; quantity_mode: string; fixed_quantity: number | null }, versionLike: { recipe_version_id: string | null; recipe: { active_version_id: string | null } | null }) => {
    const dt = dishTarget(row, guests, dishBuffer(versionLike, buffers.data));
    if (!dt) return row.quantity_mode === "fixed" ? "Enter a quantity" : guests > 0 ? "No portion set" : "Set a guest count";
    return `Make ${fmtProdQty(dt.target, row.quantity_unit as BaseUnit)}${dt.fixed ? "" : ` · ${guests} guests${dt.buffer ? ` + ${Math.round(dt.buffer * 100) / 100}%` : ""}`}`;
  };
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const scrollY = useRef<number | null>(null);

  const list = recipes.data ?? [];
  const filtered = useMemo(() => {
    const candidates = list.filter((r) => r.category !== "Component");
    const q = search.trim().toLowerCase();
    if (!q) {
      if (!linking) return candidates;
      // Surface likely name matches first; the user still chooses explicitly.
      const words = menuDishName(linking).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const score = (r: RecipeWithVersion) => words.filter((w) => r.name.toLowerCase().includes(w)).length;
      return [...candidates].sort((a, b) => score(b) - score(a));
    }
    return candidates.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q),
    );
  }, [list, search, linking]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items.data ?? []) {
      const cat = it.recipe ? it.recipe.category || "Other" : "Recipe not linked";
      map.set(cat, [...(map.get(cat) ?? []), it]);
    }
    return [...map.entries()];
  }, [items.data]);

  const openSheet = (link: MenuItem | null = null) => {
    setLinking(link);
    setMode("library");
    setDishName("");
    scrollY.current = window.scrollY;
    setSearch("");
    setSelected(null);
    setSize("medium");
    setQtyMode("per_guest");
    setFixedQty("");
    setOpen(true);
  };

  const restoreScroll = () => {
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const closeSheet = () => {
    setOpen(false);
    setLinking(null);
    restoreScroll();
  };

  const addDish = async (after: "close" | "another") => {
    if (!linking && mode === "custom") {
      const name = dishName.trim().replace(/\s+/g, " ");
      if (!name) return void toast.error("Enter a dish name");
      const dup = (items.data ?? []).some((m) => menuDishName(m).trim().toLowerCase() === name.toLowerCase());
      if (dup) return void toast.error(`${name} is already on this menu`);
      setSaving(true);
      const { error } = await supabase.from("event_menu_items").insert({
        event_id: eventId,
        recipe_id: null,
        recipe_version_id: null,
        dish_name: name,
        portion_size: "medium",
        quantity_per_guest: null,
        quantity_unit: "g",
        sort_order: (items.data?.length ?? 0) + 1,
      });
      setSaving(false);
      if (error) return void toast.error(error.message);
      await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
      toast.success(`${name} added · recipe not linked`);
      if (after === "another") setDishName("");
      else closeSheet();
      return;
    }
    if (!selected) {
      toast.error("Pick a recipe first");
      return;
    }
    const { portion, base, presets } = standardOf(selected);
    const fixed = base === "each" && qtyMode === "fixed";
    if (fixed && !(Number(fixedQty) > 0)) return void toast.error("Enter how many to make");
    const qtyFields = {
      quantity_mode: fixed ? "fixed" : "per_guest",
      fixed_quantity: fixed ? Number(fixedQty) : null,
    };
    setSaving(true);
    if (linking) {
      const { error: linkErr } = await supabase
        .from("event_menu_items")
        .update({
          recipe_id: selected.id,
          recipe_version_id: selected.active_version_id,
          portion_size: size,
          quantity_per_guest: portionQuantity(portion, size, presets),
          quantity_unit: base,
          ...qtyFields,
        })
        .eq("id", linking.id);
      setSaving(false);
      if (linkErr) return void toast.error(linkErr.message);
      invalidateMenuDownstream(qc, eventId);
      await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
      toast.success(`${menuDishName(linking)} linked to ${selected.name}`);
      closeSheet();
      return;
    }
    const { error } = await supabase.from("event_menu_items").insert({
      event_id: eventId,
      recipe_id: selected.id,
      recipe_version_id: selected.active_version_id,
      portion_size: size,
      quantity_per_guest: portionQuantity(portion, size, presets),
      quantity_unit: base,
      ...qtyFields,
      sort_order: (items.data?.length ?? 0) + 1,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
    toast.success(`${selected.name} added`);
    if (after === "another") {
      setSelected(null);
      setSearch("");
      setSize("medium");
      setQtyMode("per_guest");
      setFixedQty("");
    } else {
      closeSheet();
    }
  };

  const changeSize = async (item: MenuItem, next: PortionSize) => {
    const recipe = list.find((r) => r.id === item.recipe_id);
    const standard = recipe ? standardOf(recipe).portion : null;
    const presets = recipe ? standardOf(recipe).presets : null;
    const fromRecipe = recipe ? portionQuantity(standard, next, presets) : null;
    const qty =
      fromRecipe != null
        ? fromRecipe
        : item.quantity_per_guest != null
          ? (Number(item.quantity_per_guest) /
              (PORTION_SIZES.find((p) => p.value === (item.portion_size as PortionSize))?.factor ?? 0.75)) *
            (PORTION_SIZES.find((p) => p.value === next)?.factor ?? 0.75)
          : null;
    const { error } = await supabase
      .from("event_menu_items")
      .update({ portion_size: next, quantity_per_guest: qty, quantity_mode: "per_guest" })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidateMenuDownstream(qc, eventId);
    await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
  };

  /** Switch an existing dish to fixed quantity (explicit user action only). */
  const saveFixed = async (item: MenuItem, value: string) => {
    const n = Number(value);
    if (value !== "" && !(n > 0)) return void toast.error("Enter how many to make");
    const { error } = await supabase
      .from("event_menu_items")
      .update(value === "" ? { quantity_mode: "fixed" } : { quantity_mode: "fixed", fixed_quantity: n })
      .eq("id", item.id);
    if (error) return void toast.error(error.message);
    invalidateMenuDownstream(qc, eventId);
    await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
    if (value !== "") toast.success(`${menuDishName(item)} · make ${Math.ceil(n)}`);
  };
  const usePerGuest = async (item: MenuItem) => {
    const { error } = await supabase.from("event_menu_items").update({ quantity_mode: "per_guest" }).eq("id", item.id);
    if (error) return void toast.error(error.message);
    invalidateMenuDownstream(qc, eventId);
    await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
  };

  const removeItem = async (item: MenuItem) => {
    const { error } = await supabase.from("event_menu_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    // Menu change is never blocked: reconcile downstream work afterwards.
    let summary = null;
    try {
      summary = await reconcileMenuRemoval({
        eventId,
        dishName: menuDishName(item),
        removedRecipeId: item.recipe_id,
        removedVersionId: item.recipe_version_id ?? item.recipe?.active_version_id ?? null,
      });
    } catch {
      summary = null;
    }
    invalidateMenuDownstream(qc, eventId);
    if (summary && summary.preserved > 0) {
      toast("Menu updated", {
        description: `${summary.dish} was removed. Production, Shopping, Prep and Packing recalculated. ${summary.preserved} recorded ${summary.preserved === 1 ? "item was" : "items were"} preserved.`,
        duration: 10000,
        action: {
          label: "Review preserved work →",
          onClick: () => navigate({ to: "/events/$eventId", params: { eventId }, search: { s: "plan" } as never, replace: true }),
        },
      });
    } else {
      toast.success("Removed from menu");
    }
  };

  const setupFromProposal = async () => {
    if (!accepted.data) return;
    setImporting(true);
    try {
      const n = await importAcceptedDishes(eventId, accepted.data.dishes, items.data ?? []);
      await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
      toast.success(n ? `${n} ${n === 1 ? "dish" : "dishes"} added from the accepted proposal` : "Menu already set up");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set up menu");
    } finally {
      setImporting(false);
    }
  };

  const canImport =
    !items.isLoading && (items.data?.length ?? 0) === 0 && (accepted.data?.dishes.length ?? 0) > 0;
  const unlinkedCount = (items.data ?? []).filter((i) => !i.recipe_id).length;

  const preview = selected ? standardOf(selected) : null;

  return (
    <div className="pb-6">
      <div className="border border-ink/15 bg-cream px-4 py-4">
        <div className="font-display text-[26px] leading-none">MENU</div>
        <div className="mt-1.5 font-mono text-[12px] text-ink-soft">
          {guestCount != null ? `${guestCount} guests` : "Guest count not set"}
        </div>
      </div>

      {canImport ? (
        <div className="mt-3 border border-flame bg-cream px-4 py-4">
          <div className="font-semibold">Accepted proposal{accepted.data?.quoteNumber ? ` · ${accepted.data.quoteNumber}` : ""}</div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">
            {accepted.data!.dishes.length} dishes. They'll be copied here as dishes needing a recipe — the quote stays as it is.
          </div>
          <button
            type="button"
            disabled={importing}
            onClick={setupFromProposal}
            className="tap mt-3 w-full border border-flame bg-flame px-4 py-3 text-center font-semibold text-cream disabled:opacity-60"
          >
            {importing ? "Setting up…" : "Set up menu from accepted proposal"}
          </button>
        </div>
      ) : null}

      {unlinkedCount > 0 ? (
        <p className="mt-3 border border-flame/50 px-3 py-2 font-mono text-[11px] text-flame">
          {unlinkedCount} {unlinkedCount === 1 ? "dish needs" : "dishes need"} a recipe before Production, Shopping and Prep are complete.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => openSheet()}
        className="tap mt-3 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
      >
        + Add dish
      </button>

      <div className="mt-5 space-y-6">
        {items.isLoading ? <p className="font-mono text-[12px] text-ink-soft">Loading…</p> : null}
        {!items.isLoading && grouped.length === 0 ? (
          <EmptyNote>No dishes on this menu yet.</EmptyNote>
        ) : null}

        {grouped.map(([category, rows]) => (
          <div key={category}>
            <h3 className="label-mono mb-2 text-ink-soft">{category}</h3>
            <div className="space-y-2">
              {rows.map((it) => {
                const base = (it.quantity_unit as BaseUnit) ?? "g";
                if (!it.recipe_id) {
                  return (
                    <div key={it.id} className="border border-flame/50 bg-cream px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{menuDishName(it)}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-flame">Recipe not linked</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button type="button" onClick={() => openSheet(it)} className="font-mono text-[11px] text-flame underline">
                            Link recipe
                          </button>
                          <button type="button" onClick={() => removeItem(it)} className="font-mono text-[11px] text-ink-soft underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const isEditing = editing?.id === it.id;
                return (
                  <div key={it.id} className="border border-ink/15 bg-cream px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{menuDishName(it)}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-ink-soft">
                          {(it.recipe?.category ?? "Other") + " · " + (it.quantity_mode === "fixed"
                            ? `Fixed quantity · ${Number(it.fixed_quantity)} ${base === "each" ? "items" : base}`
                            : portionLabel(it.portion_size as PortionSize) +
                            " · " +
                            fmtPortion(
                              it.quantity_per_guest != null ? Number(it.quantity_per_guest) : null,
                              base,
                            ) +
                            " per guest")}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-ink">
                          {targetText(it as never, it)}
                          {it.quantity_mode === "fixed" ? (
                            <span className="block text-ink-soft">Does not automatically scale with guest count</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing(isEditing ? null : it)}
                        className="shrink-0 font-mono text-[11px] text-flame underline"
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 border-t border-ink/10 pt-3">
                        {base === "each" ? (
                          <MethodToggle
                            value={it.quantity_mode === "fixed" ? "fixed" : "per_guest"}
                            onChange={(v) => {
                              if (v === "per_guest") void usePerGuest(it);
                              else void saveFixed(it, String((it.fixed_quantity ?? Math.ceil(guests * Number(it.quantity_per_guest ?? 0))) || ""));
                            }}
                          />
                        ) : null}
                        {base === "each" && it.quantity_mode === "fixed" ? (
                          <FixedEditor initial={it.fixed_quantity != null ? String(Number(it.fixed_quantity)) : ""} onSave={(v) => saveFixed(it, v)} />
                        ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {PORTION_SIZES.map((p) => {
                            const recipe = list.find((r) => r.id === it.recipe_id);
                            const standard = recipe ? standardOf(recipe).portion : null;
                            const presets = recipe ? standardOf(recipe).presets : null;
                            const active = it.portion_size === p.value;
                            return (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => changeSize(it, p.value)}
                                className={`tap border px-2 py-2 text-center ${
                                  active ? "border-ink bg-ink text-cream" : "border-ink/20 bg-paper text-ink"
                                }`}
                              >
                                <div className="label-mono">{p.label}</div>
                                <div className="mt-0.5 font-mono text-[11px] opacity-80">
                                  {fmtPortion(portionQuantity(standard, p.value, presets), base)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(it)}
                          className="tap mt-3 w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame"
                        >
                          Remove from menu
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {linking ? `Link recipe · ${menuDishName(linking)}` : "Add dish"}
            </DrawerTitle>
            {!linking ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ["library", "From Recipe Library"],
                  ["custom", "Without recipe"],
                ] as const).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMode(v)}
                    className={`tap border px-2 py-2 text-center font-mono text-[12px] ${
                      mode === v ? "border-ink bg-ink text-cream" : "border-ink/20 bg-paper text-ink"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            ) : null}
            {!linking && mode === "custom" ? (
              <div className="mt-3 space-y-2 pb-3">
                <Field label="Dish name">
                  <TextInput
                    placeholder="e.g. Chicken Katsu Curry"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    autoFocus
                  />
                </Field>
                <p className="font-mono text-[11px] text-ink-soft">
                  Added as "Recipe not linked". No quantities, shopping or prep until you link a recipe.
                </p>
              </div>
            ) : (
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Recipe">
                <TextInput
                  placeholder="Search recipes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {filtered.length === 0 ? <EmptyNote>No recipes found.</EmptyNote> : null}
                {filtered.map((r) => {
                  const { portion, base } = standardOf(r);
                  const isSel = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className={`tap flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left ${
                        isSel ? "border-ink bg-ink text-cream" : "border-ink/15 bg-cream text-ink"
                      }`}
                    >
                      <span className="text-[14px]">{r.name}</span>
                      <span className={`font-mono text-[11px] ${isSel ? "text-cream/80" : "text-ink-soft"}`}>
                        {r.category} · {portion != null ? fmtPortion(portion, base) : "no portion"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selected && preview ? (
                <div className="border border-ink/15 bg-cream px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[14px]">{selected.name}</div>
                      <div className="font-mono text-[11px] text-ink-soft">
                        {selected.category} · standard portion{" "}
                        {preview.portion != null ? fmtPortion(preview.portion, preview.base) : "not set"}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="font-mono text-[11px] text-flame underline"
                      onClick={() => setSelected(null)}
                    >
                      Change
                    </button>
                  </div>
                  {preview.base === "each" ? <MethodToggle value={qtyMode} onChange={setQtyMode} /> : null}
                  {preview.base === "each" && qtyMode === "fixed" ? (
                    <Field label="Total items to make">
                      <TextInput type="number" inputMode="numeric" min={1} value={fixedQty} onChange={(e) => setFixedQty(e.target.value)} placeholder="34" />
                    </Field>
                  ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {PORTION_SIZES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSize(p.value)}
                        className={`tap border px-2 py-2.5 text-center ${
                          size === p.value ? "border-ink bg-ink text-cream" : "border-ink/20 bg-paper text-ink"
                        }`}
                      >
                        <div className="label-mono">{p.label}</div>
                        <div className="mt-0.5 font-mono text-[12px] opacity-80">
                          {fmtPortion(portionQuantity(preview.portion, p.value, preview.presets), preview.base)}
                        </div>
                      </button>
                    ))}
                  </div>
                  )}
                  {preview.base === "each" && qtyMode === "fixed" ? (
                    <p className="mt-2 font-mono text-[11px] text-ink-soft">Fixed quantity · Does not automatically scale with guest count. No buffer added.</p>
                  ) : null}
                  <div className="mt-2 font-mono text-[12px] text-ink">
                    {targetText(
                      {
                        quantity_unit: preview.base,
                        quantity_per_guest: portionQuantity(preview.portion, size, preview.presets),
                        quantity_mode: preview.base === "each" && qtyMode === "fixed" ? "fixed" : "per_guest",
                        fixed_quantity: fixedQty === "" ? null : Number(fixedQty),
                      },
                      { recipe_version_id: selected.active_version_id, recipe: { active_version_id: selected.active_version_id } },
                    )}
                  </div>
                  {preview.portion == null ? (
                    <p className="mt-2 font-mono text-[11px] text-flame">
                      This recipe has no standard portion yet — the per-guest amount will stay blank.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            )}
            <div className="-mx-5 mt-auto grid grid-cols-2 gap-2 border-t border-ink/10 bg-paper/95 px-5 py-3">
              <GhostButton type="button" onClick={closeSheet}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" disabled={saving} onClick={() => addDish("close")}>
                {linking ? "Link recipe" : "Add to menu"}
              </PrimaryButton>
              {linking ? null : <GhostButton
                type="button"
                disabled={saving}
                onClick={() => addDish("another")}
                className="col-span-2"
              >
                Add &amp; add another
              </GhostButton>}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MethodToggle({ value, onChange }: { value: "per_guest" | "fixed"; onChange: (v: "per_guest" | "fixed") => void }) {
  return (
    <div className="mb-2 mt-3">
      <div className="label-mono mb-1 text-ink-soft">Quantity method</div>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["per_guest", "Per guest"],
          ["fixed", "Fixed quantity"],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`tap border px-2 py-2 text-center font-mono text-[12px] ${
              value === v ? "border-ink bg-ink text-cream" : "border-ink/20 bg-paper text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function FixedEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Field label="Total items to make">
          <TextInput type="number" inputMode="numeric" min={1} value={v} onChange={(e) => setV(e.target.value)} />
        </Field>
      </div>
      <GhostButton type="button" onClick={() => onSave(v)} disabled={v === initial}>
        Save
      </GhostButton>
    </div>
  );
}
