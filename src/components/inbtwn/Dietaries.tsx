import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dietariesQuery } from "@/lib/queries";
import { DIETARY_TYPES, DIETARY_SEVERITIES } from "@/lib/constants";
import { SectionHeading, Chip, TextInput, SelectInput, GhostButton, PrimaryButton } from "./bits";
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

export function Dietaries({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const list = useQuery(dietariesQuery(eventId));
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState(DIETARY_TYPES[0] ?? "Vegetarian");
  const [count, setCount] = useState("");
  const [severity, setSeverity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["dietaries", eventId] });

  const add = async () => {
    if (count && !/^\d+$/.test(count)) {
      toast.error("Guest count must be a whole number");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("event_dietaries").insert({
      event_id: eventId,
      type,
      guest_count: count ? Number(count) : null,
      severity: severity || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCount("");
    setNotes("");
    setSeverity("");
    setAdding(false);
    refresh();
  };

  const toggleConfirmed = async (id: string, confirmed: boolean) => {
    const { error } = await supabase.from("event_dietaries").update({ confirmed: !confirmed }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };

  const remove = async () => {
    if (!removeId) return;
    const { error } = await supabase.from("event_dietaries").delete().eq("id", removeId);
    setRemoveId(null);
    if (error) toast.error(error.message);
    refresh();
  };

  return (
    <div>
      <SectionHeading
        title="Dietaries"
        action={
          <button onClick={() => setAdding((s) => !s)} className="font-mono text-[11px] text-flame">
            {adding ? "Cancel" : "+ Add"}
          </button>
        }
      />
      <div className="torn bg-cream px-4 py-2">
        {list.data?.length ? (
          list.data.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-ink/10 py-2.5 last:border-0">
              <button
                onClick={() => toggleConfirmed(d.id, d.confirmed)}
                aria-label={d.confirmed ? "Mark unconfirmed" : "Mark confirmed"}
                className={`grid size-6 shrink-0 place-items-center rounded-sm border ${
                  d.confirmed ? "border-s-conf bg-s-conf text-cream" : "border-ink/30"
                }`}
              >
                {d.confirmed ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.type}</span>
                  {d.severity ? (
                    <span className={`label-mono ${d.severity === "severe" ? "text-s-lost" : "text-ink-soft"}`}>{d.severity}</span>
                  ) : null}
                </div>
                {d.notes ? <p className="truncate font-mono text-[11px] text-ink-soft">{d.notes}</p> : null}
              </div>
              {d.guest_count != null ? <span className="font-display text-[18px]">{d.guest_count}</span> : null}
              <button onClick={() => setRemoveId(d.id)} className="font-mono text-[11px] text-ink-soft" aria-label="Remove">
                ✕
              </button>
            </div>
          ))
        ) : (
          <p className="py-2 font-mono text-[11px] text-ink-soft">No dietary requirements recorded.</p>
        )}
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-3 rounded-sm border border-ink/15 bg-panel p-3">
          <div className="flex flex-wrap gap-2">
            {DIETARY_TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput type="number" inputMode="numeric" min={0} placeholder="Guests" value={count} onChange={(e) => setCount(e.target.value)} />
            <SelectInput value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Severity</option>
              {DIETARY_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </div>
          <TextInput placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <GhostButton type="button" onClick={() => setAdding(false)}>
              Cancel
            </GhostButton>
            <PrimaryButton type="button" onClick={add} disabled={busy}>
              {busy ? "Adding…" : "Add dietary"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      <AlertDialog open={Boolean(removeId)} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">Remove dietary?</AlertDialogTitle>
            <AlertDialogDescription>This removes the requirement from the event. You can add it again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-s-lost text-cream">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
