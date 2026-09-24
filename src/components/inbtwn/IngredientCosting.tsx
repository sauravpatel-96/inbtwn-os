import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, SelectInput, PrimaryButton, GhostButton, SectionHeading, TornCard } from "@/components/inbtwn/bits";
import {
  purchaseOptionsQuery,
  suppliersQuery,
  latestPrice,
  optionUnitCost,
  resolveOption,
  costReason,
  type PurchaseOption,
} from "@/lib/costing";
import { fmtCost, fmtUnitCost, unitsFor, type BaseUnit, type DisplayUnit } from "@/lib/units";
import { fmtDateLong, todayISO } from "@/lib/format";

type Props = {
  ingredientId: string;
  base: BaseUnit;
  yieldPct: number;
  costStatus: string | null;
};

export function IngredientCosting({ ingredientId, base, yieldPct, costStatus }: Props) {
  const qc = useQueryClient();
  const opts = useQuery(purchaseOptionsQuery(ingredientId));
  const sups = useQuery(suppliersQuery);
  const [adding, setAdding] = useState(false);
  const [repricing, setRepricing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase-options"] });
    qc.invalidateQueries({ queryKey: ["ingredients"] });
    qc.invalidateQueries({ queryKey: ["recipe-graph"] });
  };

  const options = opts.data ?? [];
  const resolved = resolveOption(options);
  const others = options.filter((o) => o.id !== resolved?.id);

  const setPreferred = async (o: PurchaseOption) => {
    await supabase.from("ingredient_purchase_options").update({ is_preferred: false }).eq("ingredient_id", ingredientId).neq("id", o.id);
    const { error } = await supabase.from("ingredient_purchase_options").update({ is_preferred: true, active: true }).eq("id", o.id);
    if (error) return void toast.error(error.message);
    refresh();
    toast.success(`${o.supplier?.name ?? "Option"} is now preferred`);
  };

  const toggleActive = async (o: PurchaseOption) => {
    const { error } = await supabase
      .from("ingredient_purchase_options")
      .update({ active: !o.active, is_preferred: o.active ? false : o.is_preferred })
      .eq("id", o.id);
    if (error) return void toast.error(error.message);
    refresh();
  };

  const card = (o: PurchaseOption, primary: boolean) => {
    const p = latestPrice(o);
    const unit = optionUnitCost(o, base);
    return (
      <div key={o.id} className={primary ? "" : "border-b border-ink/10 py-3 last:border-0"}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">
            {o.supplier?.name ?? "Supplier"}
            {!o.active ? <span className="ml-2 font-mono text-[10px] text-ink-soft">inactive</span> : null}
            {o.is_test ? <span className="ml-2 font-mono text-[10px] text-flame">TEST PRICE</span> : null}
          </span>
          <span className="font-mono text-[13px]">
            {o.pack_quantity} {o.pack_unit} · {p ? fmtCost(p.pack_price) : "No price"}
          </span>
        </div>
        {primary ? (
          <div className="mt-2 space-y-0.5 font-mono text-[12px]">
            {unit === null ? (
              <div className="text-flame">{p ? "Cost unavailable — unit mismatch" : "No purchase price"}</div>
            ) : (
              <>
                <div>{fmtUnitCost(unit, base)} purchased</div>
                <div className="text-ink-soft">Usable yield {yieldPct}%</div>
                <div className="font-semibold">{fmtUnitCost(unit / (yieldPct / 100), base)} usable</div>
              </>
            )}
            {p ? <div className="text-ink-soft">Last priced {fmtDateLong(p.effective_date)}</div> : null}
          </div>
        ) : unit !== null ? (
          <div className="mt-0.5 font-mono text-[11px] text-ink-soft">{fmtUnitCost(unit, base)} purchased</div>
        ) : null}
        {o.notes ? <div className="mt-1 text-[12px] text-ink-soft">{o.notes}</div> : null}
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px]">
          <button type="button" className="text-flame" onClick={() => setRepricing(repricing === o.id ? null : o.id)}>
            New price
          </button>
          {!o.is_preferred || !o.active ? (
            <button type="button" className="text-flame" onClick={() => void setPreferred(o)}>
              Set preferred
            </button>
          ) : null}
          <button type="button" className="text-ink-soft" onClick={() => void toggleActive(o)}>
            {o.active ? "Deactivate" : "Reactivate"}
          </button>
          {o.prices.length > 1 ? (
            <button type="button" className="text-ink-soft" onClick={() => setShowHistory(showHistory === o.id ? null : o.id)}>
              {showHistory === o.id ? "Hide history" : `History (${o.prices.length})`}
            </button>
          ) : null}
        </div>
        {showHistory === o.id ? (
          <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-soft">
            {o.prices.map((pr) => (
              <div key={pr.id} className="flex justify-between">
                <span>{fmtDateLong(pr.effective_date)}</span>
                <span>{fmtCost(pr.pack_price)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {repricing === o.id ? (
          <PriceForm
            optionId={o.id}
            onDone={() => {
              setRepricing(null);
              refresh();
            }}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="mt-5">
      <SectionHeading
        title="Costing"
        action={
          <button type="button" onClick={() => setAdding((a) => !a)} className="font-mono text-[11px] text-flame">
            {adding ? "Close" : "+ Purchase option"}
          </button>
        }
      />
      {adding ? (
        <OptionForm
          ingredientId={ingredientId}
          base={base}
          suppliers={(sups.data ?? []).filter((s) => s.active)}
          firstOption={options.length === 0}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : null}

      {options.length === 0 ? (
        <TornCard className="px-4 py-3 font-mono text-[12px] text-ink-soft">
          No purchase options yet. Add how you buy it — supplier, pack size and price — and INBTWN works out the unit cost.
        </TornCard>
      ) : (
        <>
          <TornCard className="px-4 py-3 shadow-card">
            <div className="label-mono mb-2 text-ink-soft">{resolved?.is_preferred ? "Preferred purchase" : resolved ? "Only priced option" : "Preferred purchase"}</div>
            {resolved ? card(resolved, true) : (
              <div className="font-mono text-[12px] text-flame">{costReason(costStatus === "ok" ? "no_preferred" : costStatus)}</div>
            )}
          </TornCard>
          {others.length ? (
            <TornCard className="mt-2 px-4 py-1 shadow-card">
              <div className="label-mono pt-2 text-ink-soft">Other purchase options</div>
              {others.map((o) => card(o, false))}
            </TornCard>
          ) : null}
        </>
      )}
      <div className="mt-2 font-mono text-[10px] text-ink-soft">
        <Link to="/library/suppliers" className="underline">Manage suppliers</Link>
      </div>
    </div>
  );
}

function OptionForm({
  ingredientId,
  base,
  suppliers,
  firstOption,
  onDone,
}: {
  ingredientId: string;
  base: BaseUnit;
  suppliers: { id: string; name: string }[];
  firstOption: boolean;
  onDone: () => void;
}) {
  const units = unitsFor(base);
  const [supplierId, setSupplierId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<DisplayUnit>(units[units.length - 1] ?? base);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayISO());
  const [preferred, setPreferred] = useState(firstOption);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const q = Number(qty);
    const pr = price.trim() === "" ? null : Number(price);
    if (!supplierId) return void toast.error("Choose a supplier");
    if (!(q > 0)) return void toast.error("Enter the pack size");
    if (pr !== null && !(pr >= 0)) return void toast.error("Enter a valid price");
    setSaving(true);
    if (preferred) {
      await supabase.from("ingredient_purchase_options").update({ is_preferred: false }).eq("ingredient_id", ingredientId);
    }
    const { data, error } = await supabase
      .from("ingredient_purchase_options")
      .insert({ ingredient_id: ingredientId, supplier_id: supplierId, pack_quantity: q, pack_unit: unit, is_preferred: preferred, notes: notes.trim() || null } as never)
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      return void toast.error(error?.message ?? "Could not save");
    }
    if (pr !== null) {
      const res = await supabase.from("ingredient_purchase_prices").insert({ option_id: data.id, pack_price: pr, effective_date: date } as never);
      if (res.error) toast.error(res.error.message);
    }
    setSaving(false);
    toast.success("Purchase option saved");
    onDone();
  };

  return (
    <TornCard className="mb-3 space-y-3 px-4 py-4 shadow-card">
      <Field label="Supplier" required>
        <SelectInput value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Choose…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pack size" required>
          <TextInput inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="5" />
        </Field>
        <Field label="Unit">
          <SelectInput value={unit} onChange={(e) => setUnit(e.target.value as DisplayUnit)}>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pack price £">
          <TextInput inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="31.50" />
        </Field>
        <Field label="Price date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 font-mono text-[12px]">
        <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} /> Set as preferred
      </label>
      <PrimaryButton type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save purchase option"}
      </PrimaryButton>
    </TornCard>
  );
}

function PriceForm({ optionId, onDone }: { optionId: string; onDone: () => void }) {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayISO());
  const save = async () => {
    const pr = Number(price);
    if (price.trim() === "" || !(pr >= 0)) return void toast.error("Enter a valid price");
    const { error } = await supabase.from("ingredient_purchase_prices").insert({ option_id: optionId, pack_price: pr, effective_date: date } as never);
    if (error) return void toast.error(error.message);
    toast.success("Price added — earlier prices kept in history");
    onDone();
  };
  return (
    <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <Field label="Pack price £">
        <TextInput inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <GhostButton type="button" onClick={() => void save()}>Save</GhostButton>
    </div>
  );
}
