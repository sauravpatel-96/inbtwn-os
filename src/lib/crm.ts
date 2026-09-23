import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { financeTotals, round2 } from "./finance";
import { deriveEvent, type EventDerived, type TodayData } from "./today";
import type { ContactRow } from "./queries";

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

export const contactName = (c: Pick<ContactRow, "first_name" | "last_name">): string =>
  [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Unnamed contact";

export const primaryContactOf = (contacts: ContactRow[] | null | undefined): ContactRow | null =>
  (contacts ?? []).find((c) => c.active && c.is_primary) ?? null;

/* ------------------------------------------------------------------ */
/* Relationship metrics                                                */
/* ------------------------------------------------------------------ */

export type ClientMetrics = {
  all: EventDerived[];
  upcoming: EventDerived[];
  past: EventDerived[];
  totalCount: number;
  upcomingCount: number;
  completedCount: number;
  /** Direct bookings only — the authoritative agreed value where known. */
  agreed: number;
  agreedUnknown: number;
  received: number;
  outstanding: number;
  /** Platform bookings are settled by the platform, never by the client quote. */
  platformCount: number;
  payoutReceived: number;
  payoutExpected: number;
  payoutUnknown: number;
};

const isCompleted = (d: EventDerived) => d.event.status === "completed";
const isLive = (d: EventDerived) =>
  d.event.status !== "lost" && d.event.status !== "cancelled" && d.event.status !== "completed";

/**
 * All client-level money reuses the authoritative per-event Finance rules.
 * A client-facing platform quote is never treated as INBTWN revenue.
 */
export function clientMetrics(clientId: string, data: TodayData, today = new Date()): ClientMetrics {
  const all = data.events
    .filter((e) => e.client_id === clientId)
    .map((e) => deriveEvent(e, data, today));

  const upcoming = all
    .filter((d) => !d.past && isLive(d))
    .sort((a, b) => (a.event.event_date ?? "9999").localeCompare(b.event.event_date ?? "9999"));
  const past = all
    .filter((d) => !upcoming.includes(d))
    .sort((a, b) => (b.event.event_date ?? "").localeCompare(a.event.event_date ?? ""));

  let agreed = 0;
  let agreedUnknown = 0;
  let received = 0;
  let outstanding = 0;
  let platformCount = 0;
  let payoutReceived = 0;
  let payoutExpected = 0;
  let payoutUnknown = 0;

  for (const d of all) {
    if (d.event.status === "lost" || d.event.status === "cancelled") continue;
    const terms = data.terms.find((t) => t.event_id === d.event.id) ?? null;
    const payments = data.payments.filter((p) => p.event_id === d.event.id);
    const totals = financeTotals({ terms, agreedTotal: d.agreed, payments, platform: d.platform });

    if (d.platform) {
      platformCount += 1;
      if (d.expectedPayout === null) payoutUnknown += 1;
      else if (d.payoutReceived) payoutReceived += d.expectedPayout;
      else payoutExpected += d.expectedPayout;
      received += totals.received;
      continue;
    }

    if (d.agreed === null) agreedUnknown += 1;
    else agreed += d.agreed;
    received += totals.received;
    outstanding += totals.outstanding ?? 0;
  }

  return {
    all,
    upcoming,
    past,
    totalCount: all.length,
    upcomingCount: upcoming.length,
    completedCount: all.filter(isCompleted).length,
    agreed: round2(agreed),
    agreedUnknown,
    received: round2(received),
    outstanding: round2(outstanding),
    platformCount,
    payoutReceived: round2(payoutReceived),
    payoutExpected: round2(payoutExpected),
    payoutUnknown,
  };
}

/* ------------------------------------------------------------------ */
/* Duplicate detection (advisory only — never merges anything)          */
/* ------------------------------------------------------------------ */

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export type DuplicateCandidate = { id: string; label: string; reason: string };

export function findDuplicateClients(
  candidate: { company_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null },
  existing: {
    id: string;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  }[],
  excludeId?: string,
): DuplicateCandidate[] {
  const email = norm(candidate.email);
  const phone = digits(candidate.phone);
  const name = norm(
    candidate.company_name || [candidate.first_name, candidate.last_name].filter(Boolean).join(" "),
  );
  const out: DuplicateCandidate[] = [];
  for (const c of existing) {
    if (excludeId && c.id === excludeId) continue;
    const label = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client";
    const otherName = norm(c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" "));
    let reason: string | null = null;
    if (email && norm(c.email) === email) reason = "same email";
    else if (phone.length >= 7 && digits(c.phone).endsWith(phone.slice(-9))) reason = "same phone";
    else if (name.length >= 4 && otherName && (otherName === name || otherName.includes(name) || name.includes(otherName)))
      reason = "similar name";
    if (reason) out.push({ id: c.id, label, reason });
  }
  return out.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const clientContactsQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["contacts", clientId],
    queryFn: async () =>
      unwrap<ContactRow[]>(
        await supabase
          .from("client_contacts")
          .select("*")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .order("created_at"),
      ),
  });

export const allContactsQuery = queryOptions({
  queryKey: ["contacts"],
  queryFn: async () =>
    unwrap<ContactRow[]>(await supabase.from("client_contacts").select("*").order("created_at")),
});
