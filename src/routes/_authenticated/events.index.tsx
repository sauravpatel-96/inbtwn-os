import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { eventsQuery, type EventWithClient } from "@/lib/queries";
import { daysUntil, clientDisplayName } from "@/lib/format";
import { PageTitle, Chip, EmptyNote, TextInput } from "@/components/inbtwn/bits";
import { EventCard } from "@/components/inbtwn/EventCard";

const FILTERS = ["all", "enquiries", "quotes", "confirmed", "week", "completed"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  enquiries: "Enquiries",
  quotes: "Quotes",
  confirmed: "Confirmed",
  week: "This week",
  completed: "Completed",
};

export const Route = createFileRoute("/_authenticated/events/")({
  validateSearch: z.object({ f: z.enum(FILTERS).optional() }),
  head: () => ({
    meta: [
      { title: "Events — INBTWN OS" },
      { name: "description", content: "Every enquiry, quote and confirmed event on one board." },
      { property: "og:title", content: "Events — INBTWN OS" },
      { property: "og:description", content: "Search and filter your catering events." },
    ],
  }),
  component: EventsPage,
});

function matches(e: EventWithClient, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "enquiries":
      return e.status === "enquiry";
    case "quotes":
      return e.status === "quoting" || e.status === "awaiting_client";
    case "confirmed":
      return e.status === "confirmed" || e.status === "in_progress";
    case "week": {
      const d = daysUntil(e.event_date);
      return d !== null && d >= 0 && d <= 7 && !["lost", "cancelled"].includes(e.status);
    }
    case "completed":
      return e.status === "completed";
  }
}

function EventsPage() {
  const { f = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/events" });
  const events = useQuery(eventsQuery);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = events.data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((e) => {
      if (!matches(e, f)) return false;
      if (!needle) return true;
      const hay = [
        e.title,
        e.venue_name,
        e.venue_address,
        e.source_reference,
        e.client?.company_name,
        e.client?.first_name,
        e.client?.last_name,
        clientDisplayName(e.client),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [events.data, f, q]);

  return (
    <div>
      <PageTitle title="Events" aside={events.data ? `${events.data.length} on the board` : undefined} />

      <div className="torn mb-3 flex items-center gap-2.5 bg-cream px-3.5 py-1 -rotate-[0.4deg]">
        <span className="font-display text-[18px] leading-none text-ink-soft">?</span>
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, client, venue, ref…"
          className="border-0 bg-transparent px-0 font-mono text-[14px]"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <Chip key={key} active={f === key} onClick={() => navigate({ search: { f: key } })}>
            {FILTER_LABEL[key]}
          </Chip>
        ))}
      </div>

      {events.isLoading ? (
        <p className="font-mono text-[12px] text-ink-soft">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyNote>
          {events.data?.length ? "Nothing matches." : "No events yet."}{" "}
          <Link to="/events/new" className="text-flame underline">
            New enquiry
          </Link>
        </EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((e, i) => (
            <EventCard key={e.id} event={e} tilt={i % 2 ? 1 : -1} />
          ))}
        </div>
      )}
    </div>
  );
}
