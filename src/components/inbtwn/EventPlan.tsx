import { eventKitQuery, kitItemsQuery, kitLines, kitSummary } from "@/lib/kit";
import { usePersistentState } from "@/lib/tab-memory";
/**
 * Event Plan — "what work needs doing, and when".
 *
 * Plan never calculates quantities. It reads the existing Production result
 * (scaleVersion on the confirmed operational Menu) and looks up the quantity
 * that each prep task relates to.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import {
  SectionHeading,
  TornCard,
  EmptyNote,
  Chip,
  Field,
  TextInput,
  SelectInput,
  TextArea,
  PrimaryButton,
  GhostButton,
} from "@/components/inbtwn/bits";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery } from "@/lib/menu-queries";
import { versionBuffersQuery } from "@/lib/production";
import { packingChecksQuery, packingItemsQuery, manualKey, foodLinesFromProduction } from "@/lib/packing";
import { collectPurchases, shoppingChecksQuery, type ShoppingLine } from "@/lib/shopping";
import { scaleVersion, type ScaleResult } from "@/lib/recipe-calc";
import {
  ASSIGNMENTS,
  TASK_STATUSES,
  assignmentLabel,
  eventTasksQuery,
  fmtMinutes,
  groupByDate,
  indexProduction,
  pendingGeneration,
  statusTaskLabel,
  taskQuantity,
  type DishQuantities,
  type EventTaskRow,
  type PrepStepRow,
  type TaskStatus,
} from "@/lib/prep";
import { fmtDateLong, todayISO } from "@/lib/format";
import type { BaseUnit } from "@/lib/units";
import type { EventRow } from "@/lib/queries";
import { EventRunSheet } from "@/components/inbtwn/EventRunSheet";
import { eventShiftsQuery, labourTotals, shiftName, staffMembersQuery } from "@/lib/staff";
import { fmtMoney } from "@/lib/format";

type Filter = "open" | "all" | "done";

const nextStatus = (s: string): TaskStatus =>
  s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo";

function TaskRow({
  task,
  quantity,
  recipeId,
  onToggle,
  onEdit,
}: {
  task: EventTaskRow;
  quantity: string | null;
  recipeId: string | null;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className="flex items-start border-b border-ink/10 py-1 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Set status for ${task.name}`}
        className="tap -ml-2 flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
            done
              ? "border-ink bg-ink text-cream"
              : task.status === "in_progress"
                ? "border-flame bg-flame/15 text-flame"
                : "border-ink/40 bg-paper"
          }`}
        >
          {done ? "✓" : task.status === "in_progress" ? "·" : ""}
        </span>
      </button>
      <div className={`min-w-0 flex-1 py-1 ${done ? "text-ink-soft line-through opacity-60" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold leading-tight">{task.name}</span>
          {quantity ? <span className="shrink-0 font-mono text-[14px]">{quantity}</span> : null}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-ink-soft">
          {[
            fmtMinutes(task.approximate_minutes),
            assignmentLabel(task.assignment),
            task.source === "manual" ? "Manual" : null,
            task.status === "in_progress" ? "In progress" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {task.notes ? <div className="mt-0.5 text-[12px] text-ink-soft">{task.notes}</div> : null}
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onEdit} className="tap font-mono text-[11px] text-flame underline">
            Edit
          </button>
          {recipeId ? (
            <Link
              to="/library/recipes/$recipeId"
              params={{ recipeId }}
              className="font-mono text-[11px] text-ink-soft underline"
            >
              Open recipe
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Draft = {
  name: string;
  scheduled_date: string;
  approximate_minutes: string;
  assignment: string;
  status: TaskStatus;
  notes: string;
};

const emptyDraft = (date: string): Draft => ({
  name: "",
  scheduled_date: date,
  approximate_minutes: "",
  assignment: "unassigned",
  status: "todo",
  notes: "",
});

export function EventPlan({ event }: { event: EventRow }) {
  const eventId = event.id;
  const qc = useQueryClient();
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);
  const tasks = useQuery(eventTasksQuery(eventId));
  const shopChecks = useQuery(shoppingChecksQuery(eventId));
  const packItems = useQuery(packingItemsQuery(eventId));
  const packChecks = useQuery(packingChecksQuery(eventId));
  const shiftsQ = useQuery(eventShiftsQuery(eventId));
  const staffQ = useQuery(staffMembersQuery);
  const kitItemsQ = useQuery(kitItemsQuery);
  const kitRowsQ = useQuery(eventKitQuery(event.id));

  const [filter, setFilter] = usePersistentState<Filter>(`plan.${eventId}`, "open", ["open","all","done"] as const);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventTaskRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(event.event_date ?? todayISO()));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollY = useRef<number | null>(null);

  const guests = event.guest_count ?? 0;

  /* ---- Existing Production results, reused as-is ---- */
  const dishes = useMemo(() => {
    if (!graph.data || !menu.data) return [];
    const out: { recipeId: string; base: BaseUnit; result: ScaleResult }[] = [];
    for (const item of menu.data) {
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      const perGuest = Number(item.quantity_per_guest ?? 0);
      if (!versionId || !item.recipe_id || guests <= 0 || perGuest <= 0) continue;
      const buffer = buffers.data?.[versionId] ?? 0;
      const target = guests * perGuest * (1 + buffer / 100);
      try {
        out.push({
          recipeId: item.recipe_id,
          base: (item.quantity_unit as BaseUnit) ?? "g",
          result: scaleVersion(versionId, target, graph.data),
        });
      } catch {
        /* Production surfaces the error on its own tab. */
      }
    }
    return out;
  }, [menu.data, graph.data, buffers.data, guests]);

  const production = useMemo(
    () => (graph.data ? indexProduction(dishes, graph.data) : new Map<string, DishQuantities>()),
    [dishes, graph.data],
  );

  /* ---- Prep steps for the recipes on the confirmed operational menu ---- */
  const menuRecipeIds = useMemo(
    () => [...new Set((menu.data ?? []).map((m) => m.recipe_id).filter(Boolean))] as string[],
    [menu.data],
  );

  const steps = useQuery({
    queryKey: ["prep-steps-for", eventId, menuRecipeIds.join(",")],
    enabled: menuRecipeIds.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from("recipe_prep_steps")
        .select("*")
        .in("recipe_id", menuRecipeIds)
        .order("sort_order");
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as PrepStepRow[];
    },
  });

  const allTasks = tasks.data ?? [];
  const outstanding = allTasks.filter((t) => t.status !== "done").length;

  const visible = allTasks.filter((t) =>
    filter === "all" ? true : filter === "done" ? t.status === "done" : t.status !== "done",
  );
  const days = groupByDate(visible);
  const today = todayISO();

  /* ---- Shopping / packing summaries (existing systems, read-only) ---- */
  const shopping = useMemo(() => {
    const map = new Map<string, ShoppingLine>();
    for (const d of dishes) collectPurchases(d.result, map);
    const total = map.size;
    const checked = new Set(shopChecks.data ?? []);
    return { total, collected: [...map.keys()].filter((k) => checked.has(k)).length };
  }, [dishes, shopChecks.data]);

  const packing = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    if (graph.data) {
      for (const d of dishes) {
        const versionId = d.result.versionId;
        for (const line of foodLinesFromProduction(d.result.recipeName, versionId, d.base, d.result)) {
          if (seen.has(line.key)) continue;
          seen.add(line.key);
          keys.push(line.key);
        }
      }
    }
    for (const m of packItems.data ?? []) keys.push(manualKey(m.id));
    const checked = new Set(packChecks.data ?? []);
    return { total: keys.length, packed: keys.filter((k) => checked.has(k)).length };
  }, [dishes, graph.data, packItems.data, packChecks.data]);

  /* ---- Generation ---- */
  const generate = async () => {
    const stepRows = (steps.data ?? []).filter((s) => menuRecipeIds.includes(s.recipe_id));
    const inserts = pendingGeneration({
      eventId,
      eventDate: event.event_date,
      steps: stepRows.map((step) => ({ step, recipeId: step.recipe_id })),
      existing: allTasks,
    });
    if (inserts.length === 0) {
      toast.success("Prep plan is already up to date");
      return;
    }
    setGenerating(true);
    const { error } = await supabase.from("event_tasks").insert(inserts);
    setGenerating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["event-tasks", eventId] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
    toast.success(`${inserts.length} prep ${inserts.length === 1 ? "task" : "tasks"} added`);
  };

  /* ---- Task editing ---- */
  const openSheet = (task?: EventTaskRow) => {
    scrollY.current = window.scrollY;
    if (task) {
      setEditing(task);
      setDraft({
        name: task.name,
        scheduled_date: task.scheduled_date ?? "",
        approximate_minutes: task.approximate_minutes == null ? "" : String(task.approximate_minutes),
        assignment: task.assignment,
        status: task.status as TaskStatus,
        notes: task.notes ?? "",
      });
    } else {
      setEditing(null);
      setDraft(emptyDraft(event.event_date ?? today));
    }
    setOpen(true);
  };

  const closeSheet = () => {
    setOpen(false);
    setEditing(null);
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["event-tasks", eventId] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the task a name");
      return;
    }
    const minutes =
      draft.approximate_minutes.trim() === ""
        ? null
        : Math.max(0, Math.round(Number(draft.approximate_minutes) || 0));
    setSaving(true);
    const patch = {
      name,
      scheduled_date: draft.scheduled_date || null,
      approximate_minutes: minutes,
      assignment: draft.assignment,
      status: draft.status,
      notes: draft.notes.trim() || null,
      completed_at: draft.status === "done" ? (editing?.completed_at ?? new Date().toISOString()) : null,
    };
    const { error } = editing
      ? await supabase.from("event_tasks").update(patch).eq("id", editing.id)
      : await supabase.from("event_tasks").insert({
          ...patch,
          event_id: eventId,
          source: "manual",
          sort_order: allTasks.length + 1,
        });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
    toast.success(editing ? "Task updated" : `${name} added`);
    closeSheet();
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("event_tasks").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
    toast.success("Task removed");
    closeSheet();
  };

  // Completing a task only changes the task. Production, shopping, packing,
  // event status and finance are untouched.
  const cycle = async (task: EventTaskRow) => {
    const status = nextStatus(task.status);
    const { error } = await supabase
      .from("event_tasks")
      .update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  };

  if (menu.isLoading || graph.isLoading || tasks.isLoading)
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  const hasLinkedMenu = dishes.length > 0;
  const shifts = shiftsQ.data ?? [];
  const helpOn = (date: string | null) =>
    shifts.filter((sh) => !sh.is_owner && sh.work_type === "prep" && date && sh.shift_date === date);
  const lt = labourTotals(shifts);
  const staffDetail =
    shifts.length === 0
      ? "No staff planned"
      : [
          lt.unassigned > 0
            ? `${lt.unassigned} ${lt.unassigned === 1 ? "person" : "people"} still needed`
            : `${lt.people + (lt.owner ? 1 : 0)} ${lt.people + (lt.owner ? 1 : 0) === 1 ? "person" : "people"}`,
          lt.unassigned > 0
            ? null
            : [lt.people ? `${lt.people} ${lt.people === 1 ? "helper" : "helpers"}` : null, lt.owner ? "1 owner" : null]
                .filter(Boolean)
                .join(" · "),
          `Estimated labour ${fmtMoney(lt.estimated, event.currency) ?? "£0"}`,
        ]
          .filter(Boolean)
          .join(" · ");
  const stepCount = (steps.data ?? []).length;

  return (
    <div className="pb-6">
      <div>
        <div className="font-display text-[26px] leading-none">Plan</div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {event.event_date ? fmtDateLong(event.event_date) : "Date TBC"}
          {guests > 0 ? ` · ${guests} guests` : ""}
        </div>
      </div>

      {/* PREP */}
      <div className="mt-5">
        <SectionHeading title="Prep" />
        <TornCard className="px-4 py-3 shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[13px]">
              {allTasks.length} {allTasks.length === 1 ? "task" : "tasks"} ·{" "}
              {allTasks.length - outstanding} complete
            </span>
            {allTasks.length > 0 ? (
              <span className="font-mono text-[11px] text-ink-soft">{outstanding} outstanding</span>
            ) : null}
          </div>
          <div className="mt-2 h-1.5 w-full bg-ink/10">
            <div
              className="h-full bg-ink"
              style={{
                width: `${allTasks.length ? ((allTasks.length - outstanding) / allTasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </TornCard>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating || !hasLinkedMenu || stepCount === 0}
            className="tap border border-ink bg-ink px-3 py-3 text-center font-semibold text-cream disabled:opacity-40"
          >
            {generating ? "Generating…" : "Generate prep plan"}
          </button>
          <button
            type="button"
            onClick={() => openSheet()}
            className="tap border border-ink/20 bg-cream px-3 py-3 text-center font-mono text-[12px]"
          >
            + Add task
          </button>
        </div>

        {!hasLinkedMenu || stepCount === 0 ? (
          <div className="mt-3 border border-dashed border-ink/25 bg-cream px-4 py-4 font-mono text-[11px] leading-relaxed text-ink-soft">
            {!hasLinkedMenu ? (
              <>
                <p className="text-ink">No recipe prep can be generated yet.</p>
                <p className="mt-1">
                  Add Recipe Library dishes to the confirmed Menu to generate prep tasks.
                </p>
              </>
            ) : (
              <>
                <p className="text-ink">No prep steps on these recipes yet.</p>
                <p className="mt-1">Add prep steps in the Recipe Library to plan them automatically.</p>
              </>
            )}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>
            Outstanding
          </Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          <Chip active={filter === "done"} onClick={() => setFilter("done")}>
            Done
          </Chip>
        </div>
        {filter === "open" && allTasks.length - outstanding > 0 ? (
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-2 font-mono text-[11px] text-ink-soft underline"
          >
            {allTasks.length - outstanding} done {allTasks.length - outstanding === 1 ? "task" : "tasks"} hidden · show all
          </button>
        ) : null}

        <div className="mt-4 space-y-5">
          {days.length === 0 ? (
            <EmptyNote>
              {allTasks.length === 0 ? "No prep tasks yet." : filter === "done" ? "Nothing completed yet." : "All prep is done."}
            </EmptyNote>
          ) : (
            days.map((day) => {
              const overdue = day.date !== null && day.date < today && day.outstanding > 0;
              const isEventDay = day.date !== null && day.date === event.event_date;
              return (
                <div key={day.key}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h2 className={`label-hand ${overdue ? "text-flame" : "text-ink-soft"}`}>
                      {day.date ? fmtDateLong(day.date) : "Unscheduled"}
                      {isEventDay ? " · Event day" : ""}
                      {overdue ? " · Overdue" : ""}
                    </h2>
                    <span className="font-mono text-[10px] text-ink-soft">
                      {day.tasks.length} {day.tasks.length === 1 ? "task" : "tasks"}
                      {fmtMinutes(day.minutes) ? ` · approx. ${fmtMinutes(day.minutes)}` : ""}
                    </span>
                  </div>
                  <TornCard className={`px-4 pb-3 pt-1 shadow-card ${overdue ? "outline-1 outline-flame/40" : ""}`}>
                    {day.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        quantity={taskQuantity(t, production)}
                        recipeId={t.recipe_id}
                        onToggle={() => cycle(t)}
                        onEdit={() => openSheet(t)}
                      />
                    ))}
                  </TornCard>
                  {helpOn(day.date).length > 0 ? (
                    <div className="mt-1.5 border border-ink/15 bg-cream px-4 py-2">
                      <div className="label-mono text-ink-soft">Extra help</div>
                      {helpOn(day.date).map((sh) => (
                        <div key={sh.id} className="flex justify-between font-mono text-[12px]">
                          <span className="font-semibold">{shiftName(sh, staffQ.data ?? [])}</span>
                          <span>{sh.start_time?.slice(0, 5) ?? "--:--"}–{sh.end_time?.slice(0, 5) ?? "--:--"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Other operational systems — summarised, not duplicated */}
      <div className="mt-7 space-y-2">
        <SectionHeading title="Rest of the job" />
        <SummaryRow
          label="Shopping"
          detail={`${shopping.total} items · ${shopping.collected} collected`}
          eventId={eventId}
          section="shopping"
          action="View Shopping"
        />
        <SummaryRow
          label="Packing"
          detail={`${packing.total} items · ${packing.packed} packed`}
          eventId={eventId}
          section="packing"
          action="View Packing"
        />
        <SummaryRow
          label="Event Kit"
          detail={(() => {
            const k = kitSummary(kitLines(kitRowsQ.data ?? [], kitItemsQ.data ?? [], event.guest_count ?? 0));
            if (!k.total) return "No kit added yet";
            return `${k.total} items · ${k.toBuy} still to buy · ${k.notPacked} not packed${k.missing ? ` · ${k.missing} missing` : ""}`;
          })()}
          eventId={eventId}
          section="more"
          action="View Kit"
        />
        <SummaryRow
          label="Staff"
          detail={staffDetail}
          eventId={eventId}
          section="staff"
          action="View Staff"
        />
      </div>

      <div className="mt-7" id="event-day">
        <SectionHeading title={`Event day${event.event_date ? ` · ${fmtDateLong(event.event_date)}` : ""}`} />
        <EventRunSheet event={event} />
      </div>

      <Drawer open={open} onOpenChange={(o) => !o && closeSheet()} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {editing ? "Edit task" : "Add task"}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Task" required>
                <TextInput
                  placeholder="Collect Costco order"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Scheduled date">
                <TextInput
                  type="date"
                  value={draft.scheduled_date}
                  onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Approx. minutes">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.approximate_minutes}
                    onChange={(e) => setDraft({ ...draft, approximate_minutes: e.target.value })}
                  />
                </Field>
                <Field label="Assignment">
                  <SelectInput
                    value={draft.assignment}
                    onChange={(e) => setDraft({ ...draft, assignment: e.target.value })}
                  >
                    {ASSIGNMENTS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Status">
                <SelectInput
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Notes">
                <TextArea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </Field>
              {editing ? (
                <>
                  <div className="font-mono text-[10px] text-ink-soft">
                    {editing.source === "recipe"
                      ? "Generated from a recipe prep step. Changes here stay on this event only."
                      : "Manual task."}{" "}
                    Currently {statusTaskLabel(editing.status).toLowerCase()}.
                  </div>
                  <button
                    type="button"
                    onClick={remove}
                    className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame"
                  >
                    Remove task
                  </button>
                </>
              ) : null}
            </div>
            <div className="mt-1 space-y-2 pb-3">
              <PrimaryButton disabled={saving} onClick={save}>
                {editing ? "Save task" : "Add task"}
              </PrimaryButton>
              <GhostButton className="w-full" onClick={closeSheet}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SummaryRow({
  label,
  detail,
  eventId,
  section,
  action,
}: {
  label: string;
  detail: string;
  eventId: string;
  section: "shopping" | "packing" | "staff" | "more";
  action: string;
}) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId }}
      search={{ s: section }}
      replace
      className="flex items-center justify-between gap-3 border border-ink/15 bg-cream px-4 py-3 text-ink"
    >
      <div className="min-w-0">
        <div className="label-mono text-ink-soft">{label}</div>
        <div className="font-mono text-[12px]">{detail}</div>
      </div>
      <span className="label-mono shrink-0 text-flame">{action} →</span>
    </Link>
  );
}
