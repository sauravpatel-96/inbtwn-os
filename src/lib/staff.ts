/**
 * Staff & Labour — a small casual-staff pool plus per-event shifts.
 *
 * Shifts are the source of truth for event labour cost. Planned and actual
 * values are kept separately (Estimated ≠ Actual). The owner ("Me") can be
 * scheduled for planning but never creates a labour cost or a wage obligation.
 *
 * Times are plain minutes-of-day on a calendar date — no Date objects, no UTC.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { maybeNum, round2, type CostRow } from "./finance";
import { parseClock } from "./runsheet";

export type StaffMemberRow = Database["public"]["Tables"]["staff_members"]["Row"];
export type ShiftRow = Database["public"]["Tables"]["event_staff_shifts"]["Row"];
export type WorkType = "prep" | "event" | "other";

export const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: "prep", label: "Prep" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];
export const workTypeLabel = (v: string | null | undefined) => WORK_TYPES.find((w) => w.value === v)?.label ?? "Other";

/** Paid minutes between two clock times, minus an unpaid break. Finish before start = overnight. */
export function paidMinutes(start: string | null, end: string | null, breakMins: number | null): number | null {
  const s = parseClock(start);
  const e = parseClock(end);
  if (s == null || e == null) return null;
  const span = e >= s ? e - s : e + 1440 - s;
  return Math.max(0, span - (breakMins ?? 0));
}

export type ShiftCalc = {
  plannedHours: number | null;
  plannedCost: number; // 0 for owner / unknown hours
  hasActual: boolean;
  actualHours: number | null;
  actualCost: number | null; // null when no actual hours
};

export function calcShift(s: ShiftRow): ShiftCalc {
  const pm = paidMinutes(s.start_time, s.end_time, s.break_minutes);
  const am = paidMinutes(s.actual_start_time, s.actual_end_time, s.actual_break_minutes);
  const rate = s.is_owner ? 0 : Number(s.hourly_rate) || 0;
  const plannedHours = pm == null ? null : pm / 60;
  const actualHours = am == null ? null : am / 60;
  return {
    plannedHours,
    plannedCost: plannedHours == null ? 0 : plannedHours * rate,
    hasActual: am != null,
    actualHours,
    actualCost: actualHours == null ? null : s.is_owner ? 0 : actualHours * rate,
  };
}

export type LabourTotals = {
  shifts: number;
  paidShifts: number; // non-owner shifts
  estimated: number;
  actual: number;
  actualComplete: boolean;
  actualMissing: number;
  unpaid: number;
  unpaidPeople: number;
  unassigned: number;
  people: number; // distinct named staff
  owner: boolean;
};

/** Full precision internally; rounding only to the penny for money totals. */
export function labourTotals(shifts: ShiftRow[]): LabourTotals {
  const paid = shifts.filter((s) => !s.is_owner);
  let estimated = 0;
  let actual = 0;
  let missing = 0;
  let unpaid = 0;
  const unpaidPeople = new Set<string>();
  for (const s of paid) {
    const c = calcShift(s);
    estimated += c.plannedCost;
    if (c.actualCost != null) actual += c.actualCost;
    else missing++;
    if (s.staff_member_id && s.payment_status !== "paid") {
      unpaid += c.actualCost ?? c.plannedCost;
      unpaidPeople.add(s.staff_member_id);
    }
  }
  return {
    shifts: shifts.length,
    paidShifts: paid.length,
    estimated: round2(estimated),
    actual: round2(actual),
    actualComplete: paid.length > 0 && missing === 0,
    actualMissing: missing,
    unpaid: round2(unpaid),
    unpaidPeople: unpaidPeople.size,
    unassigned: paid.filter((s) => !s.staff_member_id).length,
    people: new Set(paid.map((s) => s.staff_member_id).filter(Boolean)).size,
    owner: shifts.some((s) => s.is_owner),
  };
}

/**
 * Transition rule for Finance: once an event has any non-owner shift, Staff is
 * the labour source of truth and manual "staff" job costs stop counting (they
 * stay stored and visible). Events with no shifts keep using manual costs.
 */
export const usesStaffLabour = (shifts: ShiftRow[]) => shifts.some((s) => !s.is_owner);

export type CombinedCosts = {
  usesStaff: boolean;
  labour: LabourTotals;
  counted: CostRow[];
  replaced: CostRow[];
  estimated: number;
  actual: number;
  hasEstimates: boolean;
  hasAny: boolean;
  actualComplete: boolean;
};

export function combinedCosts(costs: CostRow[], shifts: ShiftRow[]): CombinedCosts {
  const usesStaff = usesStaffLabour(shifts);
  const labour = labourTotals(shifts);
  const counted = usesStaff ? costs.filter((c) => c.category !== "staff") : costs;
  const replaced = usesStaff ? costs.filter((c) => c.category === "staff") : [];
  const est = counted.reduce((s, c) => s + (maybeNum(c.estimated_amount) ?? maybeNum(c.actual_amount) ?? 0), 0);
  const act = counted.reduce((s, c) => s + (maybeNum(c.actual_amount) ?? 0), 0);
  const costsComplete = counted.every((c) => maybeNum(c.actual_amount) !== null);
  const hasAny = counted.length > 0 || labour.paidShifts > 0;
  return {
    usesStaff,
    labour,
    counted,
    replaced,
    estimated: round2(est + (usesStaff ? labour.estimated : 0)),
    actual: round2(act + (usesStaff ? labour.actual : 0)),
    hasEstimates:
      counted.some((c) => maybeNum(c.estimated_amount) !== null || maybeNum(c.actual_amount) !== null) || usesStaff,
    hasAny,
    actualComplete: hasAny && costsComplete && (!usesStaff || labour.actualComplete),
  };
}

/** 6 → "6 hr", 6.5 → "6.5 hr", 6.25 → "6.25 hr" */
export function fmtHours(h: number | null | undefined): string {
  if (h == null) return "—";
  return `${Number(h.toFixed(2))} hr`;
}

export const shiftName = (s: ShiftRow, members: StaffMemberRow[]) =>
  s.is_owner
    ? "Me"
    : (members.find((m) => m.id === s.staff_member_id)?.name ?? s.role_label ?? "Staff needed");

/* ---------- Queries ---------- */

export const staffMembersQuery = queryOptions({
  queryKey: ["staff-members"],
  queryFn: async () => {
    const res = await supabase.from("staff_members").select("*").order("name");
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as StaffMemberRow[];
  },
});

export const eventShiftsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-shifts", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_staff_shifts")
        .select("*")
        .eq("event_id", eventId)
        .order("shift_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false });
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as ShiftRow[];
    },
  });
