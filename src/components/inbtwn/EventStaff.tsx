import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, SelectInput, TextArea, PrimaryButton, GhostButton, EmptyNote } from "@/components/inbtwn/bits";
import { fmtDateLong, fmtMoney } from "@/lib/format";
import {
  WORK_TYPES,
  calcShift,
  eventShiftsQuery,
  fmtHours,
  labourTotals,
  shiftName,
  staffMembersQuery,
  workTypeLabel,
  type ShiftRow,
  type WorkType,
} from "@/lib/staff";
import type { EventRow } from "@/lib/queries";

type Draft = {
  who: string; // "me" | "none" | staff id
  role_label: string;
  work_type: WorkType;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: string;
  hourly_rate: string;
  actual_start_time: string;
  actual_end_time: string;
  actual_break_minutes: string;
  paid: boolean;
  payment_note: string;
  notes: string;
};

const intOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s) || 0)));

export function EventStaff({ event }: { event: EventRow }) {
  const qc = useQueryClient();
  const shiftsQ = useQuery(eventShiftsQuery(event.id));
  const membersQ = useQuery(staffMembersQuery);
  const members = membersQ.data ?? [];
  const shifts = shiftsQ.data ?? [];
  const money = (n: number | null) => (n == null ? "—" : (fmtMoney(n, event.currency) ?? "—"));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStaff, setNewStaff] = useState<{ name: string; rate: string } | null>(null);

  const totals = labourTotals(shifts);

  const groups = useMemo(() => {
    const map = new Map<string, { type: string; date: string | null; items: ShiftRow[] }>();
    for (const s of shifts) {
      const k = `${s.shift_date ?? "~"}|${s.work_type}`;
      if (!map.has(k)) map.set(k, { type: s.work_type, date: s.shift_date, items: [] });
      map.get(k)!.items.push(s);
    }
    return [...map.values()];
  }, [shifts]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event-shifts", event.id] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
  };

  const openNew = () => {
    setEditing(null);
    setNewStaff(null);
    setDraft({
      who: "none",
      role_label: "Event Helper",
      work_type: "event",
      shift_date: event.event_date ?? "",
      start_time: "",
      end_time: "",
      break_minutes: "",
      hourly_rate: "",
      actual_start_time: "",
      actual_end_time: "",
      actual_break_minutes: "",
      paid: false,
      payment_note: "",
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (s: ShiftRow) => {
    setEditing(s);
    setNewStaff(null);
    setDraft({
      who: s.is_owner ? "me" : (s.staff_member_id ?? "none"),
      role_label: s.role_label ?? "",
      work_type: s.work_type as WorkType,
      shift_date: s.shift_date ?? "",
      start_time: s.start_time?.slice(0, 5) ?? "",
      end_time: s.end_time?.slice(0, 5) ?? "",
      break_minutes: s.break_minutes?.toString() ?? "",
      hourly_rate: s.is_owner ? "" : String(Number(s.hourly_rate)),
      actual_start_time: s.actual_start_time?.slice(0, 5) ?? "",
      actual_end_time: s.actual_end_time?.slice(0, 5) ?? "",
      actual_break_minutes: s.actual_break_minutes?.toString() ?? "",
      paid: s.payment_status === "paid",
      payment_note: s.payment_note ?? "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  };

  /** Picking a person fills the rate only for a new shift with no rate yet; existing shifts keep their rate. */
  const pickWho = (who: string) => {
    if (!draft) return;
    const m = members.find((x) => x.id === who);
    const fill = m && !editing && draft.hourly_rate.trim() === "";
    setDraft({ ...draft, who, hourly_rate: fill ? String(Number(m.default_hourly_rate)) : draft.hourly_rate });
  };

  const addStaffMember = async () => {
    if (!newStaff || !draft) return;
    const name = newStaff.name.trim();
    if (!name) return void toast.error("Name is required");
    const { data, error } = await supabase
      .from("staff_members")
      .insert({ name, default_hourly_rate: Number(newStaff.rate) || 0 })
      .select()
      .single();
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["staff-members"] });
    setNewStaff(null);
    setDraft({
      ...draft,
      who: data.id,
      hourly_rate: !editing && draft.hourly_rate.trim() === "" ? String(Number(data.default_hourly_rate)) : draft.hourly_rate,
    });
    toast.success(`${name} added to staff`);
  };

  const save = async () => {
    if (!draft) return;
    const owner = draft.who === "me";
    const staffId = owner || draft.who === "none" ? null : draft.who;
    if (!owner && !staffId && !draft.role_label.trim()) return void toast.error("Give the role a name, e.g. Event Helper");
    const paid = !owner && draft.paid;
    const payload = {
      is_owner: owner,
      staff_member_id: staffId,
      role_label: draft.role_label.trim() || null,
      work_type: draft.work_type,
      shift_date: draft.shift_date || null,
      start_time: draft.start_time || null,
      end_time: draft.end_time || null,
      break_minutes: intOrNull(draft.break_minutes),
      hourly_rate: owner ? 0 : Math.max(0, Number(draft.hourly_rate) || 0),
      actual_start_time: draft.actual_start_time || null,
      actual_end_time: draft.actual_end_time || null,
      actual_break_minutes: intOrNull(draft.actual_break_minutes),
      payment_status: paid ? "paid" : "unpaid",
      paid_at: paid ? (editing?.paid_at ?? new Date().toISOString()) : null,
      payment_note: paid ? draft.payment_note.trim() || null : null,
      notes: draft.notes.trim() || null,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("event_staff_shifts").update(payload).eq("id", editing.id)
      : await supabase.from("event_staff_shifts").insert({ ...payload, event_id: event.id, sort_order: shifts.length });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setOpen(false);
    refresh();
    toast.success(editing ? "Shift updated" : "Shift added");
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("event_staff_shifts").delete().eq("id", editing.id);
    if (error) return void toast.error(error.message);
    setOpen(false);
    refresh();
    toast.success("Shift removed");
  };

  const togglePaid = async (s: ShiftRow) => {
    const paid = s.payment_status !== "paid";
    const { error } = await supabase
      .from("event_staff_shifts")
      .update({ payment_status: paid ? "paid" : "unpaid", paid_at: paid ? new Date().toISOString() : null })
      .eq("id", s.id);
    if (error) return void toast.error(error.message);
    refresh();
  };

  if (shiftsQ.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  const preview = draft
    ? calcShift({
        is_owner: draft.who === "me",
        hourly_rate: Number(draft.hourly_rate) || 0,
        start_time: draft.start_time || null,
        end_time: draft.end_time || null,
        break_minutes: intOrNull(draft.break_minutes),
        actual_start_time: draft.actual_start_time || null,
        actual_end_time: draft.actual_end_time || null,
        actual_break_minutes: intOrNull(draft.actual_break_minutes),
      } as ShiftRow)
    : null;
  const pickedMember = draft ? members.find((m) => m.id === draft.who) : undefined;

  return (
    <div className="pb-6">
      <div className="flex items-end justify-between">
        <div className="font-display text-[26px] leading-none">Staff</div>
        <Link to="/library/staff" className="font-mono text-[11px] text-flame">
          Staff list →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-ink/10 border border-ink/15 bg-cream">
        {[
          ["Estimated", money(totals.estimated), null],
          [
            "Actual",
            totals.paidShifts === 0 ? "—" : money(totals.actual),
            totals.paidShifts > 0 && !totals.actualComplete ? `${totals.actualMissing} to enter` : null,
          ],
          ["Unpaid", money(totals.unpaid), totals.unpaidPeople ? `${totals.unpaidPeople} to pay` : null],
        ].map(([l, v, n]) => (
          <div key={l} className="px-2 py-2.5 text-center">
            <div className="label-mono text-ink-soft">{l}</div>
            <div className={`font-display text-[20px] leading-none ${l === "Unpaid" && totals.unpaid > 0 ? "text-flame" : ""}`}>{v}</div>
            {n ? <div className="mt-0.5 font-mono text-[9px] text-ink-soft">{n}</div> : null}
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {groups.length === 0 ? (
          <EmptyNote>No shifts yet. Add yourself, a helper, or a role you still need to fill.</EmptyNote>
        ) : (
          groups.map((g) => (
            <div key={`${g.date}|${g.type}`}>
              <h2 className="label-hand mb-2 text-ink-soft">
                {g.type === "event" && g.date === event.event_date ? "Event day" : workTypeLabel(g.type)} ·{" "}
                {g.date ? fmtDateLong(g.date) : "Date TBC"}
              </h2>
              <div className="border border-ink/15 bg-cream">
                {g.items.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    name={shiftName(s, members)}
                    money={money}
                    onEdit={() => openEdit(s)}
                    onTogglePaid={() => togglePaid(s)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <PrimaryButton className="mt-4" onClick={openNew}>
        + Add staff / labour
      </PrimaryButton>

      <Drawer open={open} onOpenChange={(o) => !o && setOpen(false)} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          {draft ? (
            <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
              <DrawerTitle className="font-display text-[24px] leading-none">{editing ? "Edit shift" : "Add shift"}</DrawerTitle>
              <div className="mt-3 space-y-3 overflow-y-auto pb-3">
                <Field label="Who">
                  <SelectInput value={draft.who} onChange={(e) => (e.target.value === "__new" ? setNewStaff({ name: "", rate: "15" }) : pickWho(e.target.value))}>
                    <option value="none">Unassigned — still needed</option>
                    <option value="me">Me (owner)</option>
                    {members
                      .filter((m) => m.active || m.id === draft.who)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    <option value="__new">+ Add staff member…</option>
                  </SelectInput>
                </Field>
                {newStaff ? (
                  <div className="space-y-2 border border-ink/15 bg-cream p-3">
                    <div className="grid grid-cols-[1fr_96px] gap-2">
                      <Field label="Name">
                        <TextInput value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
                      </Field>
                      <Field label="£ / hour">
                        <TextInput inputMode="decimal" value={newStaff.rate} onChange={(e) => setNewStaff({ ...newStaff, rate: e.target.value })} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <GhostButton onClick={() => setNewStaff(null)}>Cancel</GhostButton>
                      <GhostButton onClick={addStaffMember}>Save staff</GhostButton>
                    </div>
                  </div>
                ) : null}
                {draft.who !== "me" ? (
                  <Field label="Role">
                    <TextInput placeholder="Event Helper" value={draft.role_label} onChange={(e) => setDraft({ ...draft, role_label: e.target.value })} />
                  </Field>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Work">
                    <SelectInput value={draft.work_type} onChange={(e) => setDraft({ ...draft, work_type: e.target.value as WorkType })}>
                      {WORK_TYPES.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Date">
                    <TextInput type="date" value={draft.shift_date} onChange={(e) => setDraft({ ...draft, shift_date: e.target.value })} />
                  </Field>
                  <Field label="Start">
                    <TextInput type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} />
                  </Field>
                  <Field label="Finish">
                    <TextInput type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} />
                  </Field>
                  <Field label="Unpaid break (min)">
                    <TextInput type="number" inputMode="numeric" min={0} value={draft.break_minutes} onChange={(e) => setDraft({ ...draft, break_minutes: e.target.value })} />
                  </Field>
                  {draft.who !== "me" ? (
                    <Field label="Rate £ / hour">
                      <TextInput inputMode="decimal" value={draft.hourly_rate} onChange={(e) => setDraft({ ...draft, hourly_rate: e.target.value })} />
                    </Field>
                  ) : null}
                </div>
                {editing && pickedMember && Number(pickedMember.default_hourly_rate) !== Number(draft.hourly_rate) ? (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, hourly_rate: String(Number(pickedMember.default_hourly_rate)) })}
                    className="font-mono text-[11px] text-flame underline"
                  >
                    Use {pickedMember.name}'s rate ({money(Number(pickedMember.default_hourly_rate))}/hr)
                  </button>
                ) : null}
                {preview ? (
                  <div className="font-mono text-[11px] text-ink-soft">
                    {draft.who === "me"
                      ? `${fmtHours(preview.plannedHours)} · Owner · No labour cost`
                      : `${fmtHours(preview.plannedHours)} · Estimated ${money(preview.plannedCost)}`}
                  </div>
                ) : null}

                <div className="border-t border-ink/10 pt-3">
                  <div className="label-mono mb-2 text-ink-soft">Actual hours (optional)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Start">
                      <TextInput type="time" value={draft.actual_start_time} onChange={(e) => setDraft({ ...draft, actual_start_time: e.target.value })} />
                    </Field>
                    <Field label="Finish">
                      <TextInput type="time" value={draft.actual_end_time} onChange={(e) => setDraft({ ...draft, actual_end_time: e.target.value })} />
                    </Field>
                    <Field label="Break">
                      <TextInput type="number" inputMode="numeric" min={0} value={draft.actual_break_minutes} onChange={(e) => setDraft({ ...draft, actual_break_minutes: e.target.value })} />
                    </Field>
                  </div>
                  {preview?.hasActual ? (
                    <div className="mt-1 font-mono text-[11px] text-ink-soft">
                      {fmtHours(preview.actualHours)}
                      {draft.who !== "me" ? ` · Actual ${money(preview.actualCost)}` : ""}
                    </div>
                  ) : null}
                </div>

                {draft.who !== "me" ? (
                  <div className="border-t border-ink/10 pt-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="size-5 accent-[var(--color-s-conf)]" checked={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.checked })} />
                      <span className="font-semibold">Paid</span>
                    </label>
                    {draft.paid ? (
                      <div className="mt-2">
                        <Field label="Payment note">
                          <TextInput placeholder="Bank transfer 4 Oct" value={draft.payment_note} onChange={(e) => setDraft({ ...draft, payment_note: e.target.value })} />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Field label="Notes">
                  <TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </Field>
                {editing ? (
                  <button type="button" onClick={remove} className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame">
                    Remove shift
                  </button>
                ) : null}
              </div>
              <div className="mt-1 space-y-2 pb-3">
                <PrimaryButton disabled={busy || Boolean(newStaff)} onClick={save}>
                  {editing ? "Save shift" : "Add shift"}
                </PrimaryButton>
                <GhostButton className="w-full" onClick={() => setOpen(false)}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ShiftCard({
  shift,
  name,
  money,
  onEdit,
  onTogglePaid,
}: {
  shift: ShiftRow;
  name: string;
  money: (n: number | null) => string;
  onEdit: () => void;
  onTogglePaid: () => void;
}) {
  const c = calcShift(shift);
  const owner = shift.is_owner;
  const unassigned = !owner && !shift.staff_member_id;
  const paid = shift.payment_status === "paid";
  const times = shift.start_time && shift.end_time ? `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}` : "Times TBC";
  return (
    <div className={`flex items-stretch border-b border-ink/10 last:border-0 ${unassigned ? "border-l-4 border-l-flame" : ""}`}>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 px-3 py-2.5 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[18px] uppercase leading-none">{unassigned ? shift.role_label || "Staff needed" : name}</span>
          <span className="font-display text-[18px] leading-none">{times}</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {owner
            ? [c.plannedHours != null ? fmtHours(c.plannedHours) : null, "Owner · No labour cost"].filter(Boolean).join(" · ")
            : [
                unassigned ? "Unassigned" : shift.role_label,
                c.plannedHours != null ? fmtHours(c.plannedHours) : null,
                `${money(Number(shift.hourly_rate))}/hr`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </div>
        {!owner ? (
          <div className="mt-0.5 font-mono text-[11px]">
            Estimated {money(c.plannedCost)}
            {c.hasActual ? (
              <span className="text-ink">
                {" "}
                · Actual {money(c.actualCost)} ({shift.actual_start_time?.slice(0, 5)}–{shift.actual_end_time?.slice(0, 5)}, {fmtHours(c.actualHours)})
              </span>
            ) : null}
          </div>
        ) : c.hasActual ? (
          <div className="mt-0.5 font-mono text-[11px] text-ink-soft">Actual {fmtHours(c.actualHours)}</div>
        ) : null}
        {shift.notes ? <div className="mt-0.5 text-[12px] text-ink-soft">{shift.notes}</div> : null}
      </button>
      {!owner && !unassigned ? (
        <button
          type="button"
          onClick={onTogglePaid}
          aria-label={`Mark ${name} ${paid ? "unpaid" : "paid"}`}
          className="tap flex w-[68px] shrink-0 items-center justify-center"
        >
          <span className={`label-mono px-1.5 py-1 ${paid ? "bg-s-conf text-cream" : "border border-ink/30 text-ink-soft"}`}>
            {paid ? "Paid" : "Unpaid"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
