/**
 * Menu change safety.
 *
 * The confirmed menu defines CURRENT requirements. Recorded progress (collected
 * shopping, completed/edited prep, packed food) is never silently destroyed:
 * untouched obsolete generated records are removed, meaningful ones are kept
 * and flagged as "no longer required" (orphaned).
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { scheduledDateFor, type EventTaskRow, type PrepStepRow } from "./prep";
import { loadCalcGraph } from "./recipe-queries";
import { scaleVersion, type CalcGraph } from "./recipe-calc";
import { collectPurchases } from "./shopping";

/** A generated recipe task whose dish is no longer on the confirmed menu. */
export function isOrphanTask(
  t: { source: string; recipe_id: string | null },
  menuRecipeIds: Set<string>,
): boolean {
  return t.source === "recipe" && !!t.recipe_id && !menuRecipeIds.has(t.recipe_id);
}

/** True when a generated task still matches its source step defaults exactly. */
export function isUntouchedGenerated(
  t: EventTaskRow,
  step: PrepStepRow | undefined,
  eventDate: string | null,
): boolean {
  if (t.source !== "recipe" || !step) return false;
  if (t.status !== "todo" || t.completed_at) return false;
  return (
    t.name === step.name &&
    t.assignment === step.default_assignment &&
    (t.approximate_minutes ?? null) === (step.approximate_minutes ?? null) &&
    (t.notes ?? null) === (step.notes ?? null) &&
    (t.scheduled_date ?? null) === scheduledDateFor(eventDate, step.recommended_days_before)
  );
}

/** Ingredient ids required by the given version ids (structure only). */
export function ingredientsFor(versionIds: string[], graph: CalcGraph): Set<string> {
  const map = new Map();
  for (const v of versionIds) {
    try {
      collectPurchases(scaleVersion(v, 1, graph), map);
    } catch {
      /* ignore broken versions */
    }
  }
  return new Set(map.keys());
}

export type RemovalSummary = { dish: string; removedTasks: number; preserved: number };

/**
 * Run after a dish has been removed from the menu. Deletes only untouched
 * generated prep tasks for recipes no longer on the menu; counts preserved
 * recorded work (edited/progressed tasks, collected ingredients, packed food).
 */
export async function reconcileMenuRemoval(args: {
  eventId: string;
  dishName: string;
  removedRecipeId: string | null;
  removedVersionId: string | null;
}): Promise<RemovalSummary> {
  const { eventId } = args;
  const [ev, menu, tasks, shop, pack] = await Promise.all([
    supabase.from("events").select("event_date").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_menu_items")
      .select("recipe_id, recipe_version_id, recipe:recipes(active_version_id)")
      .eq("event_id", eventId),
    supabase.from("event_tasks").select("*").eq("event_id", eventId),
    supabase.from("event_shopping_checks").select("ingredient_id").eq("event_id", eventId),
    supabase.from("event_packing_checks").select("item_key").eq("event_id", eventId),
  ]);
  const menuRows = (menu.data ?? []) as unknown as {
    recipe_id: string | null;
    recipe_version_id: string | null;
    recipe: { active_version_id: string | null } | null;
  }[];
  const menuRecipes = new Set(menuRows.map((m) => m.recipe_id).filter(Boolean) as string[]);
  const menuVersions = menuRows
    .map((m) => m.recipe_version_id ?? m.recipe?.active_version_id ?? null)
    .filter(Boolean) as string[];

  // Prep
  const orphans = ((tasks.data ?? []) as EventTaskRow[]).filter((t) => isOrphanTask(t, menuRecipes));
  const stepIds = orphans.map((t) => t.prep_step_id).filter(Boolean) as string[];
  const steps = stepIds.length
    ? ((await supabase.from("recipe_prep_steps").select("*").in("id", stepIds)).data ?? [])
    : [];
  const stepMap = new Map((steps as PrepStepRow[]).map((s) => [s.id, s]));
  const untouched = orphans.filter((t) =>
    isUntouchedGenerated(t, t.prep_step_id ? stepMap.get(t.prep_step_id) : undefined, ev.data?.event_date ?? null),
  );
  if (untouched.length) {
    await supabase.from("event_tasks").delete().in("id", untouched.map((t) => t.id)).eq("status", "todo");
  }
  let preserved = orphans.length - untouched.length;

  // Shopping: collected ingredients no longer needed by any remaining dish
  if (args.removedVersionId && (shop.data ?? []).length) {
    const graph = await loadCalcGraph(supabase);
    const removed = ingredientsFor([args.removedVersionId], graph);
    const remaining = ingredientsFor(menuVersions, graph);
    preserved += (shop.data ?? []).filter(
      (c) => removed.has(c.ingredient_id) && !remaining.has(c.ingredient_id),
    ).length;
  }

  // Packing: packed food line for a version no longer on the menu
  if (args.removedVersionId && !menuVersions.includes(args.removedVersionId)) {
    if ((pack.data ?? []).some((p) => p.item_key === `food:${args.removedVersionId}`)) preserved += 1;
  }

  return { dish: args.dishName, removedTasks: untouched.length, preserved };
}

export function invalidateMenuDownstream(qc: QueryClient, eventId: string) {
  qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
  qc.invalidateQueries({ queryKey: ["event-tasks", eventId] });
  qc.invalidateQueries({ queryKey: ["event-shopping-checks", eventId] });
  qc.invalidateQueries({ queryKey: ["event-packing-checks", eventId] });
  qc.invalidateQueries({ queryKey: ["today-data"] });
}

/** Recipe names by version id, for labelling preserved packed food. */
export const versionNamesQuery = queryOptions({
  queryKey: ["version-recipe-names"],
  queryFn: async () => {
    const res = await supabase.from("recipe_versions").select("id, recipe:recipes!recipe_versions_recipe_id_fkey(name)");
    if (res.error) throw new Error(res.error.message);
    const map: Record<string, string> = {};
    for (const r of (res.data ?? []) as unknown as { id: string; recipe: { name: string } | null }[])
      map[r.id] = r.recipe?.name ?? "Removed dish";
    return map;
  },
});
