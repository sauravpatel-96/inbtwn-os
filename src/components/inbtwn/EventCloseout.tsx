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

/**
 * Close-out is an organisational state only. Closing never creates a payment,
 * settles an invoice, clears outstanding money or invents a cost or payout.
 */
export function EventCloseout({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const data = useQuery(todayDataQuery);
  const [confirming, setConfirming] = useState(false);
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
    toast.success(state === "closed" ? "Event closed" : "Event reopened");
    refresh();
  };

  return (
    <div>
      <SectionHeading title="Close-out" />
      <div className="border border-ink/15 bg-cream px-4 py-3">
        <ul className="flex flex-col gap-1.5">
          {closeout.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-[13px] leading-snug">
              <span className={`mt-[1px] font-mono ${c.ok ? "text-s-conf" : "text-flame"}`}>{c.ok ? "✓" : "!"}</span>
              <span className={c.ok ? "text-ink" : "text-ink"}>{c.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-ink/10 pt-3">
          <div className="label-mono text-ink-soft">Status</div>
          <div className="font-display text-[20px] leading-none">
            {closeout.closed ? "Closed" : closeout.ready ? "Ready to close" : "Not ready to close"}
          </div>
          <p className="mt-1 font-mono text-[10px] text-ink-soft">
            Closing is an admin state only — money, invoices, payments and costs stay exactly as recorded.
          </p>
          <div className="mt-3">
            {closeout.closed ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setState("open")}
                className="tap rounded-sm border border-ink/20 bg-paper px-4 py-2 font-mono text-[12px] text-ink"
              >
                Reopen event
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="tap rounded-sm bg-ink px-4 py-2 font-mono text-[12px] text-cream"
              >
                Close event
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">
              {closeout.ready ? "Close event?" : "This event still has unfinished items"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {closeout.ready ? (
                  <p>Everything recorded for this event is complete. Close event?</p>
                ) : (
                  <>
                    <ul className="ml-4 list-disc">
                      {closeout.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      You can still close the event, but these records will remain unchanged.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{closeout.ready ? "Not yet" : "Keep open"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ink text-cream"
              onClick={() => {
                setState("closed");
                setConfirming(false);
              }}
            >
              {closeout.ready ? "Close event" : "Close anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
