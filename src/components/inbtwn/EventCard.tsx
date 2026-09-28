import { Link } from "@tanstack/react-router";
import type { EventWithClient } from "@/lib/queries";
import { dateParts, fmtMoney, clientDisplayName } from "@/lib/format";
import { StatusPill, SourceBadge, DemoTag, ArchivedTag } from "./bits";
import { attentionFor } from "@/lib/attention";

export function EventCard({ event, tilt = 0 }: { event: EventWithClient; tilt?: -1 | 0 | 1 }) {
  const dp = dateParts(event.event_date);
  const money = fmtMoney(event.budget, event.currency);
  const issues = attentionFor(event);
  const details = [
    event.guest_count != null ? `${event.guest_count} guests` : null,
    event.cuisine || event.service_style || null,
  ].filter(Boolean);
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className={`torn block bg-cream px-3.5 py-3.5 text-ink active:bg-panel ${
        ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={event.status} />
          <SourceBadge source={event.source} />
          {event.is_demo ? <DemoTag /> : null}
          {event.archived_at ? <ArchivedTag /> : null}
        </div>
        <div className="flex items-center gap-2">
          {issues.length > 0 ? (
            <span className="size-2 rounded-full bg-flame" title={issues[0]} aria-label="Needs attention" />
          ) : null}
          {money ? <span className="font-mono text-[11px] text-ink-soft">{money}</span> : null}
        </div>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="w-[52px] shrink-0 font-display text-[24px] leading-[0.9]">
          {dp ? (
            <>
              {dp.dow}
              <br />
              <span className="text-flame">{dp.day}</span> {dp.mon}
            </>
          ) : (
            <span className="text-ink-soft">TBC</span>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="truncate font-semibold text-[15px] leading-tight">{event.title}</p>
          {details.length ? (
            <p className="mt-1 truncate font-mono text-[11px] text-ink-soft">{details.join(" · ")}</p>
          ) : null}
          <p className="truncate font-mono text-[11px] text-ink-soft">
            {event.venue_name || event.venue_address || clientDisplayName(event.client)}
          </p>
        </div>
      </div>
    </Link>
  );
}
