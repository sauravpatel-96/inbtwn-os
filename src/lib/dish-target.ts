/* Pure, isomorphic dish quantity rules (safe for server and browser). */

/**
 * Buffer % for a menu dish. Buffer is a production setting, so it follows the
 * recipe's CURRENT active version (the latest saved setting, including an
 * explicit 0%), even when the dish is pinned to an older version's ingredients.
 * Falls back to the pinned version, then 0 — never an assumed default.
 */
export function dishBuffer(
  item: { recipe_version_id: string | null; recipe?: { active_version_id: string | null } | null },
  buffers: Record<string, number> | undefined,
): number {
  const active = item.recipe?.active_version_id ?? null;
  if (active && buffers && active in buffers) return buffers[active] ?? 0;
  const pinned = item.recipe_version_id;
  if (pinned && buffers && pinned in buffers) return buffers[pinned] ?? 0;
  return 0;
}

/** Remove float noise (e.g. 33.750000000000004) before ceiling counts. */
export const ceilCount = (n: number) => Math.ceil(Math.round(n * 1e6) / 1e6);

export type DishTarget = {
  fixed: boolean;
  /** guests × per-guest (0 in fixed mode) */
  service: number;
  /** buffer actually applied (0 in fixed mode) */
  buffer: number;
  /** final production target in base units; whole number for "each" */
  target: number;
};

/**
 * Single source of truth for a menu dish's production target.
 * Per guest: guests × per-guest × (1 + buffer%), counts rounded UP to whole items.
 * Fixed: the entered number IS the final target — no buffer, ignores guest count.
 * Returns null when nothing can be calculated.
 */
export function dishTarget(
  item: {
    quantity_unit: string;
    quantity_per_guest: number | string | null;
    quantity_mode?: string | null;
    fixed_quantity?: number | string | null;
  },
  guests: number,
  bufferPct: number,
): DishTarget | null {
  const each = item.quantity_unit === "each";
  if (item.quantity_mode === "fixed") {
    const q = Number(item.fixed_quantity ?? 0);
    if (!(q > 0)) return null;
    return { fixed: true, service: 0, buffer: 0, target: each ? ceilCount(q) : q };
  }
  const pg = Number(item.quantity_per_guest ?? 0);
  if (!(guests > 0) || !(pg > 0)) return null;
  const service = guests * pg;
  const raw = service * (1 + bufferPct / 100);
  return { fixed: false, service, buffer: bufferPct, target: each ? ceilCount(raw) : raw };
}

