import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PricingOption } from "./commercial";
import type { EventRow, ClientRow } from "./queries";
import { clientDisplayName } from "./format";

export type QuoteRow = Database["public"]["Tables"]["event_quotes"]["Row"];
export type QuoteSectionRow = Database["public"]["Tables"]["event_quote_sections"]["Row"];
export type QuoteItemRow = Database["public"]["Tables"]["event_quote_items"]["Row"];
export type QuoteChargeRow = Database["public"]["Tables"]["event_quote_charges"]["Row"];

export type QuoteStatus = "draft" | "ready" | "sent" | "accepted";

export const QUOTE_STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
];

export type QuoteSection = QuoteSectionRow & { items: QuoteItemRow[] };
export type Quote = QuoteRow & { sections: QuoteSection[]; charges: QuoteChargeRow[] };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const quoteQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["quote", eventId],
    queryFn: async (): Promise<Quote | null> => {
      const quote = unwrap(
        await supabase.from("event_quotes").select("*").eq("event_id", eventId).maybeSingle(),
      ) as QuoteRow | null;
      if (!quote) return null;
      const sections = unwrap(
        await supabase.from("event_quote_sections").select("*").eq("quote_id", quote.id).order("sort_order"),
      ) as QuoteSectionRow[];
      const items = unwrap(
        await supabase.from("event_quote_items").select("*").eq("quote_id", quote.id).order("sort_order"),
      ) as QuoteItemRow[];
      const charges = unwrap(
        await supabase.from("event_quote_charges").select("*").eq("quote_id", quote.id).order("sort_order"),
      ) as QuoteChargeRow[];
      return {
        ...quote,
        charges,
        sections: sections.map((s) => ({ ...s, items: items.filter((i) => i.section_id === s.id) })),
      };
    },
  });

/* ---------- Totals (client-facing) ---------- */

const num = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v) || 0);

export type QuoteTotals = {
  guests: number;
  perHead: number;
  cateringTotal: number;
  chargesTotal: number;
  subtotal: number;
  vat: number;
  total: number;
};

/** Hidden charges still contribute to the total — only their line is hidden. */
export function quoteTotals(q: Quote): QuoteTotals {
  const guests = q.guest_count ?? 0;
  const perHead = num(q.price_per_head);
  const cateringTotal = guests * perHead;
  const chargesTotal = q.charges.reduce((s, c) => s + num(c.amount), 0);
  const subtotal = cateringTotal + chargesTotal;
  const vat = q.vat_enabled ? subtotal * (num(q.vat_rate) / 100) : 0;
  return { guests, perHead, cateringTotal, chargesTotal, subtotal, vat, total: subtotal + vat };
}

/* ---------- Snapshot from event + proposal + pricing ---------- */

type ProposalLike = { id: string; name: string; items: { id: string; name: string; sort_order: number }[]; sort_order: number }[];

export function quoteFieldsFromEvent(
  event: EventRow & { client: ClientRow | null },
  option: PricingOption,
) {
  return {
    pricing_option_id: option.id,
    title: event.title,
    client_name: clientDisplayName(event.client),
    event_name: event.title,
    event_date: event.event_date,
    venue: [event.venue_name, event.venue_address].filter(Boolean).join(", ") || null,
    guest_count: option.guest_count_override ?? event.guest_count,
    event_type: event.event_type,
    cuisine: event.cuisine,
    service_style: event.service_style,
    price_per_head: option.price_per_head,
    vat_enabled: option.vat_enabled,
    vat_rate: option.vat_rate,
    card_fee_enabled: option.payment_fee_percentage != null && Number(option.payment_fee_percentage) > 0,
    card_fee_percentage: option.payment_fee_percentage,
  };
}

/**
 * Creates the quote (if missing) or refreshes an existing draft from
 * Event + Proposal + selected Pricing option. Quote-only presentation text
 * (introduction, included, notes, terms) is never overwritten.
 */
export async function buildQuoteSnapshot(args: {
  event: EventRow & { client: ClientRow | null };
  option: PricingOption;
  proposal: ProposalLike;
  existing: Quote | null;
}): Promise<void> {
  const { event, option, proposal, existing } = args;
  // An accepted quote is a signed commercial agreement — never rewritten from defaults.
  if (existing?.status === "accepted") {
    throw new Error("This quote has been accepted and can no longer be rebuilt.");
  }
  const fields = quoteFieldsFromEvent(event, option);

  let quoteId = existing?.id ?? null;
  if (quoteId) {
    const { error } = await supabase.from("event_quotes").update(fields).eq("id", quoteId);
    if (error) throw new Error(error.message);
    await supabase.from("event_quote_sections").delete().eq("quote_id", quoteId);
    await supabase.from("event_quote_charges").delete().eq("quote_id", quoteId);
  } else {
    const res = await supabase
      .from("event_quotes")
      .insert({ ...fields, event_id: event.id, status: "draft" })
      .select()
      .single();
    if (res.error) throw new Error(res.error.message);
    quoteId = res.data.id;
  }

  // Only sections linked to the selected option, when links exist.
  const linked = option.sections.map((l) => l.section_id);
  const chosen = linked.length ? proposal.filter((s) => linked.includes(s.id)) : proposal;

  for (const [index, s] of chosen.entries()) {
    const res = await supabase
      .from("event_quote_sections")
      .insert({ quote_id: quoteId, name: s.name, sort_order: index })
      .select()
      .single();
    if (res.error) throw new Error(res.error.message);
    if (s.items.length) {
      const { error } = await supabase.from("event_quote_items").insert(
        s.items.map((it, i) => ({ quote_id: quoteId as string, section_id: res.data.id, name: it.name, sort_order: i })),
      );
      if (error) throw new Error(error.message);
    }
  }

  if (option.charges.length) {
    const { error } = await supabase.from("event_quote_charges").insert(
      option.charges.map((c, i) => ({
        quote_id: quoteId as string,
        description: c.description,
        amount: Number(c.amount),
        sort_order: i,
      })),
    );
    if (error) throw new Error(error.message);
  }
}
