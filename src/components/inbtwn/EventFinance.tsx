import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, TextArea, SelectInput, PrimaryButton, GhostButton, SectionHeading } from "@/components/inbtwn/bits";
import { DocumentPreview, DocumentActions } from "@/components/inbtwn/DocumentPreview";
import { EventCloseout } from "@/components/inbtwn/EventCloseout";
import { businessSettingsQuery, type BusinessSettings } from "@/lib/business";
import { buildInvoiceDoc, snapshotOf, issueInvoiceDocument, type InvoiceDoc } from "@/lib/documents";
import { fmtMoney, fmtDateLong, todayISO } from "@/lib/format";
import type { EventRow, ClientRow } from "@/lib/queries";
import { clientDisplayName } from "@/lib/format";
import { quoteQuery, quoteTotals } from "@/lib/quote";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery } from "@/lib/menu-queries";
import { versionBuffersQuery } from "@/lib/production";
import { collectPurchases, type ShoppingLine } from "@/lib/shopping";
import { scaleVersion, type ScaleResult } from "@/lib/recipe-calc";
import {
  paymentTermsQuery,
  paymentsQuery,
  invoicesQuery,
  allocationsQuery,
  reconcileAllocations,
  invoicePaymentState,
  PAYMENT_STATE_LABELS,
  costsQuery,
  ensurePaymentTerms,
  buildSchedule,
  financeTotals,
  invoiceTotals,
  nextInvoiceNumber,
  costSummary,
  profitability,
  isPlatformSource,
  resolveAgreedValue,
  defaultPayoutDate,
  labelOf,
  maybeNum,
  round2,
  PAYMENT_METHODS,
  PAYMENT_CATEGORIES,
  INVOICE_STATUSES,
  COST_CATEGORIES,
  DEPOSIT_MODES,
  type Invoice,
  type TermsRow,
  type PaymentRow,
  type CostRow,
  type AllocationRow,
} from "@/lib/finance";

type Ev = EventRow & { client: ClientRow | null };

/* ---------- small presentational bits ---------- */

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="border border-ink/15 bg-cream px-3 py-2.5">
      <div className="label-mono text-ink-soft">{label}</div>
      <div className="mt-0.5 font-display text-[20px] leading-none">{value}</div>
      {note ? <div className="mt-1 font-mono text-[10px] text-ink-soft">{note}</div> : null}
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5 last:border-0">
      <span className="label-mono text-ink-soft">{label}</span>
      <span className={`text-right font-mono text-[13px] ${muted ? "text-ink-soft" : ""}`}>{value}</span>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <SectionHeading title={title} action={action} />
      <div className="border border-ink/15 bg-cream px-4 py-3">{children}</div>
    </div>
  );
}

/* ---------- main ---------- */

export function EventFinance({ event }: { event: Ev }) {
  const eventId = event.id;
  const qc = useQueryClient();
  const platform = isPlatformSource(event.source);
  const money = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : fmtMoney(n, event.currency) ?? "—";

  const terms = useQuery(paymentTermsQuery(eventId));
  const payments = useQuery(paymentsQuery(eventId));
  const invoices = useQuery(invoicesQuery(eventId));
  const allocations = useQuery(allocationsQuery(eventId));
  const costs = useQuery(costsQuery(eventId));
  const shiftsQ = useQuery(eventShiftsQuery(eventId));
  const quote = useQuery(quoteQuery(eventId));
  const settingsQ = useQuery(businessSettingsQuery());

  const [creating, setCreating] = useState(false);
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    if (terms.isLoading || terms.data || creating) return;
    setCreating(true);
    ensurePaymentTerms(eventId, event.event_date, event.source)
      .then(() => qc.invalidateQueries({ queryKey: ["finance-terms", eventId] }))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setCreating(false));
  }, [terms.isLoading, terms.data, creating, eventId, event.event_date, event.source, qc]);

  const t = terms.data ?? null;
  const pays = payments.data ?? [];
  const invs = invoices.data ?? [];
  const allocs = allocations.data ?? [];
  const costRows = costs.data ?? [];

  /* Apply eligible unallocated payments to invoices (never creates or duplicates payments). */
  useEffect(() => {
    if (allocating || !payments.data || !invoices.data || !allocations.data) return;
    if (invoices.data.length === 0 || payments.data.length === 0) return;
    setAllocating(true);
    reconcileAllocations({
      eventId,
      invoices: invoices.data,
      payments: payments.data,
      allocations: allocations.data,
    })
      .then((n) => {
        if (n > 0) qc.invalidateQueries({ queryKey: ["finance-allocations", eventId] });
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setAllocating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, payments.data, invoices.data, allocations.data]);

  const quoteTotal = quote.data ? quoteTotals(quote.data).total : null;
  const accepted = quote.data?.status === "accepted";
  const quoteValue = quote.data ? (maybeNum(quote.data.agreed_total) ?? quoteTotal) : null;
  const agreed = resolveAgreedValue({ terms: t, quoteValue, quoteAccepted: accepted });
  const agreedTotal = agreed.value;
  const agreedNote =
    agreed.source === "manual"
      ? "Manual agreement"
      : agreed.source === "quote"
        ? accepted
          ? "Accepted quote"
          : "Quote not accepted"
        : "No quote";

  const schedule = buildSchedule({ terms: t, agreedTotal, eventDate: event.event_date, payments: pays });
  const totals = financeTotals({ terms: t, agreedTotal, payments: pays, platform });

  /* food cost reference from the existing shopping/recipe engine */
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);
  const food = useMemo(() => {
    if (!graph.data || !menu.data) return null;
    const guests = event.guest_count ?? 0;
    const map = new Map<string, ShoppingLine>();
    for (const item of menu.data) {
      const perGuest = Number(item.quantity_per_guest ?? 0);
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      if (!versionId || guests <= 0 || perGuest <= 0) continue;
      const buffer = buffers.data?.[versionId] ?? 0;
      let result: ScaleResult | null = null;
      try {
        result = scaleVersion(versionId, guests * perGuest * (1 + buffer / 100), graph.data);
      } catch {
        result = null;
      }
      if (result) collectPurchases(result, map);
    }
    const lines = [...map.values()];
    if (lines.length === 0) return null;
    const missing = lines.filter((l) => l.cost === null).length;
    return { known: round2(lines.reduce((s, l) => s + (l.cost ?? 0), 0)), missing, count: lines.length };
  }, [graph.data, menu.data, buffers.data, event.guest_count]);

  /* Staff shifts are the labour source of truth once used; manual staff costs then stop counting. */
  const cs = combinedCosts(costRows, shiftsQ.data ?? []);
  const estProfit = profitability(totals.revenue, cs.hasEstimates ? cs.estimated : null);
  /**
   * Profit from costs that have actually been recorded. When ingredient costs
   * or actual job costs are still missing this is truthful but not final, so
   * it is labelled "Recorded" rather than "Actual".
   */
  const recordedCosts = cs.hasAny ? cs.actual : null;
  const recProfit = profitability(totals.revenue, recordedCosts);
  const costingComplete = cs.actualComplete && (food ? food.missing === 0 : true);
  const profitWord = costingComplete ? "Actual" : "Recorded";
  const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

  const patchTerms = async (values: Partial<TermsRow>) => {
    if (!t) return;
    const { error } = await supabase.from("event_payment_terms").update(values as never).eq("id", t.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-terms", eventId] });
  };

  if (terms.isLoading || payments.isLoading) {
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Summary */}
      {platform ? (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Client quote" value={money(agreedTotal)} note={accepted ? "Accepted" : quote.data ? "Not accepted yet" : "No quote yet"} />
          <Stat label="Expected payout" value={money(maybeNum(t?.expected_payout))} note={t?.expected_payout_date ? fmtDateLong(t.expected_payout_date) : "Date not set"} />
          <Stat label="Actual payout" value={maybeNum(t?.actual_payout) === null ? "Not received" : money(maybeNum(t?.actual_payout))} note={t?.actual_payout_date ? fmtDateLong(t.actual_payout_date) : null} />
          <Stat label="Payout status" value={t?.payout_status === "received" ? "Received" : "Awaiting"} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Agreed value" value={money(totals.revenue ?? agreedTotal)} note={agreedNote} />
            <Stat label="Received" value={money(totals.received)} />
            <Stat label="Outstanding" value={money(totals.outstanding)} />
          </div>
          <AgreedValueEditor
            terms={t}
            agreedSource={agreed.source}
            manual={maybeNum(t?.agreed_total_override)}
            quoteValue={quoteValue}
            quoteAccepted={accepted}
            money={money}
            patch={patchTerms}
          />
        </div>
      )}


      {platform ? (
        <PayoutPanel terms={t} event={event} money={money} patch={patchTerms} />
      ) : (
        <SchedulePanel
          schedule={schedule}
          terms={t}
          money={money}
          patch={patchTerms}
          eventDate={event.event_date}
        />
      )}

      <PaymentsPanel eventId={eventId} payments={pays} invoices={invs} money={money} qc={qc} platform={platform} />

      <InvoicesPanel
        event={event}
        invoices={invs}
        payments={pays}
        allocations={allocs}
        money={money}
        qc={qc}
        agreedTotal={agreedTotal}
        schedule={schedule}
        vatEnabled={Boolean(t?.vat_enabled)}
        vatRate={Number(t?.vat_rate ?? 20)}
        settings={settingsQ.data ?? null}
        platform={platform}
      />

      <CostsPanel eventId={eventId} costs={costRows} money={money} qc={qc} food={food} staffLabour={cs.usesStaff ? cs.labour : null} />

      {/* Profitability */}
      <Panel title="Profitability">
        <Line label="Revenue" value={money(totals.revenue)} />
        {totals.cardFee > 0 ? <Line label="Card fee included" value={money(totals.cardFee)} muted /> : null}
        <Line label="Estimated costs" value={cs.hasEstimates ? money(cs.estimated) : "Not recorded"} muted={!cs.hasEstimates} />
        <Line label="Actual costs" value={cs.actualComplete ? money(cs.actual) : cs.hasAny ? `${money(cs.actual)} (partial)` : "Not recorded"} muted={!cs.actualComplete} />
        {cs.usesStaff ? (
          <>
            <Line label="Staff labour · estimated (From Staff)" value={money(cs.labour.estimated)} muted />
            <Line
              label="Staff labour · actual (From Staff)"
              value={cs.labour.actualComplete ? money(cs.labour.actual) : `${money(cs.labour.actual)} (${cs.labour.actualMissing} ${cs.labour.actualMissing === 1 ? "shift" : "shifts"} without actual hours)`}
              muted
            />
          </>
        ) : null}
        <Line label="Estimated profit" value={estProfit.profit === null ? "Not enough data" : money(estProfit.profit)} muted={estProfit.profit === null} />
        <Line label="Estimated margin" value={pct(estProfit.margin)} muted={estProfit.margin === null} />
        <Line label={`${profitWord} profit`} value={recProfit.profit === null ? "Not enough data" : money(recProfit.profit)} muted={recProfit.profit === null} />
        <Line label={`${profitWord} margin`} value={pct(recProfit.margin)} muted={recProfit.margin === null} />
        {!costingComplete && recProfit.profit !== null ? (
          <p className="mt-2 font-mono text-[10px] text-flame">
            {food && food.missing > 0
              ? "Incomplete — ingredient costs are missing."
              : cs.usesStaff && !cs.labour.actualComplete
                ? "Incomplete — some staff shifts have no actual hours yet."
                : "Incomplete — some costs have no actual amount recorded."}
          </p>
        ) : null}
        {totals.revenue === null || totals.revenueProvisional ? (
          <p className="mt-2 font-mono text-[10px] text-flame">
            {totals.revenue === null
              ? "Revenue is unknown, so profitability cannot be calculated yet."
              : "Provisional — based on the expected payout, not money actually received."}
          </p>
        ) : null}
      </Panel>

      {event.status === "completed" ? (
        <EventCloseout
          eventId={eventId}
          summary={{
            revenue: money(totals.revenue),
            received: money(totals.received),
            outstanding: money(totals.outstanding),
            recordedCosts: recordedCosts === null ? "Not recorded" : money(recordedCosts),
            recordedProfit: recProfit.profit === null ? "Not enough data" : money(recProfit.profit),
            recordedMargin: pct(recProfit.margin),
            costingComplete,
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------- Agreed value (manual / offline agreements) ---------- */

function AgreedValueEditor({
  terms,
  agreedSource,
  manual,
  quoteValue,
  quoteAccepted,
  money,
  patch,
}: {
  terms: TermsRow | null;
  agreedSource: "quote" | "manual" | null;
  manual: number | null;
  quoteValue: number | null;
  quoteAccepted: boolean;
  money: (n: number | null | undefined) => string;
  patch: (v: Partial<TermsRow>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(manual != null ? String(manual) : "");

  const save = async () => {
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value < 0) return void toast.error("Enter an agreed value");
    await patch({ agreed_total_override: value, agreed_total_source: "manual" } as Partial<TermsRow>);
    setOpen(false);
    toast.success("Agreed value saved");
  };

  const clear = async () => {
    await patch({ agreed_total_override: null, agreed_total_source: null } as Partial<TermsRow>);
    setAmount("");
    setOpen(false);
    toast.success("Manual agreed value removed");
  };

  const useQuoteValue = async () => {
    await patch({ agreed_total_source: "quote" } as Partial<TermsRow>);
    toast.success("Using the accepted quote as the agreed value");
  };

  if (!terms) return null;
  const conflict = quoteAccepted && manual != null && agreedSource === "manual";

  return (
    <div className="border border-ink/15 bg-cream px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono text-ink-soft">
          {agreedSource === "manual" ? "Agreed outside INBTWN" : agreedSource === "quote" ? "From the quote" : "No agreed value set"}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="font-mono text-[11px] text-flame">
          {open ? "Close" : manual != null ? "Edit agreed value" : "Set agreed value"}
        </button>
      </div>

      {conflict ? (
        <div className="mt-2 border-t border-ink/10 pt-2">
          <p className="font-mono text-[10px] text-flame">
            A quote has been accepted at {money(quoteValue)}, but this event uses a manual agreed value of{" "}
            {money(manual)}. Choose which one is the commercial source of truth — payments and invoices are kept either
            way.
          </p>
          <div className="mt-2 flex gap-2">
            <GhostButton type="button" onClick={useQuoteValue}>
              Use accepted quote
            </GhostButton>
            <GhostButton type="button" onClick={() => toast.success("Keeping the manual agreed value")}>
              Keep manual value
            </GhostButton>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="mt-2 space-y-2 border-t border-ink/10 pt-2">
          <Field label="Agreed booking value" hint="the total price agreed with the client — not the budget">
            <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1200" />
          </Field>
          <div className="flex gap-2">
            <PrimaryButton type="button" onClick={save}>
              Save agreed value
            </PrimaryButton>
            {manual != null ? (
              <GhostButton type="button" onClick={clear}>
                Remove
              </GhostButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}


/* ---------- Direct: deposit & balance schedule ---------- */

function SchedulePanel({
  schedule,
  terms,
  money,
  patch,
  eventDate,
}: {
  schedule: ReturnType<typeof buildSchedule>;
  terms: TermsRow | null;
  money: (n: number | null | undefined) => string;
  patch: (v: Partial<TermsRow>) => Promise<void>;
  eventDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    deposit_mode: terms?.deposit_mode ?? "percentage",
    deposit_percentage: String(terms?.deposit_percentage ?? 20),
    deposit_amount: terms?.deposit_amount != null ? String(terms.deposit_amount) : "",
    deposit_due_date: terms?.deposit_due_date ?? "",
    balance_due_days_before: String(terms?.balance_due_days_before ?? 7),
    balance_due_date: terms?.balance_due_date ?? "",
    card_fee_applied: Boolean(terms?.card_fee_applied),
    card_fee_percentage: String(terms?.card_fee_percentage ?? 3),
    vat_enabled: Boolean(terms?.vat_enabled),
    vat_rate: String(terms?.vat_rate ?? 20),
  });

  const save = async () => {
    await patch({
      deposit_mode: form.deposit_mode,
      deposit_percentage: Number(form.deposit_percentage) || 0,
      deposit_amount: form.deposit_amount.trim() ? Number(form.deposit_amount) : null,
      deposit_due_date: form.deposit_due_date || null,
      balance_due_days_before: Number(form.balance_due_days_before) || 0,
      balance_due_date: form.balance_due_date || null,
      card_fee_applied: form.card_fee_applied,
      card_fee_percentage: Number(form.card_fee_percentage) || 0,
      vat_enabled: form.vat_enabled,
      vat_rate: Number(form.vat_rate) || 0,
    } as Partial<TermsRow>);
    setEditing(false);
    toast.success("Payment terms saved");
  };

  return (
    <Panel
      title="Payment schedule"
      action={
        <button type="button" onClick={() => setEditing((e) => !e)} className="font-mono text-[11px] text-flame">
          {editing ? "Close" : "Edit terms"}
        </button>
      }
    >
      {schedule.map((l) => (
        <div key={l.key} className="border-b border-ink/10 py-2 last:border-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{l.label}</span>
            <span className="font-mono text-[11px] text-ink-soft">
              {l.status === "paid"
                ? "Paid"
                : l.status === "overdue"
                  ? "Overdue"
                  : l.status === "part"
                    ? "Part paid"
                    : l.status === "none"
                      ? "Not required"
                      : "Outstanding"}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[11px]">
            <span>Req {money(l.required)}</span>
            <span>Rec {money(l.received)}</span>
            <span className="text-right">Due {l.dueDate ? fmtDateLong(l.dueDate) : "—"}</span>
          </div>
        </div>
      ))}
      <p className="mt-2 font-mono text-[10px] text-ink-soft">
        Default INBTWN terms: {Number(terms?.deposit_percentage ?? 20)}% deposit to secure the booking, balance{" "}
        {terms?.balance_due_days_before ?? 7} days before the event
        {eventDate ? ` (${fmtDateLong(eventDate)})` : ""}. An invoice is not a payment.
      </p>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          <Field label="Deposit">
            <SelectInput value={form.deposit_mode} onChange={(e) => setForm({ ...form, deposit_mode: e.target.value as typeof form.deposit_mode })}>
              {DEPOSIT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          {form.deposit_mode === "percentage" ? (
            <Field label="Deposit %">
              <TextInput inputMode="decimal" value={form.deposit_percentage} onChange={(e) => setForm({ ...form, deposit_percentage: e.target.value })} />
            </Field>
          ) : null}
          {form.deposit_mode === "fixed" ? (
            <Field label="Deposit amount">
              <TextInput inputMode="decimal" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deposit due">
              <TextInput type="date" value={form.deposit_due_date} onChange={(e) => setForm({ ...form, deposit_due_date: e.target.value })} />
            </Field>
            <Field label="Balance due">
              <TextInput type="date" value={form.balance_due_date} onChange={(e) => setForm({ ...form, balance_due_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Days before event" hint="used when no balance date is set">
            <TextInput inputMode="numeric" value={form.balance_due_days_before} onChange={(e) => setForm({ ...form, balance_due_days_before: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 font-mono text-[12px]">
            <input type="checkbox" checked={form.card_fee_applied} onChange={(e) => setForm({ ...form, card_fee_applied: e.target.checked })} />
            Apply card processing fee
          </label>
          {form.card_fee_applied ? (
            <Field label="Card fee %">
              <TextInput inputMode="decimal" value={form.card_fee_percentage} onChange={(e) => setForm({ ...form, card_fee_percentage: e.target.value })} />
            </Field>
          ) : null}
          <label className="flex items-center gap-2 font-mono text-[12px]">
            <input type="checkbox" checked={form.vat_enabled} onChange={(e) => setForm({ ...form, vat_enabled: e.target.checked })} />
            VAT registered (adds VAT to this event)
          </label>
          {form.vat_enabled ? (
            <Field label="VAT %">
              <TextInput inputMode="decimal" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
            </Field>
          ) : null}
          <PrimaryButton type="button" onClick={save}>
            Save terms
          </PrimaryButton>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------- Platform: payout ---------- */

function PayoutPanel({
  terms,
  event,
  money,
  patch,
}: {
  terms: TermsRow | null;
  event: Ev;
  money: (n: number | null | undefined) => string;
  patch: (v: Partial<TermsRow>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    expected_payout: terms?.expected_payout != null ? String(terms.expected_payout) : "",
    expected_payout_date: terms?.expected_payout_date ?? defaultPayoutDate(event.event_date) ?? "",
    actual_payout: terms?.actual_payout != null ? String(terms.actual_payout) : "",
    actual_payout_date: terms?.actual_payout_date ?? "",
    payout_status: terms?.payout_status ?? "awaiting",
    notes: terms?.notes ?? "",
  });

  const save = async () => {
    await patch({
      expected_payout: form.expected_payout.trim() ? Number(form.expected_payout) : null,
      expected_payout_date: form.expected_payout_date || null,
      actual_payout: form.actual_payout.trim() ? Number(form.actual_payout) : null,
      actual_payout_date: form.actual_payout_date || null,
      payout_status: form.payout_status,
      notes: form.notes.trim() || null,
    } as Partial<TermsRow>);
    setEditing(false);
    toast.success("Payout details saved");
  };

  return (
    <Panel
      title="Platform payout"
      action={
        <button type="button" onClick={() => setEditing((e) => !e)} className="font-mono text-[11px] text-flame">
          {editing ? "Close" : "Edit payout"}
        </button>
      }
    >
      <Line label="Expected payout" value={money(maybeNum(terms?.expected_payout))} muted={terms?.expected_payout == null} />
      <Line label="Expected date" value={terms?.expected_payout_date ? fmtDateLong(terms.expected_payout_date) : "—"} />
      <Line label="Actual payout" value={terms?.actual_payout == null ? "Not received" : money(Number(terms.actual_payout))} muted={terms?.actual_payout == null} />
      <Line label="Actual date" value={terms?.actual_payout_date ? fmtDateLong(terms.actual_payout_date) : "—"} />
      <Line label="Status" value={terms?.payout_status === "received" ? "Received" : "Awaiting"} />
      <p className="mt-2 font-mono text-[10px] text-ink-soft">
        The platform collects the client payment, so INBTWN deposit terms do not apply. Payout amounts are only what you
        record here.
      </p>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected payout">
              <TextInput inputMode="decimal" value={form.expected_payout} onChange={(e) => setForm({ ...form, expected_payout: e.target.value })} placeholder="Leave blank if unknown" />
            </Field>
            <Field label="Expected date">
              <TextInput type="date" value={form.expected_payout_date} onChange={(e) => setForm({ ...form, expected_payout_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Actual payout">
              <TextInput inputMode="decimal" value={form.actual_payout} onChange={(e) => setForm({ ...form, actual_payout: e.target.value })} />
            </Field>
            <Field label="Actual date">
              <TextInput type="date" value={form.actual_payout_date} onChange={(e) => setForm({ ...form, actual_payout_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Payout status">
            <SelectInput value={form.payout_status} onChange={(e) => setForm({ ...form, payout_status: e.target.value as typeof form.payout_status })}>
              <option value="awaiting">Awaiting</option>
              <option value="received">Received</option>
            </SelectInput>
          </Field>
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <PrimaryButton type="button" onClick={save}>
            Save payout
          </PrimaryButton>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------- Payment ledger ---------- */

function PaymentsPanel({
  eventId,
  payments,
  invoices,
  money,
  qc,
  platform,
}: {
  eventId: string;
  payments: PaymentRow[];
  invoices: Invoice[];
  money: (n: number | null | undefined) => string;
  qc: ReturnType<typeof useQueryClient>;
  platform: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const blank = {
    category: platform ? "payout" : "deposit",
    amount: "",
    payment_date: todayISO(),
    method: "bank_transfer",
    invoice_id: "",
    reference: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  const add = async () => {
    const amount = Number(form.amount);
    if (!form.amount.trim() || Number.isNaN(amount) || amount === 0) return void toast.error("Enter an amount");
    const { error } = await supabase.from("event_payments").insert({
      event_id: eventId,
      category: form.category,
      amount,
      payment_date: form.payment_date || todayISO(),
      method: form.method,
      invoice_id: form.invoice_id || null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) return void toast.error(error.message);
    setForm(blank);
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["finance-payments", eventId] });
    qc.invalidateQueries({ queryKey: ["finance-allocations", eventId] });
    toast.success("Payment recorded");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_payments").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-payments", eventId] });
    qc.invalidateQueries({ queryKey: ["finance-allocations", eventId] });
  };

  return (
    <Panel
      title="Payments"
      action={
        <button type="button" onClick={() => setAdding((a) => !a)} className="font-mono text-[11px] text-flame">
          {adding ? "Close" : "+ Record payment"}
        </button>
      }
    >
      {payments.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-soft">No payments recorded yet.</p>
      ) : (
        payments.map((p) => {
          const inv = invoices.find((i) => i.id === p.invoice_id);
          return (
            <div key={p.id} className="flex items-start justify-between gap-3 border-b border-ink/10 py-2 last:border-0">
              <div className="min-w-0">
                <div className="text-[14px] leading-tight">
                  {labelOf(PAYMENT_CATEGORIES, p.category)} · {labelOf(PAYMENT_METHODS, p.method)}
                </div>
                <div className="font-mono text-[10px] text-ink-soft">
                  {fmtDateLong(p.payment_date)}
                  {inv ? ` · ${inv.invoice_number}` : ""}
                  {p.reference ? ` · ${p.reference}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[14px]">{money(Number(p.amount))}</span>
                <button type="button" onClick={() => remove(p.id)} className="font-mono text-[10px] text-ink-soft underline">
                  Remove
                </button>
              </div>
            </div>
          );
        })
      )}

      {adding ? (
        <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {PAYMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Amount" required>
              <TextInput inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <TextInput type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </Field>
            <Field label="Method">
              <SelectInput value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          {invoices.length ? (
            <Field label="Against invoice">
              <SelectInput value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
                <option value="">Not linked</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          <Field label="Reference">
            <TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
          <PrimaryButton type="button" onClick={add}>
            Record payment
          </PrimaryButton>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------- Invoices ---------- */

function InvoicesPanel({
  event,
  invoices,
  payments,
  allocations,
  money,
  qc,
  agreedTotal,
  schedule,
  vatEnabled,
  vatRate,
  settings,
  platform,
}: {
  event: Ev;
  invoices: Invoice[];
  payments: PaymentRow[];
  allocations: AllocationRow[];
  money: (n: number | null | undefined) => string;
  qc: ReturnType<typeof useQueryClient>;
  agreedTotal: number | null;
  schedule: ReturnType<typeof buildSchedule>;
  vatEnabled: boolean;
  vatRate: number;
  settings: BusinessSettings | null;
  platform: boolean;
}) {
  const eventId = event.id;
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (kind: "deposit" | "balance" | "full") => {
    setBusy(true);
    try {
      const number = await nextInvoiceNumber();
      const line =
        kind === "deposit"
          ? { description: "Booking deposit", amount: schedule[0]?.required ?? 0 }
          : kind === "balance"
            ? { description: "Final balance", amount: schedule[1]?.required ?? 0 }
            : { description: `Catering — ${event.title}`, amount: agreedTotal ?? 0 };
      const dueDate =
        kind === "deposit"
          ? (schedule[0]?.dueDate ?? null)
          : (schedule[1]?.dueDate ?? null);
      const res = await supabase
        .from("event_invoices")
        .insert({
          event_id: eventId,
          invoice_number: number,
          kind,
          issue_date: todayISO(),
          due_date: dueDate,
          client_name: clientDisplayName(event.client),
          billing_details: event.client?.billing_address ?? null,
          vat_enabled: vatEnabled,
          vat_rate: vatRate,
        })
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      const item = await supabase.from("event_invoice_items").insert({
        invoice_id: res.data.id,
        description: line.description,
        quantity: 1,
        unit_price: line.amount,
        sort_order: 0,
      });
      if (item.error) throw new Error(item.error.message);
      qc.invalidateQueries({ queryKey: ["finance-invoices", eventId] });
      setOpen(res.data.id);
      toast.success(`${number} created`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("event_invoices").update({ status } as never).eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-invoices", eventId] });
  };

  return (
    <Panel title="Invoices">
      {invoices.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-soft">No invoices yet.</p>
      ) : (
        invoices.map((inv) => {
          const it = invoiceTotals(inv, payments, allocations);
          const state = invoicePaymentState(inv, it);
          const applied = allocations
            .filter((a) => a.invoice_id === inv.id)
            .map((a) => ({ alloc: a, payment: payments.find((p) => p.id === a.payment_id) ?? null }));
          const expanded = open === inv.id;
          const liveDoc = settings
            ? buildInvoiceDoc({ invoice: inv, event, settings, totals: it, platform, paymentState: state })
            : null;
          /* Paid and amount due always reflect today's payments, even on an issued copy. */
          const doc = liveDoc
            ? { ...snapshotOf(inv.document_snapshot, liveDoc), paid: it.paid, outstanding: it.outstanding, paymentState: state }
            : null;
          return (
            <div key={inv.id} className="border-b border-ink/10 py-2 last:border-0">
              <button type="button" onClick={() => setOpen(expanded ? null : inv.id)} className="flex w-full items-baseline justify-between gap-3 text-left">
                <span>
                  <span className="font-mono text-[13px]">{inv.invoice_number}</span>
                  <span className="ml-2 font-mono text-[10px] text-ink-soft">
                    {labelOf(INVOICE_STATUSES, inv.status)} · {PAYMENT_STATE_LABELS[state]}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-[13px]">
                  {money(it.total)}
                  <span className="block text-[10px] text-ink-soft">{it.outstanding > 0 ? `${money(it.outstanding)} outstanding` : "Settled"}</span>
                </span>
              </button>
              {expanded ? (
                <InvoiceDetail
                  invoice={inv}
                  totals={it}
                  state={state}
                  applied={applied}
                  money={money}
                  qc={qc}
                  eventId={eventId}
                  doc={doc}
                  liveDoc={liveDoc}
                  onStatus={(s) => setStatus(inv.id, s)}
                />
              ) : null}
            </div>
          );
        })
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3">
        <GhostButton type="button" disabled={busy} onClick={() => create("deposit")}>
          Deposit
        </GhostButton>
        <GhostButton type="button" disabled={busy} onClick={() => create("balance")}>
          Balance
        </GhostButton>
        <GhostButton type="button" disabled={busy} onClick={() => create("full")}>
          Full
        </GhostButton>
      </div>
      <p className="mt-2 font-mono text-[10px] text-ink-soft">
        Use separate deposit and balance invoices, or one full invoice with several payments against it.
      </p>
    </Panel>
  );
}

function InvoiceDetail({
  invoice,
  totals,
  state,
  applied,
  money,
  qc,
  eventId,
  doc,
  liveDoc,
  onStatus,
}: {
  invoice: Invoice;
  totals: ReturnType<typeof invoiceTotals>;
  state: keyof typeof PAYMENT_STATE_LABELS;
  applied: { alloc: AllocationRow; payment: PaymentRow | null }[];
  money: (n: number | null | undefined) => string;
  qc: ReturnType<typeof useQueryClient>;
  eventId: string;
  doc: InvoiceDoc | null;
  liveDoc: InvoiceDoc | null;
  onStatus: (status: string) => void;
}) {
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [instructions, setInstructions] = useState(invoice.payment_instructions ?? "");
  const [showDoc, setShowDoc] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance-invoices", eventId] });

  const issue = async () => {
    if (!liveDoc) return;
    setIssuing(true);
    try {
      await issueInvoiceDocument(invoice.id, liveDoc);
      await invalidate();
      toast.success("Invoice issued — this copy is now fixed");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setIssuing(false);
  };

  const addItem = async () => {
    if (!desc.trim()) return void toast.error("Describe the line");
    const { error } = await supabase.from("event_invoice_items").insert({
      invoice_id: invoice.id,
      description: desc.trim(),
      quantity: 1,
      unit_price: Number(price) || 0,
      sort_order: invoice.items.length,
    });
    if (error) return void toast.error(error.message);
    setDesc("");
    setPrice("");
    invalidate();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("event_invoice_items").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    invalidate();
  };

  const saveText = async () => {
    const { error } = await supabase
      .from("event_invoices")
      .update({ notes: notes.trim() || null, payment_instructions: instructions.trim() || null } as never)
      .eq("id", invoice.id);
    if (error) return void toast.error(error.message);
    invalidate();
    toast.success("Invoice saved");
  };

  return (
    <div className="mt-2 space-y-3 border-t border-ink/10 pt-2">
      <Line label="Issued" value={fmtDateLong(invoice.issue_date)} />
      <Line
        label="Due"
        value={invoice.due_date ? fmtDateLong(invoice.due_date) : invoice.kind === "deposit" ? "On booking" : "—"}
      />
      {invoice.items.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5">
          <span className="min-w-0 break-words text-[13px]">{i.description}</span>
          <span className="flex shrink-0 items-center gap-2 font-mono text-[13px]">
            {money(Number(i.quantity) * Number(i.unit_price))}
            <button type="button" onClick={() => removeItem(i.id)} className="text-[10px] text-ink-soft underline">
              Remove
            </button>
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <TextInput placeholder="Add a line" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <TextInput placeholder="0.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <GhostButton type="button" onClick={addItem} className="w-full">
        Add line
      </GhostButton>
      <Line label="Subtotal" value={money(totals.subtotal)} />
      {invoice.vat_enabled ? <Line label={`VAT ${Number(invoice.vat_rate)}%`} value={money(totals.vat)} /> : null}
      <Line label="Total" value={money(totals.total)} />
      <Line label="Paid" value={money(totals.paid)} />
      <Line label="Outstanding" value={money(totals.outstanding)} />
      <Line label="Payment state" value={PAYMENT_STATE_LABELS[state]} />

      {applied.length ? (
        <div className="border border-ink/15 px-3 py-2">
          <div className="label-mono text-ink-soft">Payments applied</div>
          {applied.map(({ alloc, payment }) => (
            <div key={alloc.id} className="flex items-start justify-between gap-3 border-b border-ink/10 py-1.5 last:border-0">
              <div className="min-w-0">
                <div className="font-mono text-[11px]">
                  {payment ? fmtDateLong(payment.payment_date) : "—"}
                  {payment ? ` · ${labelOf(PAYMENT_METHODS, payment.method)}` : ""}
                </div>
                {payment?.notes || payment?.reference ? (
                  <div className="font-mono text-[10px] text-ink-soft">{payment.notes ?? payment.reference}</div>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[13px]">{money(Number(alloc.amount))}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Field label="Status">
        <SelectInput value={invoice.status} onChange={(e) => onStatus(e.target.value)}>
          {INVOICE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Payment instructions">
        <TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </Field>
      <Field label="Notes">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <PrimaryButton type="button" onClick={saveText}>
        Save invoice
      </PrimaryButton>

      {doc ? (
        <div className="space-y-2 border-t border-ink/10 pt-3">
          <div className="label-mono text-ink-soft">Client document</div>
          <DocumentActions doc={doc} />
          <div className="grid grid-cols-2 gap-2">
            <GhostButton type="button" onClick={() => setShowDoc(!showDoc)}>
              {showDoc ? "Hide preview" : "Preview"}
            </GhostButton>
            <GhostButton type="button" disabled={issuing || Boolean(invoice.document_snapshot)} onClick={issue}>
              {invoice.document_snapshot ? "Issued" : issuing ? "Issuing…" : "Issue"}
            </GhostButton>
          </div>
          <p className="font-mono text-[10px] text-ink-soft">
            {invoice.document_snapshot
              ? `Issued copy fixed${invoice.issued_at ? ` on ${fmtDateLong(invoice.issued_at.slice(0, 10))}` : ""}. Paid and amount due stay up to date.`
              : "Issuing freezes the wording and figures the client receives."}
          </p>
          {showDoc ? <DocumentPreview doc={doc} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Job costs ---------- */

function CostsPanel({
  eventId,
  costs,
  money,
  qc,
  food,
  staffLabour,
}: {
  eventId: string;
  costs: CostRow[];
  money: (n: number | null | undefined) => string;
  qc: ReturnType<typeof useQueryClient>;
  food: { known: number; missing: number; count: number } | null;
  staffLabour: LabourTotals | null;
}) {
  const [adding, setAdding] = useState(false);
  const blank = { category: "food", description: "", estimated_amount: "", actual_amount: "", cost_date: "" };
  const [form, setForm] = useState(blank);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance-costs", eventId] });

  const add = async () => {
    if (!form.description.trim()) return void toast.error("Describe the cost");
    const { error } = await supabase.from("event_costs").insert({
      event_id: eventId,
      category: form.category,
      description: form.description.trim(),
      estimated_amount: form.estimated_amount.trim() ? Number(form.estimated_amount) : null,
      actual_amount: form.actual_amount.trim() ? Number(form.actual_amount) : null,
      cost_date: form.cost_date || null,
    });
    if (error) return void toast.error(error.message);
    setForm(blank);
    setAdding(false);
    invalidate();
    toast.success("Cost added");
  };

  const setActual = async (row: CostRow, value: string) => {
    const { error } = await supabase
      .from("event_costs")
      .update({ actual_amount: value.trim() ? Number(value) : null } as never)
      .eq("id", row.id);
    if (error) return void toast.error(error.message);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_costs").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    invalidate();
  };

  return (
    <Panel
      title="Job costs"
      action={
        <button type="button" onClick={() => setAdding((a) => !a)} className="font-mono text-[11px] text-flame">
          {adding ? "Close" : "+ Add cost"}
        </button>
      }
    >
      {food ? (
        <div className="mb-2 border border-ink/15 bg-paper px-3 py-2">
          <div className="label-mono text-ink-soft">Ingredient cost reference</div>
          <div className="mt-0.5 font-mono text-[13px]">{money(food.known)}</div>
          <div className="font-mono text-[10px] text-ink-soft">
            {food.missing > 0
              ? `Incomplete — ${food.missing} of ${food.count} ingredients have no cost recorded.`
              : `From the current menu and shopping requirements (${food.count} ingredients).`}
          </div>
        </div>
      ) : null}

      {staffLabour ? (
        <div className="mb-2 border border-ink/15 bg-paper px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="label-mono text-ink-soft">Staff labour · From Staff</span>
            <Link to="/events/$eventId" params={{ eventId }} search={{ s: "staff" }} replace className="font-mono text-[10px] text-flame">
              View Staff →
            </Link>
          </div>
          <div className="mt-0.5 font-mono text-[13px]">
            Est {money(staffLabour.estimated)} · Actual {staffLabour.actualComplete ? money(staffLabour.actual) : `${money(staffLabour.actual)} (partial)`}
          </div>
          <div className="font-mono text-[10px] text-ink-soft">Worked out from shifts. Manual staff costs below are kept but not counted.</div>
        </div>
      ) : null}
      {costs.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-soft">{staffLabour ? "No other costs recorded yet." : "No costs recorded yet."}</p>
      ) : (
        costs.map((c) => (
          <div key={c.id} className="border-b border-ink/10 py-2 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words text-[14px] leading-tight">{c.description}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-soft">
                {labelOf(COST_CATEGORIES, c.category)}
                {staffLabour && c.category === "staff" ? " · not counted (From Staff)" : ""}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-ink-soft">
                Est {c.estimated_amount == null ? "—" : money(Number(c.estimated_amount))}
              </span>
              <span className="flex items-center gap-2">
                <span className="label-mono text-ink-soft">Actual</span>
                <TextInput
                  className="w-[96px] px-2 py-1 text-[13px]"
                  inputMode="decimal"
                  defaultValue={c.actual_amount != null ? String(c.actual_amount) : ""}
                  onBlur={(e) => setActual(c, e.target.value)}
                />
                <button type="button" onClick={() => remove(c.id)} className="font-mono text-[10px] text-ink-soft underline">
                  Remove
                </button>
              </span>
            </div>
          </div>
        ))
      )}

      {adding ? (
        <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          <Field label="Category">
            <SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {COST_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Description" required>
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimated">
              <TextInput inputMode="decimal" value={form.estimated_amount} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
            </Field>
            <Field label="Actual">
              <TextInput inputMode="decimal" value={form.actual_amount} onChange={(e) => setForm({ ...form, actual_amount: e.target.value })} />
            </Field>
          </div>
          <Field label="Date">
            <TextInput type="date" value={form.cost_date} onChange={(e) => setForm({ ...form, cost_date: e.target.value })} />
          </Field>
          <PrimaryButton type="button" onClick={add}>
            Add cost
          </PrimaryButton>
        </div>
      ) : null}
      <p className="mt-2 font-mono text-[10px] text-ink-soft">
        Estimated and actual costs are kept separately — entering an actual never overwrites the estimate.
      </p>
    </Panel>
  );
}
