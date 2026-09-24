import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, SelectInput, TextArea, PrimaryButton, GhostButton } from "@/components/inbtwn/bits";
import { TASK_STATUSES, fmtMinutes, type TaskStatus } from "@/lib/prep";
import {
  ANCHORS,
  RUN_ASSIGNMENTS,
  computeAnchors,
  dayShift,
  fmtClock,
  generateRunSheet,
  nextItem,
  ruleLabel,
  runAssignmentLabel,
  runSheetQuery,
  timeline,
  type AnchorType,
  type RunSheetItemRow,
  type TimedItem,
} from "@/lib/runsheet";
import type { EventRow } from "@/lib/queries";

const nextStatus = (s: string): TaskStatus => (s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo");
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))) || 0);

type Draft = {
  name: string;
  anchor_type: AnchorType;
  direction: "before" | "after";
  offset: string;
  fixed_time: string;
  duration: string;
  assignment: string;
  status: TaskStatus;
  notes: string;
};
const emptyDraft: Draft = {
  name: "",
  anchor_type: "arrival",
  direction: "after",
  offset: "0",
  fixed_time: "10:00",
  duration: "",
  assignment: "unassigned",
  status: "todo",
  notes: "",
};

export function EventRunSheet({ event }: { event: EventRow }) {
  const qc = useQueryClient();
  const items = useQuery(runSheetQuery(event.id));
  const [timing, setTiming] = useState({ service: "", lead: "", travel: "", buffer: "" });
  const [editingTiming, setEditingTiming] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RunSheetItemRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTiming({
      service: event.service_time?.slice(0, 5) ?? "",
      lead: event.arrival_lead_minutes?.toString() ?? "",
      travel: event.travel_minutes?.toString() ?? "",
      buffer: event.travel_buffer_minutes?.toString() ?? "",
    });
  }, [event.service_time, event.arrival_lead_minutes, event.travel_minutes, event.travel_buffer_minutes]);

  const anchors = computeAnchors(event);
  const rows = useMemo(() => timeline(items.data ?? [], anchors), [items.data, anchors.service, anchors.arrival, anchors.departure]);
  const next = nextItem(rows);
  const refresh = () => qc.invalidateQueries({ queryKey: ["run-sheet", event.id] });

  const saveTiming = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("events")
      .update({
        service_time: timing.service || null,
        arrival_lead_minutes: num(timing.lead),
        travel_minutes: num(timing.travel),
        travel_buffer_minutes: num(timing.buffer),
      })
      .eq("id", event.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEditingTiming(false);
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
    toast.success("Timings saved");
  };

  const generate = async () => {
    setBusy(true);
    try {
      const n = await generateRunSheet(event.id, event.organisation_id, items.data ?? []);
      toast.success(n ? `Added ${n} run-sheet items` : "Run sheet is already up to date");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (i: RunSheetItemRow) => {
    const status = nextStatus(i.status);
    const { error } = await supabase
      .from("event_run_sheet_items")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", i.id);
    if (error) { toast.error(error.message); return; }
    refresh();
    qc.invalidateQueries({ queryKey: ["today-data"] });
  };

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (i: RunSheetItemRow) => {
    setEditing(i);
    setDraft({
      name: i.name,
      anchor_type: i.anchor_type as AnchorType,
      direction: i.offset_minutes < 0 ? "before" : "after",
      offset: String(Math.abs(i.offset_minutes)),
      fixed_time: i.fixed_time?.slice(0, 5) ?? "10:00",
      duration: i.duration_minutes?.toString() ?? "",
      assignment: i.assignment,
      status: i.status as TaskStatus,
      notes: i.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Name is required"); return; }
    const fixed = draft.anchor_type === "fixed";
    const off = (num(draft.offset) ?? 0) * (draft.direction === "before" ? -1 : 1);
    const payload = {
      name: draft.name.trim(),
      anchor_type: draft.anchor_type,
      offset_minutes: fixed ? 0 : off,
      fixed_time: fixed ? draft.fixed_time || null : null,
      duration_minutes: num(draft.duration) || null,
      assignment: draft.assignment,
      status: draft.status,
      notes: draft.notes.trim() || null,
      completed_at:
        draft.status === "done" ? (editing?.completed_at ?? new Date().toISOString()) : null,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("event_run_sheet_items").update(payload).eq("id", editing.id)
      : await supabase.from("event_run_sheet_items").insert({
          ...payload,
          event_id: event.id,
          organisation_id: event.organisation_id,
          source: "manual",
          sort_order: 100 + (items.data?.length ?? 0),
        });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("event_run_sheet_items").delete().eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    refresh();
  };

  const hasTiming = anchors.service != null;

  return (
    <div>
      {/* Timing summary */}
      <div className="border border-ink/15 bg-cream">
        <div className="grid grid-cols-4 divide-x divide-ink/10">
          {[
            ["Service", fmtClock(anchors.service)],
            ["Arrive", fmtClock(anchors.arrival)],
            ["Depart", fmtClock(anchors.departure)],
            ["Travel", anchors.travel || anchors.buffer ? `${fmtMinutes(anchors.travel) ?? "0 min"}${anchors.buffer ? ` + ${anchors.buffer}` : ""}` : "—"],
          ].map(([l, v]) => (
            <div key={l} className="px-2 py-2.5 text-center">
              <div className="label-mono text-ink-soft">{l}</div>
              <div className={`font-display text-[22px] leading-none ${l === "Service" ? "text-flame" : ""}`}>{v}</div>
            </div>
          ))}
        </div>
        {hasTiming ? (
          <div className="border-t border-ink/10 px-3 py-2 font-mono text-[10px] text-ink-soft">
            Service {fmtClock(anchors.service)} − {event.arrival_lead_minutes ?? 0} min lead = arrive{" "}
            {fmtClock(anchors.arrival)} − {anchors.travel} min travel − {anchors.buffer} min buffer = depart{" "}
            {fmtClock(anchors.departure)}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setEditingTiming((v) => !v)}
          className="tap w-full border-t border-ink/10 px-3 py-2 text-left font-mono text-[11px] text-flame"
        >
          {editingTiming ? "Close timings" : hasTiming ? "Edit timings" : "Set event-day timings"}
        </button>
        {editingTiming ? (
          <div className="grid grid-cols-2 gap-3 border-t border-ink/10 px-3 py-3">
            <Field label="Service time">
              <TextInput type="time" value={timing.service} onChange={(e) => setTiming({ ...timing, service: e.target.value })} />
            </Field>
            <Field label="Arrival lead (min)">
              <TextInput type="number" inputMode="numeric" min={0} value={timing.lead} onChange={(e) => setTiming({ ...timing, lead: e.target.value })} />
            </Field>
            <Field label="Travel (min)">
              <TextInput type="number" inputMode="numeric" min={0} value={timing.travel} onChange={(e) => setTiming({ ...timing, travel: e.target.value })} />
            </Field>
            <Field label="Travel buffer (min)">
              <TextInput type="number" inputMode="numeric" min={0} value={timing.buffer} onChange={(e) => setTiming({ ...timing, buffer: e.target.value })} />
            </Field>
            <PrimaryButton className="col-span-2" disabled={busy} onClick={saveTiming}>
              Save timings
            </PrimaryButton>
          </div>
        ) : null}
      </div>

      {/* Timeline */}
      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="border border-ink/15 bg-cream px-4 py-5 text-center font-mono text-[12px] text-ink-soft">
            {hasTiming ? "No run sheet yet." : "Set the service time, then generate the run sheet."}
          </div>
        ) : (
          <div className="border border-ink/15 bg-cream">
            {rows.map((i) => (
              <RunRow key={i.id} item={i} isNext={next?.id === i.id} onToggle={() => toggle(i)} onEdit={() => openEdit(i)} />
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <GhostButton disabled={busy || !hasTiming} onClick={generate}>
            Generate run sheet
          </GhostButton>
          <GhostButton onClick={openNew}>+ Add item</GhostButton>
        </div>
      </div>

      <Drawer open={open} onOpenChange={(o) => !o && setOpen(false)} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {editing ? "Edit run-sheet item" : "Add run-sheet item"}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Item" required>
                <TextInput placeholder="Turn ovens on" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Anchored to">
                <SelectInput value={draft.anchor_type} onChange={(e) => setDraft({ ...draft, anchor_type: e.target.value as AnchorType })}>
                  {ANCHORS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </SelectInput>
              </Field>
              {draft.anchor_type === "fixed" ? (
                <Field label="Clock time">
                  <TextInput type="time" value={draft.fixed_time} onChange={(e) => setDraft({ ...draft, fixed_time: e.target.value })} />
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Minutes">
                    <TextInput type="number" inputMode="numeric" min={0} value={draft.offset} onChange={(e) => setDraft({ ...draft, offset: e.target.value })} />
                  </Field>
                  <Field label="Before / after">
                    <SelectInput value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as "before" | "after" })}>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </SelectInput>
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (min)">
                  <TextInput type="number" inputMode="numeric" min={0} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
                </Field>
                <Field label="Assignment">
                  <SelectInput value={draft.assignment} onChange={(e) => setDraft({ ...draft, assignment: e.target.value })}>
                    {RUN_ASSIGNMENTS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Status">
                <SelectInput value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Notes">
                <TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>
              {editing ? (
                <button type="button" onClick={remove} className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame">
                  Remove item
                </button>
              ) : null}
            </div>
            <div className="mt-1 space-y-2 pb-3">
              <PrimaryButton disabled={busy} onClick={save}>{editing ? "Save item" : "Add item"}</PrimaryButton>
              <GhostButton className="w-full" onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function RunRow({ item, isNext, onToggle, onEdit }: { item: TimedItem; isNext: boolean; onToggle: () => void; onEdit: () => void }) {
  const done = item.status === "done";
  const ms = item.is_milestone;
  const shift = item.time != null ? dayShift(item.time) : 0;
  return (
    <div className={`flex items-stretch border-b border-ink/10 last:border-0 ${ms ? "bg-ink/[0.04]" : ""} ${isNext ? "border-l-4 border-l-flame" : ""}`}>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left">
        <div className={`w-[58px] shrink-0 font-display text-[22px] leading-none ${done ? "text-ink-soft/60" : ms ? "text-flame" : ""}`}>
          {fmtClock(item.time)}
          {shift ? <div className="font-mono text-[9px] text-ink-soft">{shift < 0 ? "prev day" : "next day"}</div> : null}
        </div>
        <div className={`min-w-0 flex-1 ${done ? "text-ink-soft line-through opacity-60" : ""}`}>
          <div className={`leading-tight ${ms ? "font-display text-[18px] uppercase" : "text-[14px] font-semibold"}`}>{item.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-soft">
            {[
              ruleLabel(item),
              item.end != null ? `${fmtClock(item.time)}–${fmtClock(item.end)}` : null,
              item.assignment !== "unassigned" ? runAssignmentLabel(item.assignment) : null,
              item.source === "manual" ? "Manual" : null,
              item.status === "in_progress" ? "In progress" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {item.notes ? <div className="mt-0.5 text-[12px] text-ink-soft">{item.notes}</div> : null}
        </div>
      </button>
      <button type="button" onClick={onToggle} aria-label={`Set status for ${item.name}`} className="tap flex w-12 shrink-0 items-center justify-center">
        <span
          className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
            done ? "border-s-conf bg-s-conf text-cream" : item.status === "in_progress" ? "border-flame bg-flame/15 text-flame" : "border-ink/40 bg-paper"
          }`}
        >
          {done ? "✓" : item.status === "in_progress" ? "·" : ""}
        </span>
      </button>
    </div>
  );
}
