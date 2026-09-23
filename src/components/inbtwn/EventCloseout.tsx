import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayDataQuery, deriveEvent } from "@/lib/today";
import { buildCloseout } from "@/lib/closeout";
import { SectionHeading } from "@/components/inbtwn/bits";
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

/** Money snapshot supplied by Finance — never recalculated here. */
export type CloseoutSummary = {
  revenue: string;
  received: string;
  outstanding: string;
  recordedCosts: string;
  recordedProfit: string;
  recordedMargin: string;
  /** True when every relevant cost (job costs and ingredient costs) is known. */
  costingComplete: boolean;
};

/**
 * Close-out is an organisational state only. Closing never creates a payment,
 * settles an invoice, clears outstanding money or invents a cost or payout.
 */
export function EventCloseout({ eventId, summary }: { eventId: string; summary?: CloseoutSummary }) {
  const qc = useQueryClient();
  const data = useQuery(todayDataQuery);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [busy, setBusy] = useState(false);

  const closeout = useMemo(() => {
    if (!data.data) return null;
    const row = data.data.events.find((e) => e.id === eventId);
    if (!row) return null;
    return buildCloseout(deriveEvent(row, data.data, new Date()), data.data);
  }, [data.data, eventId]);

  if (data.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!closeout) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["today-data"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const setState = async (state: "open" | "closed") => {
    setBusy(true);
    const { error } = await supabase
      .from("events")
      .update({ closeout_state: state, closed_at: state === "closed" ? new Date().toISOString() : null })
      .eq("id", eventId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(state === "closed" ? "Close-out complete" : "Close-out reopened");
    refresh();
  };

  const warningLine = closeout.warnings.join(" · ");

  return (
    <div>
      <SectionHeading title="Event close-out" />
      <div className="border border-ink/15 bg-cream px-4 py-3">
        <div className="label-mono text-ink-soft">Close-out</div>
        <div className="font-display text-[24px] leading-none">{closeout.closed ? "COMPLETE" : "OPEN"}</div>

        {summary ? (
          <div className="mt-3 border-t border-ink/10 pt-2">
            <Row label="Revenue" value={summary.revenue} />
            <Row label="Received" value={summary.received} />
            <Row label="Outstanding" value={summary.outstanding} />
            <Row label="Recorded actual costs" value={summary.recordedCosts} />
            <Row label={summary.costingComplete ? "Actual profit" : "Recorded profit"} value={summary.recordedProfit} />
            <Row label={summary.costingComplete ? "Actual margin" : "Recorded margin"} value={summary.recordedMargin} />
            {!summary.costingComplete ? (
              <p className="mt-2 font-mono text-[10px] text-flame">
                Profit incomplete — ingredient costs are missing.
              </p>
            ) : null}
          </div>
        ) : null}

        <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink/10 pt-3">
          {closeout.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-[13px] leading-snug">
              <span className={`mt-[1px] font-mono ${c.ok ? "text-s-conf" : "text-flame"}`}>{c.ok ? "✓" : "!"}</span>
              <span className="text-ink">{c.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="font-mono text-[10px] text-ink-soft">
            Close-out is an admin state only — money, invoices, payments and costs stay exactly as recorded.
          </p>
          <div className="mt-3">
            {closeout.closed ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setReopening(true)}
                className="tap border border-ink/20 bg-paper px-4 py-2 font-mono text-[12px] text-ink"
              >
                Reopen close-out
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="tap bg-ink px-4 py-2 font-mono text-[12px] text-cream"
              >
                Complete close-out
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">
              {closeout.ready ? "Complete close-out?" : "Close this event with unresolved items?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {closeout.ready ? (
                  <p>Everything recorded for this event is complete.</p>
                ) : (
                  <>
                    <p>{warningLine}</p>
                    <p className="mt-2">
                      Closing the event will not mark invoices as paid, remove outstanding balances, change payments, or
                      alter costs.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ink text-cream"
              onClick={() => {
                void setState("closed");
                setConfirming(false);
              }}
            >
              {closeout.ready ? "Complete close-out" : "Close anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reopening} onOpenChange={(o) => !o && setReopening(false)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">Reopen close-out?</AlertDialogTitle>
            <AlertDialogDescription>
              This only returns the admin state to open. No invoices, payments, costs or event details change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ink text-cream"
              onClick={() => {
                void setState("open");
                setReopening(false);
              }}
            >
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5 last:border-0">
      <span className="label-mono text-ink-soft">{label}</span>
      <span className="text-right font-mono text-[13px]">{value}</span>
    </div>
  );
}
