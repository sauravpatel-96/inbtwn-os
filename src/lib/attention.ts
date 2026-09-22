import type { EventWithClient } from "./queries";
import { daysSince, daysUntil } from "./format";
import { ACTIVE_STATUSES } from "./constants";

export type Attention = { event: EventWithClient; reason: string; urgency: number };

const STALE_ENQUIRY_DAYS = 3;
const UPCOMING_WINDOW = 14;

/** Reasons an event needs attention (Build 1 basic logic). */
export function attentionFor(event: EventWithClient): string[] {
  const out: string[] = [];
  if (!ACTIVE_STATUSES.includes(event.status)) return out;
  const until = daysUntil(event.event_date);
  const upcoming = until !== null && until >= 0 && until <= UPCOMING_WINDOW;

  if (event.status === "enquiry" && daysSince(event.created_at) >= STALE_ENQUIRY_DAYS) {
    out.push(`Enquiry not progressed for ${daysSince(event.created_at)} days`);
  }
  if (upcoming && !event.client_id) out.push("Upcoming event has no client");
  if (upcoming && !event.service_time) out.push("Upcoming event missing service time");
  if (upcoming && event.guest_count == null) out.push("Upcoming event has no guest count");
  if (event.status === "confirmed" && until !== null && until >= 0 && until <= 7) {
    out.push(until === 0 ? "Confirmed event is today" : `Confirmed event in ${until} day${until === 1 ? "" : "s"}`);
  }
  return out;
}

export function buildAttention(events: EventWithClient[]): Attention[] {
  const list: Attention[] = [];
  for (const e of events) {
    const reasons = attentionFor(e);
    if (!reasons.length) continue;
    const until = daysUntil(e.event_date);
    const urgency = until === null ? 50 : Math.max(0, until);
    list.push({ event: e, reason: reasons[0], urgency });
  }
  return list.sort((a, b) => a.urgency - b.urgency);
}
