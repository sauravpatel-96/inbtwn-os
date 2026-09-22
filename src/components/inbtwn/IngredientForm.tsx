import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Field,
  TextInput,
  SelectInput,
  TextArea,
  Chip,
  PrimaryButton,
  StickyActions,
  SectionHeading,
} from "@/components/inbtwn/bits";
import { INGREDIENT_CATEGORIES } from "@/lib/constants";
import { allergensQuery, type IngredientWithAllergens } from "@/lib/recipe-queries";
import {
  BASE_UNITS,
  deriveUnitCost,
  fmtUnitCost,
  unitsFor,
  type BaseUnit,
  type DisplayUnit,
} from "@/lib/units";

export function IngredientForm({
  existing,
  onSaved,
  compact,
  onCancel,
}: {
  existing?: IngredientWithAllergens | null;
  onSaved: (row: { id: string; name: string }) => void;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const allergens = useQuery(allergensQuery);
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Other");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>((existing?.base_unit as BaseUnit) ?? "g");
  const [yieldPct, setYieldPct] = useState(String(existing?.yield_percentage ?? 100));
  const [price, setPrice] = useState(existing?.cost_price != null ? String(existing.cost_price) : "");
  const [qty, setQty] = useState(existing?.cost_quantity != null ? String(existing.cost_quantity) : "");
  const [costUnit, setCostUnit] = useState<DisplayUnit>(
    (existing?.cost_unit as DisplayUnit) ?? (existing?.base_unit === "ml" ? "L" : existing?.base_unit === "each" ? "each" : "kg"),
  );
  const [track, setTrack] = useState(existing?.track_inventory ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [selected, setSelected] = useState<string[]>(
    existing?.ingredient_allergens?.map((a) => a.allergen_id) ?? [],
  );
  const [saving, setSaving] = useState(false);

  const compatUnits = unitsFor(baseUnit);
  const effectiveCostUnit = compatUnits.includes(costUnit) ? costUnit : compatUnits[compatUnits.length - 1]!;
  const priceN = Number(price);
  const qtyN = Number(qty);
  const derived =
    price !== "" && qty !== "" && priceN >= 0 && qtyN > 0
      ? deriveUnitCost(priceN, qtyN, effectiveCostUnit)
      : null;

  const setBase = (b: BaseUnit) => {
    setBaseUnit(b);
    setCostUnit(b === "g" ? "kg" : b === "ml" ? "L" : "each");
  };

  const save = async (): Promise<void> => {
    const y = Number(yieldPct);
    if (!name.trim()) return void toast.error("Give the ingredient a name");
    if (!(y > 0 && y <= 100)) return void toast.error("Yield must be above 0% and at most 100%");
    if (price !== "" && priceN < 0) return void toast.error("Cost cannot be negative");
    if (price !== "" && !(qtyN > 0)) return void toast.error("Enter the quantity that price covers");
    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      base_unit: baseUnit,
      yield_percentage: y,
      current_unit_cost: derived,
      cost_price: price === "" ? null : priceN,
      cost_quantity: qty === "" ? null : qtyN,
      cost_unit: price === "" ? null : effectiveCostUnit,
      track_inventory: track,
      notes: notes.trim() || null,
    };
    const res = existing
      ? await supabase.from("ingredients").update(payload).eq("id", existing.id).select("id, name").maybeSingle()
      : await supabase.from("ingredients").insert(payload).select("id, name").maybeSingle();
    if (res.error || !res.data) {
      setSaving(false);
      return void toast.error(res.error?.message ?? "Could not save ingredient");
    }
    const id = res.data.id;
    await supabase.from("ingredient_allergens").delete().eq("ingredient_id", id);
    if (selected.length) {
      const ins = await supabase
        .from("ingredient_allergens")
        .insert(selected.map((allergen_id) => ({ ingredient_id: id, allergen_id })));
      if (ins.error) toast.error(ins.error.message);
    }
    setSaving(false);
    onSaved(res.data);
  };

  return (
    <div className="space-y-4">
      <Field label="Name" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken thigh — boneless" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {INGREDIENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Measured in">
          <SelectInput value={baseUnit} onChange={(e) => setBase(e.target.value as BaseUnit)}>
            {BASE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label="Usable yield %" hint="usable ÷ purchased">
        <TextInput
          type="number"
          inputMode="decimal"
          value={yieldPct}
          onChange={(e) => setYieldPct(e.target.value)}
        />
      </Field>

      <div>
        <SectionHeading title="Cost" />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Price £">
            <TextInput type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="30" />
          </Field>
          <Field label="For">
            <TextInput type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="5" />
          </Field>
          <Field label="Unit">
            <SelectInput value={effectiveCostUnit} onChange={(e) => setCostUnit(e.target.value as DisplayUnit)}>
              {compatUnits.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {derived !== null
            ? `Derived: ${fmtUnitCost(derived, baseUnit)} (${derived.toFixed(6)} per ${baseUnit})`
            : "Enter a purchase price to derive the unit cost"}
        </div>
      </div>

      <div>
        <SectionHeading title="Allergens" />
        <div className="flex flex-wrap gap-2">
          {(allergens.data ?? []).map((a) => (
            <Chip
              key={a.id}
              active={selected.includes(a.id)}
              onClick={() =>
                setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))
              }
            >
              {a.name}
            </Chip>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 font-mono text-[12px] text-ink-soft">
        <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} className="size-5" />
        Track inventory for this ingredient
      </label>

      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {compact ? (
        <div className="flex gap-2">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save ingredient"}
          </PrimaryButton>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="tap px-3 font-mono text-[12px] text-ink-soft">
              Cancel
            </button>
          ) : null}
        </div>
      ) : (
        <StickyActions>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Create ingredient"}
          </PrimaryButton>
        </StickyActions>
      )}
    </div>
  );
}
