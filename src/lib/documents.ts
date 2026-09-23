import { supabase } from "@/integrations/supabase/client";
import { format, isValid, parse, parseISO } from "date-fns";
import { fmtMoney, todayISO } from "./format";
import { clientDisplayName } from "./format";
import {
  businessAddressLines,
  bankDetailsOf,
  quoteTermsLines,
  invoiceTermsLines,
  type BankDetails,
  type BusinessSettings,
} from "./business";
import type { Quote } from "./quote";
import { quoteTotals } from "./quote";
import type { Invoice, PaymentState } from "./finance";
import { invoiceTotals } from "./finance";
import type { EventRow, ClientRow } from "./queries";

/* ---------- Shared document model ----------
 * A document is a plain, self-contained object. It is what the preview shows
 * and what the PDF prints, and it is exactly what gets frozen on issue.
 */

export type DocParty = {
  name: string;
  legalName?: string | null;
  lines: string[];
  email?: string | null;
  phone?: string | null;
  companyNumber?: string | null;
};

export type DocMetaRow = { label: string; value: string };
export type DocAmountRow = { label: string; detail?: string | null; amount: number };
export type DocMenuSection = { name: string; items: string[] };

export type BaseDoc = {
  currency: string;
  business: DocParty;
  clientName: string;
  billingLines: string[];
  meta: DocMetaRow[];
  bank: BankDetails | null;
  footerNote: string | null;
};

export type QuoteDoc = BaseDoc & {
  kind: "quote";
  documentTitle: string;
  number: string;
  eventDetails: DocMetaRow[];
  introduction: string | null;
  menu: DocMenuSection[];
  lines: DocAmountRow[];
  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vat: number;
  total: number;
  perHeadNote: string | null;
  whatsIncluded: string[];
  notes: string | null;
  terms: string[];
  platform: boolean;
};

export type InvoiceDoc = BaseDoc & {
  kind: "invoice";
  documentTitle: string;
  number: string;
  lines: DocAmountRow[];
  subtotal: number;
  vatEnabled: boolean;
  vatRate: number;
  vat: number;
  total: number;
  paid: number;
  outstanding: number;
  paymentState?: PaymentState;
  paymentInstructions: string[];
  notes: string | null;
};

export type AnyDoc = QuoteDoc | InvoiceDoc;

const money = (n: number, currency: string) => fmtMoney(n, currency) ?? "—";
export const docMoney = money;

/** Client documents use a formal date without a weekday. Stored dates are unchanged. */
export function documentDate(value: string | null | undefined): string {
  if (!value) return "Date TBC";
  const iso = parseISO(value);
  if (isValid(iso)) return format(iso, "d MMMM yyyy");
  const legacy = parse(value, "EEE d MMM yyyy", new Date());
  return isValid(legacy) ? format(legacy, "d MMMM yyyy") : value;
}

function partyFrom(s: BusinessSettings): DocParty {
  return {
    name: s.trading_name,
    legalName: s.legal_name,
    lines: businessAddressLines(s),
    email: s.email,
    phone: s.phone,
    companyNumber: s.company_number,
  };
}

const splitLines = (v: string | null | undefined) =>
  (v ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

/* ---------- Quote ---------- */

export function buildQuoteDoc(args: {
  quote: Quote;
  event: EventRow & { client: ClientRow | null };
  settings: BusinessSettings;
  platform: boolean;
}): QuoteDoc {
  const { quote, event, settings, platform } = args;
  const t = quoteTotals(quote);
  const currency = event.currency || settings.currency || "GBP";

  const lines: DocAmountRow[] = [];
  if (t.cateringTotal > 0 || t.guests > 0) {
    lines.push({
      label: quote.catering_label || "Catering",
      detail:
        t.guests > 0
          ? `${t.guests} guests × ${money(t.perHead, currency)} per person`
          : null,
      amount: t.cateringTotal,
    });
  }
  for (const c of quote.charges.filter((c) => c.show_on_quote)) {
    lines.push({ label: c.description, amount: Number(c.amount) });
  }
  const hiddenTotal = quote.charges
    .filter((c) => !c.show_on_quote)
    .reduce((s, c) => s + Number(c.amount), 0);
  if (hiddenTotal > 0) {
    lines.push({ label: "Additional services", amount: hiddenTotal });
  }

  const menu: DocMenuSection[] = quote.sections
    .filter((s) => s.included)
    .map((s) => ({
      name: s.name,
      items: s.items.filter((i) => i.visible).map((i) => i.name),
    }))
    .filter((s) => s.items.length > 0);

  const eventDetails: DocMetaRow[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value && String(value).trim()) eventDetails.push({ label, value: String(value) });
  };
  push("Event", quote.event_name ?? event.title);
  push("Date", quote.event_date ? documentDate(quote.event_date) : null);
  push("Venue", quote.venue);
  push("Guests", quote.guest_count != null ? String(quote.guest_count) : null);
  push("Event type", quote.event_type);
  push("Cuisine", quote.cuisine);
  push("Service style", quote.service_style);

  const meta: DocMetaRow[] = [
    { label: "Quote no.", value: quote.quote_number ?? "Draft" },
    { label: "Date", value: documentDate(quote.quote_date ?? todayISO()) },
  ];
  if (quote.valid_until) meta.push({ label: "Valid until", value: documentDate(quote.valid_until) });
  if ((quote.revision ?? 1) > 1) meta.push({ label: "Revision", value: String(quote.revision) });

  return {
    kind: "quote",
    documentTitle: "CATERING PROPOSAL",
    number: quote.quote_number ?? "Draft",
    currency,
    business: partyFrom(settings),
    clientName: quote.client_name || clientDisplayName(event.client),
    billingLines: splitLines(event.client?.billing_address),
    meta,
    eventDetails,
    introduction: quote.introduction?.trim() || null,
    menu,
    lines,
    subtotal: t.subtotal,
    vatEnabled: Boolean(settings.vat_registered && quote.vat_enabled),
    vatRate: Number(quote.vat_rate),
    vat: t.vat,
    total: t.total,
    perHeadNote:
      t.guests > 0 && t.perHead > 0
        ? `${money(t.perHead, currency)} per person for ${t.guests} guests`
        : null,
    whatsIncluded: splitLines(quote.whats_included),
    notes: quote.client_notes?.trim() || null,
    terms: quote.terms?.trim() ? splitLines(quote.terms) : quoteTermsLines(settings, platform),
    bank: !platform && settings.bank_details_on_quotes ? bankDetailsOf(settings) : null,
    footerNote: platform
      ? null
      : settings.card_payments_available
        ? settings.card_wording?.trim() || null
        : null,
    platform,
  };
}

/* ---------- Invoice ---------- */

export function buildInvoiceDoc(args: {
  invoice: Invoice;
  event: EventRow & { client: ClientRow | null };
  settings: BusinessSettings;
  totals: ReturnType<typeof invoiceTotals>;
  platform: boolean;
  paymentState: PaymentState;
}): InvoiceDoc {
  const { invoice, event, settings, totals, platform, paymentState } = args;
  const currency = event.currency || settings.currency || "GBP";
  const meta: DocMetaRow[] = [
    { label: "Invoice no.", value: invoice.invoice_number },
    { label: "Issue date", value: documentDate(invoice.issue_date) },
    {
      label: "Due",
      value: invoice.due_date
        ? documentDate(invoice.due_date)
        : invoice.kind === "deposit"
          ? "On booking"
          : "—",
    },
    { label: "Event", value: event.title },
  ];
  if (event.event_date) meta.push({ label: "Event date", value: documentDate(event.event_date) });

  const instructions = invoice.payment_instructions?.trim()
    ? splitLines(invoice.payment_instructions)
    : platform
      ? ["Payment is handled through the booking platform."]
      : invoiceTermsLines(settings);

  return {
    kind: "invoice",
    documentTitle: "INVOICE",
    number: invoice.invoice_number,
    currency,
    business: partyFrom(settings),
    clientName: invoice.client_name || clientDisplayName(event.client),
    billingLines: splitLines(invoice.billing_details ?? event.client?.billing_address),
    meta,
    lines: invoice.items.map((i) => ({
      label: i.description,
      detail: Number(i.quantity) !== 1 ? `${Number(i.quantity)} × ${money(Number(i.unit_price), currency)}` : null,
      amount: Number(i.quantity) * Number(i.unit_price),
    })),
    subtotal: totals.subtotal,
    vatEnabled: Boolean(settings.vat_registered && invoice.vat_enabled),
    vatRate: Number(invoice.vat_rate),
    vat: totals.vat,
    total: totals.total,
    paid: totals.paid,
    outstanding: totals.outstanding,
    paymentState,
    paymentInstructions: instructions,
    notes: invoice.notes?.trim() || null,
    bank: !platform && settings.bank_details_on_invoices ? bankDetailsOf(settings) : null,
    /* Card wording already appears in the payment instructions — never repeat it. */
    footerNote: null,
  };
}

/* ---------- Issued snapshots ---------- */

/** A snapshot is the document exactly as it was sent. Live data never rewrites it. */
export function snapshotOf<T extends AnyDoc>(stored: unknown, live: T): T {
  if (stored && typeof stored === "object" && (stored as { kind?: string }).kind === live.kind) {
    const frozen = stored as T;
    const normalizeRows = (rows: DocMetaRow[]) => rows.map((row) => ({
      ...row,
      value: /date|valid until|due/i.test(row.label) ? documentDate(row.value) : row.value,
    }));
    const normalized = {
      ...frozen,
      meta: normalizeRows(frozen.meta),
      vatEnabled: live.vatEnabled,
      footerNote: frozen.kind === "quote" && frozen.platform ? null : frozen.footerNote,
    } as T;
    if (normalized.kind === "quote") {
      normalized.eventDetails = normalizeRows(normalized.eventDetails);
      normalized.lines = normalized.lines.map((line) => ({
        ...line,
        detail: line.detail?.replace(/per head/g, "per person") ?? null,
      }));
      normalized.perHeadNote = normalized.perHeadNote?.replace(/per head/g, "per person") ?? null;
      if (normalized.platform) normalized.terms = live.kind === "quote" ? live.terms : normalized.terms;
    }
    return normalized;
  }
  return live;
}

export async function issueQuoteDocument(quoteId: string, doc: QuoteDoc) {
  const { error } = await supabase
    .from("event_quotes")
    .update({
      document_snapshot: doc as unknown as never,
      issued_at: new Date().toISOString(),
    } as never)
    .eq("id", quoteId);
  if (error) throw new Error(error.message);
}

export async function issueInvoiceDocument(invoiceId: string, doc: InvoiceDoc) {
  const { error } = await supabase
    .from("event_invoices")
    .update({
      document_snapshot: doc as unknown as never,
      issued_at: new Date().toISOString(),
    } as never)
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

/** Q-YYYY-NNN, continuing safely from the highest existing number. */
export async function nextQuoteNumber(year = new Date().getFullYear()): Promise<string> {
  const { data, error } = await supabase
    .from("event_quotes")
    .select("quote_number")
    .like("quote_number", `Q-${year}-%`);
  if (error) throw new Error(error.message);
  let highest = 0;
  for (const row of (data ?? []) as { quote_number: string | null }[]) {
    const n = Number(row.quote_number?.split("-")[2]);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return `Q-${year}-${String(highest + 1).padStart(3, "0")}`;
}

export function documentFileName(doc: AnyDoc, clientName: string): string {
  const safe = clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "client";
  return `${doc.number}-${safe}.pdf`;
}
