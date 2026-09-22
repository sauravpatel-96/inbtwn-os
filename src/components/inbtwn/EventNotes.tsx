import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextArea, SelectInput, PrimaryButton, EmptyNote } from "@/components/inbtwn/bits";
import { commercialNotesQuery } from "@/lib/commercial";

const CATEGORIES = ["General", "Dietary", "Equipment", "Access", "Client request"];

export function EventNotes({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const notes = useQuery(commercialNotesQuery(eventId));
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const text = body.trim();
    if (!text) return void toast.error("Write the note first");
    setBusy(true);
    const { error } = await supabase
      .from("event_commercial_notes")
      .insert({ event_id: eventId, body: text, category });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["commercial-notes", eventId] });
    setBody("");
    toast.success("Note added");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_commercial_notes").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["commercial-notes", eventId] });
  };

  return (
    <div className="pb-8">
      <div className="border border-ink/15 bg-cream px-4 py-4">
        <div className="font-display text-[26px] leading-none">NOTES</div>
        <div className="mt-1.5 font-mono text-[12px] text-ink-soft">
          Commercial requirements and things to confirm with the client.
        </div>
      </div>

      <div className="mt-3 space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <Field label="Note">
          <TextArea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Client oven required for reheating biryani"
            className="min-h-[72px]"
          />
        </Field>
        <Field label="Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
        </Field>
        <PrimaryButton type="button" disabled={busy} onClick={add}>
          Add note
        </PrimaryButton>
      </div>

      <div className="mt-5 space-y-2">
        {notes.isLoading ? <p className="font-mono text-[12px] text-ink-soft">Loading…</p> : null}
        {!notes.isLoading && (notes.data ?? []).length === 0 ? <EmptyNote>No notes yet.</EmptyNote> : null}
        {(notes.data ?? []).map((n) => (
          <div key={n.id} className="border border-ink/15 bg-cream px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="label-mono text-ink-soft">{n.category ?? "General"}</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className="shrink-0 font-mono text-[11px] text-ink-soft underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
