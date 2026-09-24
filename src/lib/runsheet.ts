/**
 * Event Day Run Sheet.
 *
 * Every item stores a RULE (anchor + offset, or a fixed clock time). Clock
 * times are always derived, never stored, so changing service / arrival lead /
 * travel / buffer cascades automatically.
 *
 * Times are handled as plain minutes-of-day on the event's calendar date.
 * No Date objects, no UTC, no browser timezone — nothing can shift a day.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RunSheetItemRow = Database["public"]["Tables"]["event_run_sheet_items"]["Row"];
export type TemplateItemRow = Database["public"]["Tables"]["run_sheet_template_items"]["Row"];
export type AnchorType = "service" | "arrival" | "departure" | "fixed";
export type RunAssignment = "me" | "helper" | "everyone" | "unassigned";

export const DEFAULT_TEMPLATE_KEY = "standard_catering";

export const ANCHORS: { value: AnchorType; label: string }[] = [
  { value: "departure", label: "Departure" },
  { value: "arrival", label: "Arrival" },
  { value: "service", label: "Service" },
  { value: "fixed", label: "Fixed time" },
];
export const RUN_ASSIGNMENTS: { value: RunAssignment; label: string }[] = [
  { value: "me", label: "Me" },
  { value: "helper", label: "Helper" },
  { value: "everyone", label: "Everyone" },
  { value: "unassigned", label: "Unassigned" },
];
export const runAssignmentLabel = (v: string | null | undefined) =>
  RUN_ASSIGNMENTS.find((a) => a.value === v)?.label ?? "Unassigned";

/** "15:00" / "15:00:00" → 900 */
export function parseClock(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 900 → "15:00"; values outside the day are wrapped and flagged by dayShift(). */
export function fmtClock(mins: number | null | undefined): string {
  if (mins == null) return "--:--";
  const w = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
}
export const dayShift = (mins: number) => Math.floor(mins / 1440);

export type EventTiming = {
  service_time: string | null;
  arrival_time?: string | null;
  arrival_lead_minutes: number | null;
  travel_minutes: number | null;
  travel_buffer_minutes: number | null;
};

export type Anchors = {
  service: number | null;
  arrival: number | null;
  departure: number | null;
  travel: number;
  buffer: number;
};

/** SERVICE → ARRIVAL → DEPARTURE */
export function computeAnchors(e: EventTiming): Anchors {
  const service = parseClock(e.service_time);
  const travel = e.travel_minutes ?? 0;
  const buffer = e.travel_buffer_minutes ?? 0;
  const arrival =
    service != null && e.arrival_lead_minutes != null
      ? service - e.arrival_lead_minutes
      : parseClock(e.arrival_time ?? null);
  const departure = arrival != null ? arrival - travel - buffer : null;
  return { service, arrival, departure, travel, buffer };
}

export function itemTime(
  item: Pick<RunSheetItemRow, "anchor_type" | "offset_minutes" | "fixed_time">,
  a: Anchors,
): number | null {
  if (item.anchor_type === "fixed") return parseClock(item.fixed_time);
  const base = a[item.anchor_type as "service" | "arrival" | "departure"];
  return base == null ? null : base + (item.offset_minutes ?? 0);
}

export function ruleLabel(item: Pick<RunSheetItemRow, "anchor_type" | "offset_minutes" | "fixed_time">): string {
  if (item.anchor_type === "fixed") return `Fixed ${fmtClock(parseClock(item.fixed_time))}`;
  const name = ANCHORS.find((x) => x.value === item.anchor_type)?.label ?? item.anchor_type;
  const o = item.offset_minutes ?? 0;
  return o === 0 ? `At ${name.toLowerCase()}` : `${name} ${o > 0 ? "+" : "−"}${Math.abs(o)} min`;
}

export type TimedItem = RunSheetItemRow & { time: number | null; end: number | null };

/** Chronological; unresolved times sink to the bottom. Stable by sort_order. */
export function timeline(items: RunSheetItemRow[], a: Anchors): TimedItem[] {
  return items
    .map((i) => {
      const time = itemTime(i, a);
      return { ...i, time, end: time != null && i.duration_minutes ? time + i.duration_minutes : null };
    })
    .sort((x, y) => (x.time ?? 1e9) - (y.time ?? 1e9) || x.sort_order - y.sort_order);
}

export function nextItem(items: TimedItem[]): TimedItem | null {
  return items.find((i) => i.status !== "done") ?? null;
}

/* ---------------- Queries ---------------- */

export const runSheetQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["run-sheet", eventId],
    queryFn: async () => {
      const res = await supabase.from("event_run_sheet_items").select("*").eq("event_id", eventId);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as RunSheetItemRow[];
    },
  });

/**
 * Non-destructive generation: only template items not already represented on
 * the event are inserted. Existing rows (edited or not) and manual items are
 * never touched. The partial unique index backs this up.
 */
export async function generateRunSheet(
  eventId: string,
  organisationId: string,
  existing: RunSheetItemRow[],
  templateKey = DEFAULT_TEMPLATE_KEY,
): Promise<number> {
  const tpl = await supabase.from("run_sheet_templates").select("id").eq("key", templateKey).limit(1).maybeSingle();
  if (tpl.error || !tpl.data) throw new Error(tpl.error?.message ?? "Template not found");
  const items = await supabase
    .from("run_sheet_template_items")
    .select("*")
    .eq("template_id", tpl.data.id)
    .order("sort_order");
  if (items.error) throw new Error(items.error.message);
  const have = new Set(existing.map((e) => e.template_item_id).filter(Boolean));
  const now = new Date().toISOString();
  const rows = (items.data ?? [])
    .filter((t) => !have.has(t.id))
    .map((t) => ({
      organisation_id: organisationId,
      event_id: eventId,
      name: t.name,
      anchor_type: t.anchor_type,
      offset_minutes: t.offset_minutes,
      fixed_time: t.fixed_time,
      duration_minutes: t.duration_minutes,
      assignment: t.assignment,
      is_milestone: t.is_milestone,
      sort_order: t.sort_order,
      source: "template",
      template_item_id: t.id,
      generated_at: now,
    }));
  if (!rows.length) return 0;
  const ins = await supabase.from("event_run_sheet_items").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  return rows.length;
}
