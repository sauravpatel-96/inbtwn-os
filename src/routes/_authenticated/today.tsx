import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayDataQuery, buildToday, upcomingEvents, opsSummary, moneySummary, type AttentionItem, type Severity } from "@/lib/today";
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
  const [showAll, setShowAll] = useState(false);

  const model = useMemo(() => {
    if (!data.data) return null;
    const { attention, derived } = buildToday(data.data);
    return {
      attention,
      derived,
      upcoming: upcomingEvents(derived),
      ops: opsSummary(derived),
      money: moneySummary(derived),
    };
  }, [data.data]);

  if (data.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (data.isError) return <p className="font-mono text-[12px] text-s-lost">{(data.error as Error).message}</p>;
  if (!model) return null;

  const { attention, upcoming, ops, money } = model;
  const shown = showAll ? attention : attention.slice(0, 6);

  return (
    <div>
      <PageTitle title="Today" aside={format(new Date(), "EEE d MMM")} />

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
            <AlertRow key={a.id} item={a} />
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
        {ops.shoppingItems === 0 && ops.packingItems === 0 && ops.recipeGaps === 0 ? (
          <EmptyNote>Nothing outstanding in the next 7 days.</EmptyNote>
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
                </div>
                <StatusPill status={d.event.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {model.derived.length === 0 ? <DemoDataPrompt /> : null}
      {model.derived.some((d) => d.event.is_demo) ? <RemoveDemoLink /> : null}
    </div>
  );
}

function AlertRow({ item }: { item: AttentionItem }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: item.eventId }}
      search={{ s: item.section }}
      className="flex items-center gap-3 border border-ink/15 bg-cream px-3 py-2.5 text-ink"
    >
      <span className={`mt-[3px] h-2 w-2 shrink-0 ${item.severity === "high" ? "bg-s-lost" : item.severity === "medium" ? "bg-flame" : "bg-ink/30"}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[14px] leading-tight">{item.eventTitle}</p>
        <p className={`font-mono text-[11px] ${SEV_CLASS[item.severity]}`}>{item.message}</p>
      </div>
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
