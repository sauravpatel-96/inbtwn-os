import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { eventsQuery } from "@/lib/queries";
import { buildAttention } from "@/lib/attention";
import { daysUntil, fmtDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, SectionHeading, StatusPill, SourceBadge, EmptyNote, TornCard } from "@/components/inbtwn/bits";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — INBTWN OS" },
      { name: "description", content: "What needs your attention today: stalled enquiries, missing details and upcoming events." },
      { property: "og:title", content: "Today — INBTWN OS" },
      { property: "og:description", content: "Your catering service board for today." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const events = useQuery(eventsQuery);
  const [showAll, setShowAll] = useState(false);

  if (events.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (events.isError) return <p className="font-mono text-[12px] text-s-lost">{events.error.message}</p>;

  const all = events.data ?? [];
  const enquiries = all.filter((e) => e.status === "enquiry").length;
  const quotes = all.filter((e) => e.status === "quoting" || e.status === "awaiting_client").length;
  const attention = buildAttention(all);
  const shown = showAll ? attention : attention.slice(0, 5);
  const upcoming = all.filter((e) => {
    const d = daysUntil(e.event_date);
    return d !== null && d >= 0 && d <= 7 && !["lost", "cancelled", "completed"].includes(e.status);
  });

  return (
    <div>
      <PageTitle title="Today" aside="service board" />

      <div className="mb-6 flex gap-3">
        <Link to="/events" search={{ f: "enquiries" }} className="relative torn flex-1 -rotate-1 bg-cream px-3.5 pb-3 pt-3.5 text-ink">
          <span className="tape absolute -top-1.5 left-4 h-3 w-10 rotate-[-4deg]" />
          <div className="font-display text-[34px] leading-none">{enquiries}</div>
          <div className="label-mono mt-1 text-ink-soft">Enquiries</div>
        </Link>
        <Link to="/events" search={{ f: "quotes" }} className="relative torn flex-1 rotate-1 bg-cream px-3.5 pb-3 pt-3.5 text-ink">
          <span className="tape absolute -top-1.5 right-4 h-3 w-10 rotate-[3deg]" />
          <div className="font-display text-[34px] leading-none text-flame">{quotes}</div>
          <div className="label-mono mt-1 text-ink-soft">In quotes</div>
        </Link>
      </div>

      <SectionHeading
        title="Needs attention"
        action={
          attention.length > 5 ? (
            <button onClick={() => setShowAll((s) => !s)} className="font-mono text-[11px] text-flame">
              {showAll ? "Show less" : `View all (${attention.length})`}
            </button>
          ) : null
        }
      />
      {shown.length === 0 ? (
        <EmptyNote>Nothing needs you right now. Nice.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((a, i) => (
            <Link
              key={a.event.id}
              to="/events/$eventId"
              params={{ eventId: a.event.id }}
              className={`torn flex flex-col gap-1 bg-cream px-3.5 py-3 text-ink ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="label-mono text-flame">Action</span>
                <SourceBadge source={a.event.source} />
              </div>
              <p className="font-semibold text-[14px] leading-tight">
                {a.event.title} · <span className="font-medium text-ink-soft">{a.reason}</span>
              </p>
              <p className="font-mono text-[11px] text-ink-soft">
                {fmtDate(a.event.event_date)}
                {a.event.guest_count != null ? ` · ${a.event.guest_count} guests` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-7">
        <SectionHeading title="Upcoming · next 7 days" />
        {upcoming.length === 0 ? (
          <EmptyNote>No events in the next seven days.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2.5">
            {upcoming.map((e) => (
              <Link
                key={e.id}
                to="/events/$eventId"
                params={{ eventId: e.id }}
                className="torn flex items-center gap-3 bg-cream px-3.5 py-3 text-ink"
              >
                <div className="w-[68px] shrink-0 font-display text-[18px] leading-none">{fmtDate(e.event_date)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[14px] leading-tight">{e.title}</p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {e.guest_count != null ? `${e.guest_count} guests` : "Guests TBC"}
                  </p>
                </div>
                <StatusPill status={e.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {all.length === 0 ? <DemoDataPrompt /> : null}
    </div>
  );
}

function DemoDataPrompt() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("load_demo_data");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demo data loaded — look for the Demo tag.");
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };
  return (
    <TornCard className="mt-8 border border-dashed border-ink/25 bg-panel px-4 py-4">
      <div className="font-display text-[20px] leading-none">Empty board</div>
      <p className="mt-2 text-sm text-ink-soft">
        Add your first enquiry with the <span className="font-semibold text-flame">+</span> button, or load
        three clearly-labelled sample events to explore.
      </p>
      <button onClick={load} disabled={busy} className="mt-3 font-mono text-[12px] text-flame underline">
        {busy ? "Loading…" : "Load demo data"}
      </button>
    </TornCard>
  );
}
