import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, TextArea, PrimaryButton, GhostButton, EmptyNote } from "@/components/inbtwn/bits";
import { fmtMoney } from "@/lib/format";
import {
  pricingQuery,
  proposalQuery,
  optionTotals,
  budgetVerdict,
  type PricingOption,
} from "@/lib/commercial";
import type { EventRow } from "@/lib/queries";

type Draft = {
  id: string | null;
  name: string;
  price_per_head: string;
  guest_count_override: string;
  notes: string;
  sections: string[];
};

const emptyDraft: Draft = {
  id: null,
  name: "",
  price_per_head: "",
  guest_count_override: "",
  notes: "",
  sections: [],
};

export function EventPricing({ event }: { event: EventRow }) {
  const eventId = event.id;
  const qc = useQueryClient();
  const options = useQuery(pricingQuery(eventId));
  const proposal = useQuery(proposalQuery(eventId));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [chargeFor, setChargeFor] = useState<PricingOption | null>(null);
  const [chargeDesc, setChargeDesc] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const scrollY = useRef<number | null>(null);

  const list = options.data ?? [];
  const sections = proposal.data ?? [];

  const remember = () => {
    scrollY.current = window.scrollY;
  };
  const restore = () => {
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const saveOption = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return void toast.error("Give the option a name");
    const perHead = draft.price_per_head.trim();
    if (perHead && !/^\d+(\.\d{1,2})?$/.test(perHead)) return void toast.error("Price per head must be a number");
    const override = draft.guest_count_override.trim();
    if (override && !/^\d+$/.test(override)) return void toast.error("Guest count must be a whole number");

    setBusy(true);
    const payload = {
      name,
      price_per_head: perHead ? Number(perHead) : null,
      guest_count_override: override ? Number(override) : null,
      notes: draft.notes.trim() || null,
    };
    let optionId = draft.id;
    if (optionId) {
      const { error } = await supabase.from("event_pricing_options").update(payload).eq("id", optionId);
      if (error) {
        setBusy(false);
        return void toast.error(error.message);
      }
      await supabase.from("event_pricing_option_sections").delete().eq("option_id", optionId);
    } else {
      const res = await supabase
        .from("event_pricing_options")
        .insert({ ...payload, event_id: eventId, sort_order: list.length + 1 })
        .select()
        .single();
      if (res.error) {
        setBusy(false);
        return void toast.error(res.error.message);
      }
      optionId = res.data.id;
    }
    if (draft.sections.length && optionId) {
      const { error } = await supabase
        .from("event_pricing_option_sections")
        .insert(draft.sections.map((section_id) => ({ option_id: optionId as string, section_id })));
      if (error) toast.error(error.message);
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
    setDraft(null);
    restore();
    toast.success("Pricing option saved");
  };

  const removeOption = async (o: PricingOption) => {
    const { error } = await supabase.from("event_pricing_options").delete().eq("id", o.id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
    toast.success("Option removed");
  };

  const selectOption = async (o: PricingOption) => {
    const next = !o.is_selected;
    const clear = await supabase
      .from("event_pricing_options")
      .update({ is_selected: false })
      .eq("event_id", eventId);
    if (clear.error) return void toast.error(clear.error.message);
    if (next) {
      const { error } = await supabase.from("event_pricing_options").update({ is_selected: true }).eq("id", o.id);
      if (error) return void toast.error(error.message);
    }
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
    toast.success(next ? `${o.name} marked as client selected` : "Selection cleared");
  };

  const addCharge = async () => {
    if (!chargeFor) return;
    const desc = chargeDesc.trim();
    if (!desc) return void toast.error("Describe the charge");
    if (!/^\d+(\.\d{1,2})?$/.test(chargeAmount.trim())) return void toast.error("Amount must be a number");
    setBusy(true);
    const { error } = await supabase.from("event_pricing_charges").insert({
      option_id: chargeFor.id,
      description: desc,
      amount: Number(chargeAmount),
      sort_order: chargeFor.charges.length + 1,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
    setChargeDesc("");
    setChargeAmount("");
    setChargeFor(null);
    restore();
  };

  const removeCharge = async (id: string) => {
    const { error } = await supabase.from("event_pricing_charges").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
  };

  const money = (n: number) => fmtMoney(n, event.currency) ?? "—";

  return (
    <div className="pb-8">
      <div className="border border-ink/15 bg-cream px-4 py-4">
        <div className="font-display text-[26px] leading-none">PRICING</div>
        <div className="mt-1.5 font-mono text-[12px] text-ink-soft">
          {event.guest_count != null ? `${event.guest_count} guests` : "Guest count not set"} · each option is an
          alternative offer
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          remember();
          setDraft({ ...emptyDraft });
        }}
        className="tap mt-3 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
      >
        + Add pricing option
      </button>

      <div className="mt-5 space-y-4">
        {options.isLoading ? <p className="font-mono text-[12px] text-ink-soft">Loading…</p> : null}
        {!options.isLoading && list.length === 0 ? <EmptyNote>No pricing options yet.</EmptyNote> : null}

        {list.map((o) => {
          const t = optionTotals(o, event.guest_count);
          const verdict = budgetVerdict(t.total, event.budget_min, event.budget_max, event.budget);
          const linked = o.sections
            .map((l) => sections.find((s) => s.id === l.section_id)?.name)
            .filter(Boolean) as string[];
          return (
            <div key={o.id} className={`border bg-cream ${o.is_selected ? "border-ink" : "border-ink/15"}`}>
              <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="break-words font-display text-[20px] leading-none">{o.name}</div>
                  {linked.length ? (
                    <div className="mt-1 font-mono text-[10px] text-ink-soft">{linked.join(" + ")}</div>
                  ) : null}
                  {o.is_selected ? (
                    <div className="label-mono mt-1.5 inline-flex bg-ink px-1.5 py-0.5 text-cream">Client selected</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    remember();
                    setDraft({
                      id: o.id,
                      name: o.name,
                      price_per_head: o.price_per_head != null ? String(o.price_per_head) : "",
                      guest_count_override: o.guest_count_override != null ? String(o.guest_count_override) : "",
                      notes: o.notes ?? "",
                      sections: o.sections.map((s) => s.section_id),
                    });
                  }}
                  className="shrink-0 font-mono text-[11px] text-flame underline"
                >
                  Edit
                </button>
              </div>

              <div className="px-4 py-3 text-sm">
                {o.price_per_head != null ? (
                  <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5">
                    <span className="font-mono text-[11px] text-ink-soft">
                      {t.guests} guests × {money(t.perHead)}
                      {o.guest_count_override != null ? " (override)" : ""}
                    </span>
                    <span className="font-medium">{money(t.perHeadTotal)}</span>
                  </div>
                ) : null}

                {o.charges.map((c) => (
                  <div key={c.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5">
                    <span className="min-w-0 break-words font-mono text-[11px] text-ink-soft">{c.description}</span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="font-medium">{money(Number(c.amount))}</span>
                      <button
                        type="button"
                        onClick={() => removeCharge(c.id)}
                        className="font-mono text-[10px] text-ink-soft underline"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))}

                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="label-mono text-ink-soft">Total</span>
                  <span className="font-display text-[22px] leading-none">{money(t.total)}</span>
                </div>
                {o.vat_enabled ? (
                  <div className="font-mono text-[10px] text-ink-soft">
                    Subtotal {money(t.subtotal)} · VAT {money(t.vat)}
                  </div>
                ) : null}
                {o.notes ? <div className="mt-1 font-mono text-[11px] text-ink-soft">{o.notes}</div> : null}

                <div
                  className={`mt-2 border px-3 py-2 font-mono text-[10px] ${
                    verdict.tone === "over"
                      ? "border-flame/50 text-flame"
                      : verdict.tone === "ok"
                        ? "border-s-conf/50 text-s-conf"
                        : "border-ink/20 text-ink-soft"
                  }`}
                >
                  Internal: quote {money(t.total)}
                  {verdict.range ? ` · client budget ${verdict.range}` : ""} — {verdict.text}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      remember();
                      setChargeDesc("");
                      setChargeAmount("");
                      setChargeFor(o);
                    }}
                    className="tap border border-ink/25 bg-paper px-3 py-2 font-mono text-[11px]"
                  >
                    + Fixed charge
                  </button>
                  <button
                    type="button"
                    onClick={() => selectOption(o)}
                    className={`tap border px-3 py-2 font-mono text-[11px] ${
                      o.is_selected ? "border-ink bg-ink text-cream" : "border-ink/25 bg-paper"
                    }`}
                  >
                    {o.is_selected ? "Selected" : "Mark selected"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(o)}
                    className="tap col-span-2 border border-flame/40 px-3 py-2 font-mono text-[11px] text-flame"
                  >
                    Remove option
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[10px] text-ink-soft">
        VAT is off — INBTWN is not VAT registered. Card processing fees are not applied.
      </p>

      {/* Option sheet */}
      <Drawer open={Boolean(draft)} onOpenChange={(o) => { if (!o) { setDraft(null); restore(); } }} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {draft?.id ? "Edit pricing option" : "New pricing option"}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Option name" required>
                <TextInput
                  value={draft?.name ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  placeholder="Option 1 — BBQ"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price per head">
                  <TextInput
                    inputMode="decimal"
                    value={draft?.price_per_head ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, price_per_head: e.target.value } : d))}
                    placeholder="27.50"
                  />
                </Field>
                <Field label="Guests" hint="optional">
                  <TextInput
                    inputMode="numeric"
                    value={draft?.guest_count_override ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, guest_count_override: e.target.value } : d))}
                    placeholder={event.guest_count != null ? String(event.guest_count) : "36"}
                  />
                </Field>
              </div>
              {sections.length ? (
                <Field label="Proposal sections included">
                  <div className="flex flex-wrap gap-2">
                    {sections.map((s) => {
                      const on = draft?.sections.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    sections: on ? d.sections.filter((x) => x !== s.id) : [...d.sections, s.id],
                                  }
                                : d,
                            )
                          }
                          className={`tap border px-3 py-2 font-mono text-[11px] ${
                            on ? "border-ink bg-ink text-cream" : "border-ink/20 bg-cream text-ink"
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              ) : null}
              <Field label="Note (optional)">
                <TextArea
                  value={draft?.notes ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                  className="min-h-[64px]"
                />
              </Field>
            </div>
            <div className="-mx-5 mt-auto grid grid-cols-2 gap-2 border-t border-ink/10 bg-paper/95 px-5 py-3">
              <GhostButton type="button" onClick={() => { setDraft(null); restore(); }}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" disabled={busy} onClick={saveOption}>
                Save option
              </PrimaryButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Charge sheet */}
      <Drawer open={Boolean(chargeFor)} onOpenChange={(o) => { if (!o) { setChargeFor(null); restore(); } }} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add fixed charge</DrawerTitle>
            <div className="mt-3 space-y-3">
              <Field label="Description" required>
                <TextInput value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="Delivery" />
              </Field>
              <Field label="Amount" required>
                <TextInput inputMode="decimal" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="75" />
              </Field>
            </div>
            <div className="-mx-5 mt-4 grid grid-cols-2 gap-2 border-t border-ink/10 px-5 py-3">
              <GhostButton type="button" onClick={() => { setChargeFor(null); restore(); }}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" disabled={busy} onClick={addCharge}>
                Add charge
              </PrimaryButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
