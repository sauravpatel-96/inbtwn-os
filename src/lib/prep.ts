/**
 * Prep planning.
 *
 * Recipe prep steps are operational metadata on the Recipe Library. Event tasks
 * are the per-event schedule generated from them (plus manual tasks).
 *
 * Quantities are NEVER calculated here: Plan reads the existing Production
 * result tree (scaleVersion) and simply looks up the matching line.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CalcGraph, ScaleResult } from "./recipe-calc";
import type { BaseUnit } from "./units";
import { fmtProdQty } from "./production";

export type PrepStepRow = Database["public"]["Tables"]["recipe_prep_steps"]["Row"];
export type EventTaskRow = Database["public"]["Tables"]["event_tasks"]["Row"];

export type Assignment = "me" | "helper" | "unassigned";
export type TaskStatus = "todo" | "in_progress" | "done";
export type PrepTarget = "whole" | "component" | "none";

export const ASSIGNMENTS: { value: Assignment; label: string }[] = [
  { value: "me", label: "Me" },
  { value: "helper", label: "Helper" },
  { value: "unassigned", label: "Unassigned" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const STORAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "chilled", label: "Chilled" },
  { value: "frozen", label: "Frozen" },
  { value: "ambient", label: "Ambient" },
];

export const assignmentLabel = (v: string | null | undefined) =>
  ASSIGNMENTS.find((a) => a.value === v)?.label ?? "Unassigned";

export const statusTaskLabel = (v: string | null | undefined) =>
  TASK_STATUSES.find((s) => s.value === v)?.label ?? "To do";

export const storageLabel = (v: string | null | undefined) =>
  STORAGE_OPTIONS.find((s) => s.value === v)?.label ?? "None";

/** "2 hr 15 min" / "45 min" */
export function fmtMinutes(total: number | null | undefined): string | null {
  if (!total || total <= 0) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export const daysBeforeLabel = (n: number) =>
  n <= 0 ? "Event day" : n === 1 ? "1 day before" : `${n} days before`;

/* ---------------- Queries ---------------- */

export const prepStepsQuery = (recipeId: string) =>
  queryOptions({
    queryKey: ["recipe-prep-steps", recipeId],
    queryFn: async () => {
      const res = await supabase
        .from("recipe_prep_steps")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("sort_order")
        .order("created_at");
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as PrepStepRow[];
    },
  });

export const eventTasksQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-tasks", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("scheduled_date", { nullsFirst: false })
        .order("sort_order")
        .order("created_at");
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as EventTaskRow[];
    },
  });

/* ---------------- Production quantity lookup ---------------- */

export type QtyLine = { quantity: number; base: BaseUnit };

/** Per dish-recipe: its whole production target and every descendant component. */
export type DishQuantities = {
  whole: QtyLine;
  components: Map<string, QtyLine>;
};

function walkComponents(result: ScaleResult, graph: CalcGraph, into: Map<string, QtyLine>) {
  for (const c of result.components) {
    const recipeId = graph.versions[c.versionId]?.recipe_id;
    if (recipeId) {
      const prev = into.get(recipeId);
      into.set(recipeId, {
        quantity: (prev?.quantity ?? 0) + c.required,
        base: c.baseUnit,
      });
    }
    walkComponents(c.result, graph, into);
  }
}

/**
 * Index an already-calculated Production result by recipe, so a prep step can
 * look up the quantity it relates to. No calculation happens here.
 */
export function indexProduction(
  entries: { recipeId: string; base: BaseUnit; result: ScaleResult }[],
  graph: CalcGraph,
): Map<string, DishQuantities> {
  const map = new Map<string, DishQuantities>();
  for (const e of entries) {
    const components = new Map<string, QtyLine>();
    walkComponents(e.result, graph, components);
    const prev = map.get(e.recipeId);
    map.set(e.recipeId, {
      whole: { quantity: (prev?.whole.quantity ?? 0) + e.result.required, base: e.base },
      components: prev ? mergeQty(prev.components, components) : components,
    });
  }
  return map;
}

function mergeQty(a: Map<string, QtyLine>, b: Map<string, QtyLine>) {
  const out = new Map(a);
  for (const [k, v] of b) {
    const prev = out.get(k);
    out.set(k, prev ? { quantity: prev.quantity + v.quantity, base: v.base } : v);
  }
  return out;
}

/** Production quantity text for a task, or null when nothing relevant exists. */
export function taskQuantity(
  task: { recipe_id: string | null; component_recipe_id: string | null; source: string },
  production: Map<string, DishQuantities>,
): string | null {
  if (task.source !== "recipe" || !task.recipe_id) return null;
  const dish = production.get(task.recipe_id);
  if (!dish) return null;
  const line = task.component_recipe_id ? dish.components.get(task.component_recipe_id) : dish.whole;
  if (!line || !(line.quantity > 0)) return null;
  return fmtProdQty(line.quantity, line.base);
}

/* ---------------- Generation ---------------- */

export function scheduledDateFor(eventDate: string | null, daysBefore: number): string | null {
  if (!eventDate) return null;
  const d = new Date(`${eventDate}T00:00:00`);
  d.setDate(d.getDate() - Math.max(0, daysBefore));
  return d.toISOString().slice(0, 10);
}

export type GeneratedTaskInsert = {
  event_id: string;
  recipe_id: string;
  prep_step_id: string;
  component_recipe_id: string | null;
  name: string;
  scheduled_date: string | null;
  approximate_minutes: number | null;
  assignment: string;
  status: TaskStatus;
  source: "recipe";
  notes: string | null;
  sort_order: number;
  generated_at: string;
};

/**
 * Duplicate-safe: only prep steps that have no existing task on this event are
 * returned. Existing tasks — including edited or completed ones — are left
 * exactly as they are, and manual tasks are never touched.
 */
export function pendingGeneration(args: {
  eventId: string;
  eventDate: string | null;
  steps: { step: PrepStepRow; recipeId: string }[];
  existing: EventTaskRow[];
}): GeneratedTaskInsert[] {
  const done = new Set(
    args.existing.filter((t) => t.prep_step_id).map((t) => t.prep_step_id as string),
  );
  const now = new Date().toISOString();
  return args.steps
    .filter(({ step }) => !done.has(step.id))
    .map(({ step, recipeId }, i) => ({
      event_id: args.eventId,
      recipe_id: recipeId,
      prep_step_id: step.id,
      component_recipe_id: step.target === "component" ? step.component_recipe_id : null,
      name: step.name,
      scheduled_date: scheduledDateFor(args.eventDate, step.recommended_days_before),
      approximate_minutes: step.approximate_minutes,
      assignment: step.default_assignment,
      status: "todo" as const,
      source: "recipe" as const,
      notes: step.notes,
      sort_order: step.sort_order + i,
      generated_at: now,
    }));
}

/* ---------------- Grouping ---------------- */

export type TaskDay = {
  key: string;
  date: string | null;
  tasks: EventTaskRow[];
  minutes: number;
  outstanding: number;
};

export function groupByDate(tasks: EventTaskRow[]): TaskDay[] {
  const map = new Map<string, EventTaskRow[]>();
  for (const t of tasks) {
    const key = t.scheduled_date ?? "unscheduled";
    map.set(key, [...(map.get(key) ?? []), t]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "unscheduled" ? 1 : b[0] === "unscheduled" ? -1 : a[0].localeCompare(b[0])))
    .map(([key, rows]) => ({
      key,
      date: key === "unscheduled" ? null : key,
      tasks: rows,
      minutes: rows
        .filter((t) => t.status !== "done")
        .reduce((s, t) => s + (t.approximate_minutes ?? 0), 0),
      outstanding: rows.filter((t) => t.status !== "done").length,
    }));
}
