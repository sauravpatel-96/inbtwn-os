import { queryOptions } from "@tanstack/react-query";
import { addDays, subDays, format, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { EventSource } from "./constants";

export type TermsRow = Database["public"]["Tables"]["event_payment_terms"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["event_payments"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["event_invoices"]["Row"];
export type InvoiceItemRow = Database["public"]["Tables"]["event_invoice_items"]["Row"];
export type CostRow = Database["public"]["Tables"]["event_costs"]["Row"];

export type AllocationRow = Database["public"]["Tables"]["event_payment_allocations"]["Row"];

export type Invoice = InvoiceRow & { items: InvoiceItemRow[] };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------- Reference data ---------- */

export const DEPOSIT_MODES = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
  { value: "none", label: "None" },
] as const;
export type DepositMode = (typeof DEPOSIT_MODES)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

export const PAYMENT_CATEGORIES = [
  { value: "deposit", label: "Deposit" },
  { value: "balance", label: "Balance" },
  { value: "full", label: "Full payment" },
  { value: "payout", label: "Platform payout" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
] as const;

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
  { value: "part_paid", label: "Part paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const COST_CATEGORIES = [
  { value: "food", label: "Food / Ingredients" },
  { value: "staff", label: "Staff" },
  { value: "travel", label: "Travel" },
  { value: "equipment", label: "Equipment / Hire" },
  { value: "disposables", label: "Disposables" },
  { value: "platform", label: "Platform / Commission" },
  { value: "other", label: "Other" },
] as const;

export const labelOf = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => list.find((x) => x.value === value)?.label ?? value ?? "—";

/** Marketplace sources settle through the platform rather than direct deposits. */
export const isPlatformSource = (source: EventSource) => source === "togather" || source === "poptop";

/* ---------- Money helpers (decimal-safe to the penny) ---------- */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v: number | string | null | undefined): number =>
  v === null || v === undefined || v === "" ? 0 : Number(v) || 0;
export const maybeNum = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

export const DEFAULT_DEPOSIT_PERCENTAGE = 20;
export const DEFAULT_BALANCE_DAYS_BEFORE = 7;
export const DEFAULT_PAYOUT_DAYS_AFTER = 7;
export const DEFAULT_CARD_FEE_PERCENTAGE = 3;

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (d: string | null | undefined) => {
  if (!d) return null;
  const v = parseISO(d);
  return isValid(v) ? v : null;
};

export function defaultBalanceDueDate(eventDate: string | null | undefined, daysBefore: number) {
  const d = parse(eventDate);
  return d ? iso(subDays(d, daysBefore)) : null;
}

export function defaultPayoutDate(eventDate: string | null | undefined, daysAfter = DEFAULT_PAYOUT_DAYS_AFTER) {
  const d = parse(eventDate);
  return d ? iso(addDays(d, daysAfter)) : null;
}

/* ---------- Queries ---------- */

export const paymentTermsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["finance-terms", eventId],
    queryFn: async () =>
      unwrap(
        await supabase.from("event_payment_terms").select("*").eq("event_id", eventId).maybeSingle(),
      ) as TermsRow | null,
  });

export const paymentsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["finance-payments", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_payments")
          .select("*")
          .eq("event_id", eventId)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as PaymentRow[],
  });

export const invoicesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["finance-invoices", eventId],
    queryFn: async (): Promise<Invoice[]> => {
      const invoices = unwrap(
        await supabase
          .from("event_invoices")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ) as InvoiceRow[];
      if (invoices.length === 0) return [];
      const items = unwrap(
        await supabase
          .from("event_invoice_items")
          .select("*")
          .in(
            "invoice_id",
            invoices.map((i) => i.id),
          )
          .order("sort_order"),
      ) as InvoiceItemRow[];
      return invoices.map((i) => ({ ...i, items: items.filter((it) => it.invoice_id === i.id) }));
    },
  });

export const costsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["finance-costs", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_costs")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ) as CostRow[],
  });

export const allocationsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["finance-allocations", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_payment_allocations")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ) as AllocationRow[],
  });

/** Creates the per-event terms row with INBTWN defaults when it does not exist yet. */
export async function ensurePaymentTerms(
  eventId: string,
  eventDate: string | null,
  source: EventSource,
): Promise<TermsRow> {
  const existing = unwrap(
    await supabase.from("event_payment_terms").select("*").eq("event_id", eventId).maybeSingle(),
  ) as TermsRow | null;
  if (existing) return existing;
  const platform = isPlatformSource(source);
  const res = await supabase
    .from("event_payment_terms")
    .insert({
      event_id: eventId,
      deposit_mode: platform ? "none" : "percentage",
      deposit_percentage: DEFAULT_DEPOSIT_PERCENTAGE,
      balance_due_days_before: DEFAULT_BALANCE_DAYS_BEFORE,
      balance_due_date: platform ? null : defaultBalanceDueDate(eventDate, DEFAULT_BALANCE_DAYS_BEFORE),
      expected_payout_date: platform ? defaultPayoutDate(eventDate) : null,
      card_fee_percentage: DEFAULT_CARD_FEE_PERCENTAGE,
      vat_enabled: false,
    })
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data as TermsRow;
}

/* ---------- Agreed commercial value ---------- */

export type AgreedSource = "quote" | "manual" | null;
export type AgreedValue = { value: number | null; source: AgreedSource };

/**
 * The agreed booking value. An accepted INBTWN quote is normally the source of truth,
 * but an offline/manual agreement may be entered when no accepted quote exists.
 * The event budget is NEVER used as an agreed value.
 */
export function resolveAgreedValue(args: {
  terms: TermsRow | null;
  quoteValue: number | null;
  quoteAccepted: boolean;
}): AgreedValue {
  const { terms, quoteValue, quoteAccepted } = args;
  const manual = maybeNum(terms?.agreed_total_override);
  const source = (terms?.agreed_total_source ?? null) as AgreedSource;
  if (source === "quote" && quoteValue !== null) return { value: quoteValue, source: "quote" };
  if (manual !== null) return { value: manual, source: "manual" };
  if (quoteValue !== null) return { value: quoteValue, source: "quote" };
  return { value: null, source: null };
}

/* ---------- Derived schedule ---------- */

export type ScheduleLine = {
  key: "deposit" | "balance";
  label: string;
  required: number;
  received: number;
  outstanding: number;
  dueDate: string | null;
  status: "paid" | "part" | "outstanding" | "overdue" | "none";
};

const paymentTotal = (payments: PaymentRow[], categories: string[]) =>
  round2(
    payments
      .filter((p) => p.status === "received" && categories.includes(p.category))
      .reduce((s, p) => s + num(p.amount) * (p.category === "refund" ? -1 : 1), 0),
  );

export function depositRequired(terms: TermsRow | null, agreedTotal: number | null): number {
  if (!terms || agreedTotal === null) return 0;
  if (terms.deposit_mode === "none") return 0;
  if (terms.deposit_mode === "fixed") return round2(num(terms.deposit_amount));
  return round2((agreedTotal * num(terms.deposit_percentage)) / 100);
}

export function buildSchedule(args: {
  terms: TermsRow | null;
  agreedTotal: number | null;
  eventDate: string | null;
  payments: PaymentRow[];
  today?: Date;
}): ScheduleLine[] {
  const { terms, agreedTotal, eventDate, payments } = args;
  const today = args.today ?? new Date();
  const deposit = depositRequired(terms, agreedTotal);
  const total = agreedTotal ?? 0;
  const balance = round2(Math.max(total - deposit, 0));

  const depositReceived = paymentTotal(payments, ["deposit"]);
  const otherReceived = paymentTotal(payments, ["balance", "full", "other", "refund"]);

  const depositDue = terms?.deposit_due_date ?? null;
  const balanceDue =
    terms?.balance_due_date ??
    defaultBalanceDueDate(eventDate, terms?.balance_due_days_before ?? DEFAULT_BALANCE_DAYS_BEFORE);

  const line = (
    key: ScheduleLine["key"],
    label: string,
    required: number,
    received: number,
    dueDate: string | null,
  ): ScheduleLine => {
    const outstanding = round2(Math.max(required - received, 0));
    const due = parse(dueDate);
    let status: ScheduleLine["status"] = "outstanding";
    if (required <= 0) status = "none";
    else if (outstanding <= 0) status = "paid";
    else if (due && due < today) status = "overdue";
    else if (received > 0) status = "part";
    return { key, label, required, received, outstanding, dueDate, status };
  };

  return [
    line("deposit", "Deposit", deposit, depositReceived, depositDue),
    line("balance", "Final balance", balance, otherReceived, balanceDue),
  ];
}

/* ---------- Totals ---------- */

export type FinanceTotals = {
  agreedTotal: number | null;
  cardFee: number;
  vat: number;
  revenue: number | null;
  revenueProvisional: boolean;
  received: number;
  outstanding: number | null;
};

export function financeTotals(args: {
  terms: TermsRow | null;
  agreedTotal: number | null;
  payments: PaymentRow[];
  platform: boolean;
}): FinanceTotals {
  const { terms, agreedTotal, payments, platform } = args;
  const received = round2(
    payments
      .filter((p) => p.status === "received")
      .reduce((s, p) => s + num(p.amount) * (p.category === "refund" ? -1 : 1), 0),
  );

  if (platform) {
    const actual = maybeNum(terms?.actual_payout);
    const expected = maybeNum(terms?.expected_payout);
    const revenue = actual ?? expected;
    return {
      agreedTotal,
      cardFee: 0,
      vat: 0,
      revenue,
      revenueProvisional: actual === null,
      received,
      outstanding: revenue === null ? null : round2(Math.max(revenue - received, 0)),
    };
  }

  const base = agreedTotal ?? 0;
  const cardFee =
    terms?.card_fee_applied && agreedTotal !== null
      ? round2((base * num(terms.card_fee_percentage)) / 100)
      : 0;
  const vat = terms?.vat_enabled && agreedTotal !== null ? round2(((base + cardFee) * num(terms.vat_rate)) / 100) : 0;
  const revenue = agreedTotal === null ? null : round2(base + cardFee + vat);
  return {
    agreedTotal,
    cardFee,
    vat,
    revenue,
    revenueProvisional: false,
    received,
    outstanding: revenue === null ? null : round2(revenue - received),
  };
}

/* ---------- Invoices ---------- */

export function invoiceTotals(invoice: Invoice, payments: PaymentRow[], allocations: AllocationRow[] = []) {
  const subtotal = round2(invoice.items.reduce((s, i) => s + num(i.quantity) * num(i.unit_price), 0));
  const vat = invoice.vat_enabled ? round2((subtotal * num(invoice.vat_rate)) / 100) : 0;
  const total = round2(subtotal + vat);
  const received = new Set(payments.filter((p) => p.status === "received").map((p) => p.id));
  const paid = round2(
    allocations
      .filter((a) => a.invoice_id === invoice.id && received.has(a.payment_id))
      .reduce((s, a) => s + num(a.amount), 0),
  );
  return { subtotal, vat, total, paid, outstanding: round2(total - paid) };
}

/** Payment state is derived, and deliberately separate from the invoice document status. */
export type PaymentState = "unpaid" | "part_paid" | "paid" | "overdue";

export function invoicePaymentState(
  invoice: InvoiceRow,
  totals: { total: number; paid: number; outstanding: number },
  today = new Date(),
): PaymentState {
  if (totals.total > 0 && totals.outstanding <= 0) return "paid";
  const due = parse(invoice.due_date);
  if (due && due < today && totals.outstanding > 0) return "overdue";
  return totals.paid > 0 ? "part_paid" : "unpaid";
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Unpaid",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
};

/** Payment categories an invoice of each kind may draw on, in priority order. */
const ELIGIBLE: Record<string, string[]> = {
  deposit: ["deposit", "full"],
  balance: ["balance", "full", "deposit"],
  full: ["full", "deposit", "balance"],
};
const KIND_ORDER = ["deposit", "balance", "full"];

/**
 * Applies eligible unallocated payments to invoices. Each payment can only ever be
 * allocated up to its own amount across all invoices, so nothing is double counted,
 * and event-level received totals are untouched.
 */
export async function reconcileAllocations(args: {
  eventId: string;
  invoices: Invoice[];
  payments: PaymentRow[];
  allocations: AllocationRow[];
}): Promise<number> {
  const { eventId, invoices, payments, allocations } = args;
  const remainingOf = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "received" || p.category === "refund" || p.category === "payout") continue;
    const used = allocations.filter((a) => a.payment_id === p.id).reduce((s, a) => s + num(a.amount), 0);
    const left = round2(num(p.amount) - used);
    if (left > 0.004) remainingOf.set(p.id, left);
  }
  if (remainingOf.size === 0) return 0;

  const inserts: { event_id: string; payment_id: string; invoice_id: string; amount: number }[] = [];

  /* Payments explicitly linked to an invoice are honoured first, whatever their category. */
  for (const p of payments) {
    const left = remainingOf.get(p.id);
    if (!p.invoice_id || !left || left <= 0.004) continue;
    const inv = invoices.find((i) => i.id === p.invoice_id);
    if (!inv || inv.status === "cancelled") continue;
    if (allocations.some((a) => a.payment_id === p.id && a.invoice_id === inv.id)) continue;
    const t = invoiceTotals(inv, payments, allocations);
    const taken = inserts.filter((i) => i.invoice_id === inv.id).reduce((s, i) => s + i.amount, 0);
    const outstanding = round2(t.outstanding - taken);
    if (outstanding <= 0.004) continue;
    const amount = round2(Math.min(left, outstanding));
    inserts.push({ event_id: eventId, payment_id: p.id, invoice_id: inv.id, amount });
    remainingOf.set(p.id, round2(left - amount));
  }

  const ordered = [...invoices].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.invoice_number.localeCompare(b.invoice_number),
  );

  for (const inv of ordered) {
    if (inv.status === "cancelled") continue;
    const t = invoiceTotals(inv, payments, allocations);
    let outstanding = round2(t.outstanding + inserts.filter((i) => i.invoice_id === inv.id).reduce((s, i) => s - i.amount, 0));
    if (outstanding <= 0.004) continue;
    for (const category of ELIGIBLE[inv.kind] ?? ["full", "deposit", "balance"]) {
      for (const p of payments) {
        if (outstanding <= 0.004) break;
        if (p.category !== category) continue;
        const left = remainingOf.get(p.id);
        if (!left || left <= 0.004) continue;
        if (allocations.some((a) => a.payment_id === p.id && a.invoice_id === inv.id)) continue;
        if (inserts.some((i) => i.payment_id === p.id && i.invoice_id === inv.id)) continue;
        const amount = round2(Math.min(left, outstanding));
        inserts.push({ event_id: eventId, payment_id: p.id, invoice_id: inv.id, amount });
        remainingOf.set(p.id, round2(left - amount));
        outstanding = round2(outstanding - amount);
      }
      if (outstanding <= 0.004) break;
    }
  }

  if (inserts.length === 0) return 0;
  const { error } = await supabase.from("event_payment_allocations").insert(inserts);
  if (error) throw new Error(error.message);
  return inserts.length;
}

/** INV-YYYY-NNN, sequential within the organisation for that year. */
export async function nextInvoiceNumber(year = new Date().getFullYear()): Promise<string> {
  const prefix = `INV-${year}-`;
  const res = await supabase
    .from("event_invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  if (res.error) throw new Error(res.error.message);
  const last = res.data?.[0]?.invoice_number ?? null;
  const seq = last ? Number(last.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(seq + 1).padStart(3, "0")}`;
}

/* ---------- Costs & profitability ---------- */

export type CostSummary = {
  estimated: number;
  actual: number;
  hasEstimates: boolean;
  actualComplete: boolean;
};

export function costSummary(costs: CostRow[]): CostSummary {
  const estimated = round2(
    costs.reduce((s, c) => s + (maybeNum(c.estimated_amount) ?? maybeNum(c.actual_amount) ?? 0), 0),
  );
  const actual = round2(costs.reduce((s, c) => s + (maybeNum(c.actual_amount) ?? 0), 0));
  return {
    estimated,
    actual,
    hasEstimates: costs.some((c) => maybeNum(c.estimated_amount) !== null || maybeNum(c.actual_amount) !== null),
    actualComplete: costs.length > 0 && costs.every((c) => maybeNum(c.actual_amount) !== null),
  };
}

export type Profit = { profit: number | null; margin: number | null };

export function profitability(revenue: number | null, costs: number | null): Profit {
  if (revenue === null || costs === null) return { profit: null, margin: null };
  const profit = round2(revenue - costs);
  return { profit, margin: revenue > 0 ? round2((profit / revenue) * 100) : null };
}

/* ---------- Due / overdue signals (for Today later) ---------- */

export type FinanceFlag =
  | "deposit_outstanding"
  | "payment_due_soon"
  | "payment_overdue"
  | "invoice_overdue"
  | "payout_expected"
  | "payout_overdue";

export function financeFlags(args: {
  schedule: ScheduleLine[];
  invoices: Invoice[];
  payments: PaymentRow[];
  terms: TermsRow | null;
  platform: boolean;
  today?: Date;
}): FinanceFlag[] {
  const today = args.today ?? new Date();
  const flags = new Set<FinanceFlag>();
  if (args.platform) {
    if (args.terms && args.terms.payout_status !== "received") {
      const expected = parse(args.terms.expected_payout_date);
      flags.add(expected && expected < today ? "payout_overdue" : "payout_expected");
    }
  } else {
    for (const line of args.schedule) {
      if (line.status === "overdue") flags.add("payment_overdue");
      if (line.key === "deposit" && (line.status === "outstanding" || line.status === "part"))
        flags.add("deposit_outstanding");
      const due = parse(line.dueDate);
      if (due && line.outstanding > 0 && due >= today && due <= addDays(today, 7)) flags.add("payment_due_soon");
    }
    for (const inv of args.invoices) {
      if (inv.status === "cancelled" || inv.status === "paid") continue;
      const due = parse(inv.due_date);
      if (due && due < today && invoiceTotals(inv, args.payments).outstanding > 0) flags.add("invoice_overdue");
    }
  }
  return [...flags];
}
