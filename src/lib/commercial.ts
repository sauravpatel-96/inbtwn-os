import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { EventStatus } from "./constants";

export type ProposalSectionRow = Database["public"]["Tables"]["event_proposal_sections"]["Row"];
export type ProposalItemRow = Database["public"]["Tables"]["event_proposal_items"]["Row"];
export type PricingOptionRow = Database["public"]["Tables"]["event_pricing_options"]["Row"];
export type PricingChargeRow = Database["public"]["Tables"]["event_pricing_charges"]["Row"];
export type OptionSectionRow = Database["public"]["Tables"]["event_pricing_option_sections"]["Row"];
export type CommercialNoteRow = Database["public"]["Tables"]["event_commercial_notes"]["Row"];

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------- Commercial stage (derived from the existing event status) ---------- */

export type CommercialStage = "enquiry" | "quoted" | "confirmed" | "completed" | "lost";

export const COMMERCIAL_STAGES: { value: CommercialStage; label: string; status: EventStatus }[] = [
  { value: "enquiry", label: "Enquiry", status: "enquiry" },
  { value: "quoted", label: "Quoted", status: "quoting" },
  { value: "confirmed", label: "Confirmed", status: "confirmed" },
  { value: "completed", label: "Completed", status: "completed" },
  { value: "lost", label: "Lost", status: "lost" },
];

export function stageOf(status: EventStatus): CommercialStage {
  switch (status) {
    case "enquiry":
      return "enquiry";
    case "quoting":
    case "awaiting_client":
      return "quoted";
    case "confirmed":
    case "in_progress":
      return "confirmed";
    case "completed":
      return "completed";
    default:
      return "lost";
  }
}

export const stageLabel = (s: CommercialStage) =>
  COMMERCIAL_STAGES.find((x) => x.value === s)?.label ?? s;

export const ACCESS_OPTIONS = ["yes", "no", "unknown"] as const;
export type AccessValue = (typeof ACCESS_OPTIONS)[number];
export const accessLabel = (v: string | null | undefined) =>
  v === "yes" ? "Yes" : v === "no" ? "No" : v === "unknown" ? "Unknown" : "Not set";

/* ---------- Queries ---------- */

export type ProposalSection = ProposalSectionRow & {
  items: (ProposalItemRow & { recipe: { id: string; name: string; category: string } | null })[];
};

export const proposalQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["proposal", eventId],
    queryFn: async () => {
      const sections = unwrap(
        await supabase
          .from("event_proposal_sections")
          .select("*")
          .eq("event_id", eventId)
          .order("sort_order")
          .order("created_at"),
      ) as ProposalSectionRow[];
      const items = unwrap(
        await supabase
          .from("event_proposal_items")
          .select("*, recipe:recipes(id, name, category)")
          .eq("event_id", eventId)
          .order("sort_order")
          .order("created_at"),
      ) as ProposalSection["items"];
      return sections.map((s) => ({ ...s, items: items.filter((i) => i.section_id === s.id) }));
    },
  });

export type PricingOption = PricingOptionRow & {
  charges: PricingChargeRow[];
  sections: OptionSectionRow[];
};

export const pricingQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["pricing", eventId],
    queryFn: async () => {
      const options = unwrap(
        await supabase
          .from("event_pricing_options")
          .select("*")
          .eq("event_id", eventId)
          .order("sort_order")
          .order("created_at"),
      ) as PricingOptionRow[];
      if (options.length === 0) return [] as PricingOption[];
      const ids = options.map((o) => o.id);
      const charges = unwrap(
        await supabase
          .from("event_pricing_charges")
          .select("*")
          .in("option_id", ids)
          .order("sort_order")
          .order("created_at"),
      ) as PricingChargeRow[];
      const links = unwrap(
        await supabase.from("event_pricing_option_sections").select("*").in("option_id", ids),
      ) as OptionSectionRow[];
      return options.map((o) => ({
        ...o,
        charges: charges.filter((c) => c.option_id === o.id),
        sections: links.filter((l) => l.option_id === o.id),
      }));
    },
  });

export const commercialNotesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["commercial-notes", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_commercial_notes")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
      ) as CommercialNoteRow[],
  });

/* ---------- Pricing maths ---------- */

export type OptionTotals = {
  guests: number;
  perHead: number;
  perHeadTotal: number;
  chargesTotal: number;
  subtotal: number;
  vat: number;
  paymentFee: number;
  total: number;
};

const num = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v) || 0);

/** Each option is an independent alternative offer — totals never combine across options. */
export function optionTotals(option: PricingOption, eventGuests: number | null): OptionTotals {
  const guests = option.guest_count_override ?? eventGuests ?? 0;
  const perHead = num(option.price_per_head);
  const perHeadTotal = guests * perHead;
  const chargesTotal = option.charges.reduce((s, c) => s + num(c.amount), 0);
  const subtotal = perHeadTotal + chargesTotal;
  const vat = option.vat_enabled ? subtotal * (num(option.vat_rate) / 100) : 0;
  const paymentFee = option.payment_fee_percentage
    ? (subtotal + vat) * (num(option.payment_fee_percentage) / 100)
    : 0;
  return { guests, perHead, perHeadTotal, chargesTotal, subtotal, vat, paymentFee, total: subtotal + vat + paymentFee };
}

export type BudgetVerdict = { text: string; tone: "ok" | "under" | "over" | "none"; range: string | null };

export function budgetVerdict(
  total: number,
  budgetMin: number | string | null | undefined,
  budgetMax: number | string | null | undefined,
  budget: number | string | null | undefined,
): BudgetVerdict {
  const min = budgetMin != null && budgetMin !== "" ? Number(budgetMin) : null;
  const max = budgetMax != null && budgetMax !== "" ? Number(budgetMax) : budget != null && budget !== "" ? Number(budget) : null;
  if (min == null && max == null) return { text: "No client budget recorded", tone: "none", range: null };
  const range =
    min != null && max != null ? `${min}–${max}` : min != null ? `from ${min}` : `up to ${max}`;
  if (max != null && total > max) return { text: "Above stated budget", tone: "over", range };
  if (min != null && total < min) return { text: "Below stated budget", tone: "under", range };
  return { text: "Within stated budget", tone: "ok", range };
}
