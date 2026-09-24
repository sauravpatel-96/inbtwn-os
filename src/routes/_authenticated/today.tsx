import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayDataQuery, buildToday, upcomingEvents, opsSummary, moneySummary, prepSummary, eventDaySummary, staffLine, kitTodayLine, type AttentionItem, type Severity, type PrepEventGroup } from "@/lib/today";
import { fmtMinutes, assignmentLabel } from "@/lib/prep";
import { fmtClock } from "@/lib/runsheet";
import { fmtDate, fmtMoney } from "@/lib/format";
import { statusLabel } from "@/lib/constants";
import { PageTitle, SectionHeading, StatusPill, EmptyNote } from "@/components/inbtwn/bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — INBTWN OS" },
      { name: "description", content: "What needs your attention today: overdue money, upcoming events and outstanding operational work." },
      { property: "og:title", content: "Today — INBTWN OS" },
      { property: "og:description", content: "Your catering command centre for today." },
    ],
  }),
  component: TodayPage,
});

const SEV_CLASS: Record<Severity, string> = {
  high: "text-s-lost",
  medium: "text-flame",
  low: "text-ink-soft",
};

function TodayPage() {
  const data = useQuery(todayDataQuery);
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [completing, setCompleting] = useState<AttentionItem | null>(null);

  const markCompleted = async (item: AttentionItem) => {
    const { error } = await supabase
      .from("events")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", item.eventId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${item.eventTitle} marked completed`);
    qc.invalidateQueries({ queryKey: ["today-data"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const model = useMemo(() => {
    if (!data.data) return null;
    const { attention, derived } = buildToday(data.data);
    return {
      attention,
      derived,
      upcoming: upcomingEvents(derived),
      ops: opsSummary(derived),
      money: moneySummary(derived),
      prep: prepSummary(derived, data.data),
      eventDay: eventDaySummary(derived, data.data),
    };
  }, [data.data]);

  if (data.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (data.isError) return <p className="font-mono text-[12px] text-s-lost">{(data.error as Error).message}</p>;
  if (!model) return null;

  const { attention, upcoming, ops, money, prep, eventDay } = model;
  const shown = showAll ? attention : attention.slice(0, 6);

  return (
    <div>
      <PageTitle title="Today" aside={format(new Date(), "EEE d MMM")} />


      {eventDay.today.length > 0 ? (
        <div className="mb-7">
          <SectionHeading title="Event day" />
          <div className="flex flex-col gap-2">
            {eventDay.today.map((c) => (
              <div key={c.eventId} className="border border-ink/15 bg-cream">
                <div className="px-4 pt-3 font-display text-[20px] leading-none">{c.title}</div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2 font-mono text-[11px]">
                  <div><span className="text-ink-soft">Depart </span>{fmtClock(c.anchors.departure)}</div>
                  <div><span className="text-ink-soft">Arrive </span>{fmtClock(c.anchors.arrival)}</div>
                  <div><span className="text-ink-soft">Service </span><span className="text-flame">{fmtClock(c.anchors.service)}</span></div>
                </div>
                {c.staffCalls.length > 0 ? (
                  <div className="border-t border-ink/10 px-4 py-2 font-mono text-[11px]">
                    {c.staffCalls.map((sc, i) => (
                      <div key={i} className={sc.unassigned ? "text-flame" : ""}>
                        <span className="font-semibold">{sc.unassigned ? `${sc.name} (unassigned)` : sc.name}</span>
                        <span className="text-ink-soft"> · Staff call {sc.time}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="border-t border-ink/10 px-4 py-2.5">
                  {c.total === 0 ? (
                    <span className="font-mono text-[11px] text-ink-soft">No run sheet generated.</span>
                  ) : c.next ? (
                    <div className="flex items-baseline gap-3">
                      <span className="label-mono text-ink-soft">Next</span>
                      <span className="font-display text-[22px] leading-none">{fmtClock(c.next.time)}</span>
                      <span className="font-semibold">{c.next.name}</span>
                    </div>
                  ) : (
                    <span className="font-mono text-[11px] text-s-conf">Run sheet complete</span>
                  )}
                </div>
                <Link
                  to="/events/$eventId"
                  params={{ eventId: c.eventId }}
                  search={{ s: "plan" }}
                  className="block border-t border-ink/10 px-4 py-2.5 font-mono text-[11px] text-flame"
                >
                  View Run Sheet →{c.total ? ` (${c.remaining} left)` : ""}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <SectionHeading
        title="Needs attention"
        action={
          attention.length > 6 ? (
            <button onClick={() => setShowAll((s) => !s)} className="font-mono text-[11px] text-flame">
              {showAll ? "Show less" : `View all (${attention.length})`}
            </button>
          ) : null
        }
      />
      {shown.length === 0 ? (
        <EmptyNote>Nothing urgent needs attention.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shown.map((a) => (
            <AlertRow key={a.id} item={a} onComplete={() => setCompleting(a)} />
          ))}
        </div>
      )}

      <div className="mt-7">
        <SectionHeading title="Money" />
        <div className="border border-ink/15 bg-cream">
          <MoneyRow label="Overdue" value={fmtMoney(money.overdue)} tone={money.overdue > 0 ? "alert" : undefined} />
          <MoneyRow
            label="Outstanding"
            value={fmtMoney(money.outstanding)}
            note={money.outstandingIncomplete ? "some bookings have no agreed value" : undefined}
          />
          <MoneyRow
            label="Platform payouts"
            value={money.payouts > 0 ? fmtMoney(money.payouts) : money.payoutsIncomplete ? "Not yet known" : fmtMoney(0)}
            note={money.payouts > 0 && money.payoutsIncomplete ? "some payouts not yet known" : undefined}
          />
          <MoneyRow label="Confirmed this month" value={fmtMoney(money.confirmedThisMonth)} last />
        </div>
      </div>

      <div className="mt-7">
        <SectionHeading title="Operations · next 7 days" />
        {eventDay.missing.map((m) => (
          <Link
            key={m.eventId}
            to="/events/$eventId"
            params={{ eventId: m.eventId }}
            search={{ s: "plan" }}
            className="mb-1.5 flex items-center justify-between border border-ink/15 bg-cream px-4 py-2.5 font-mono text-[11px]"
          >
            <span><span className="font-semibold text-ink">{m.title}</span> <span className="text-ink-soft">· run sheet not generated</span></span>
            <span className="text-flame">Plan →</span>
          </Link>
        ))}
        {prep.groups.length > 0 ? (
          <div className="mb-1.5 flex flex-col gap-1.5">
            {prep.groups.map((g) => (
              <PrepGroup key={g.eventId} group={g} />
            ))}
          </div>
        ) : null}
        {ops.shoppingItems === 0 && ops.packingItems === 0 && ops.recipeGaps === 0 ? (
          prep.groups.length > 0 ? null : (
          <EmptyNote>Nothing outstanding in the next 7 days.</EmptyNote>
          )
        ) : (
          <div className="border border-ink/15 bg-cream">
            {ops.shoppingItems > 0 ? (
              <OpsRow
                label="Shopping"
                detail={`${ops.shoppingItems} items remaining across ${ops.shoppingEvents} event${ops.shoppingEvents === 1 ? "" : "s"}`}
              />
            ) : null}
            {ops.packingItems > 0 ? (
              <OpsRow
                label="Packing"
                detail={`${ops.packingItems} items remaining across ${ops.packingEvents} event${ops.packingEvents === 1 ? "" : "s"}`}
              />
            ) : null}
            {ops.recipeGaps > 0 ? (
              <OpsRow
                label="Menu"
                detail={`${ops.recipeGaps} dishes need recipes across ${ops.recipeGapEvents} event${ops.recipeGapEvents === 1 ? "" : "s"}`}
                last
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-7">
        <SectionHeading title="Upcoming · next 7 days" />
        {upcoming.length === 0 ? (
          <EmptyNote>No events in the next seven days.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-1.5">
            {upcoming.map((d) => (
              <Link
                key={d.event.id}
                to="/events/$eventId"
                params={{ eventId: d.event.id }}
                className="flex items-center gap-3 border border-ink/15 bg-cream px-3 py-2.5 text-ink"
              >
                <div className="w-[62px] shrink-0 label-mono text-ink-soft">{fmtDate(d.event.event_date)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[14px] leading-tight">{d.event.title}</p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {d.event.guest_count != null ? `${d.event.guest_count} guests` : "Guests TBC"} ·{" "}
                    {statusLabel(d.event.status)}
                  </p>
                  {data.data && staffLine(d.event.id, data.data) ? (
                    <p className="font-mono text-[11px] text-ink-soft">{staffLine(d.event.id, data.data)}</p>
                  ) : null}
                </div>
                <StatusPill status={d.event.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {model.derived.length === 0 ? <DemoDataPrompt /> : null}
      {model.derived.some((d) => d.event.is_demo) ? <RemoveDemoLink /> : null}

      <AlertDialog open={Boolean(completing)} onOpenChange={(o) => !o && setCompleting(null)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">
              Mark {completing?.eventTitle} as completed?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This means the catering event has taken place. Outstanding payments and unfinished admin can still be
              managed afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ink text-cream"
              onClick={() => {
                if (completing) markCompleted(completing);
                setCompleting(null);
              }}
            >
              Mark completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AlertRow({ item, onComplete }: { item: AttentionItem; onComplete: () => void }) {
  const dot = (
    <span
      className={`mt-[3px] h-2 w-2 shrink-0 ${item.severity === "high" ? "bg-s-lost" : item.severity === "medium" ? "bg-flame" : "bg-ink/30"}`}
    />
  );
  const body = (
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold text-[14px] leading-tight">{item.eventTitle}</p>
      <p className={`font-mono text-[11px] ${SEV_CLASS[item.severity]}`}>{item.message}</p>
      {item.secondary ? <p className="font-mono text-[11px] text-ink-soft">{item.secondary}</p> : null}
    </div>
  );

  if (item.action === "complete") {
    return (
      <div className="flex items-center gap-3 border border-ink/15 bg-cream px-3 py-2.5 text-ink">
        {dot}
        <Link to="/events/$eventId" params={{ eventId: item.eventId }} className="min-w-0 flex-1 text-ink">
          {body}
        </Link>
        <button
          type="button"
          onClick={onComplete}
          className="tap shrink-0 rounded-sm bg-ink px-3 py-2 label-mono text-cream"
        >
          Mark completed →
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: item.eventId }}
      search={{ s: item.section }}
      className="flex items-center gap-3 border border-ink/15 bg-cream px-3 py-2.5 text-ink"
    >
      {dot}
      {body}
      <span className="label-mono shrink-0 text-ink-soft">{item.actionLabel} →</span>
    </Link>
  );
}

function MoneyRow({
  label,
  value,
  note,
  tone,
  last,
}: {
  label: string;
  value: string | null;
  note?: string | undefined;
  tone?: "alert" | undefined;
  last?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 px-3 py-2.5 ${last ? "" : "border-b border-ink/10"}`}>
      <div className="min-w-0">
        <div className="label-mono text-ink-soft">{label}</div>
        {note ? <div className="font-mono text-[10px] text-ink-soft">{note}</div> : null}
      </div>
      <div className={`font-display text-[20px] leading-none ${tone === "alert" ? "text-s-lost" : "text-ink"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function OpsRow({ label, detail, last }: { label: string; detail: string; last?: boolean }) {
  return (
    <div className={`px-3 py-2.5 ${last ? "" : "border-b border-ink/10"}`}>
      <div className="label-mono text-ink-soft">{label}</div>
      <div className="font-mono text-[12px] text-ink">{detail}</div>
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
    qc.invalidateQueries({ queryKey: ["today-data"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };
  return (
    <div className="mt-8 border border-dashed border-ink/25 bg-panel px-4 py-4">
      <div className="font-display text-[20px] leading-none">Empty board</div>
      <p className="mt-2 text-sm text-ink-soft">
        Add your first enquiry with the <span className="font-semibold text-flame">+</span> button, or load
        three clearly-labelled sample events to explore.
      </p>
      <button onClick={load} disabled={busy} className="mt-3 font-mono text-[12px] text-flame underline">
        {busy ? "Loading…" : "Load demo data"}
      </button>
    </div>
  );
}

function RemoveDemoLink() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = async () => {
    const { error } = await supabase.rpc("remove_demo_data");
    setConfirm(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demo data removed");
    qc.invalidateQueries({ queryKey: ["today-data"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };
  return (
    <div className="mt-10 text-center font-mono text-[11px] text-ink-soft">
      {confirm ? (
        <span>
          Remove all Demo-tagged clients and events?{" "}
          <button onClick={remove} className="text-s-lost underline">
            Yes, remove
          </button>{" "}
          ·{" "}
          <button onClick={() => setConfirm(false)} className="underline">
            Keep
          </button>
        </span>
      ) : (
        <button onClick={() => setConfirm(true)} className="underline">
          Remove demo data
        </button>
      )}
    </div>
  );
}

function PrepGroup({ group: g }: { group: PrepEventGroup }) {
  const tasks = [...g.overdue, ...g.dueToday, ...g.upcoming];
  const shown = tasks.slice(0, 4);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: g.eventId }}
      search={{ s: "plan" }}
      className="block border border-ink/15 bg-cream px-3 py-2.5 text-ink"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold text-[14px] leading-tight">{g.title}</span>
        <span className="shrink-0 label-mono text-ink-soft">View Plan →</span>
      </div>
      <p className={`font-mono text-[11px] ${g.overdue.length ? "text-flame" : "text-ink-soft"}`}>
        Prep · {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        {g.overdue.length ? ` · ${g.overdue.length} overdue` : ""}
        {fmtMinutes(g.minutes) ? ` · approx. ${fmtMinutes(g.minutes)}` : ""}
      </p>
      <div className="mt-1.5 flex flex-col gap-1">
        {shown.map((t) => {
          const late = t.scheduled_date !== null && t.scheduled_date < todayKey;
          return (
            <div key={t.id} className="flex gap-3">
              <span className={`w-[62px] shrink-0 label-mono ${late ? "text-flame" : "text-ink-soft"}`}>
                {t.scheduled_date === todayKey ? "Today" : fmtDate(t.scheduled_date)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-tight">{t.name}</p>
                <p className="font-mono text-[10px] text-ink-soft">
                  {[fmtMinutes(t.approximate_minutes), assignmentLabel(t.assignment)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          );
        })}
        {tasks.length > shown.length ? (
          <p className="font-mono text-[11px] text-ink-soft">+{tasks.length - shown.length} more</p>
        ) : null}
      </div>
    </Link>
  );
}
