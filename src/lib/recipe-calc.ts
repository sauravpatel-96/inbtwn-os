import type { BaseUnit } from "./units";
import { fmtQty, fmtCost } from "./units";

/* ---------- Graph inputs (all quantities already canonical) ---------- */

export type CalcIngredient = {
  id: string;
  name: string;
  base_unit: BaseUnit;
  yield_percentage: number;
  current_unit_cost: number | null;
  allergens: string[];
};

export type CalcVersion = {
  id: string;
  recipe_id: string;
  recipe_name: string;
  version_number: number;
  base_yield_quantity: number; // canonical
  base_yield_unit: BaseUnit;
  default_portion_quantity: number | null;
  ingredients: {
    id: string;
    ingredient_id: string;
    quantity: number; // canonical
    prep_note: string | null;
    sort_order: number;
  }[];
  components: {
    id: string;
    child_recipe_version_id: string;
    quantity: number; // canonical, in the child's yield unit
    sort_order: number;
  }[];
};

export type CalcGraph = {
  ingredients: Record<string, CalcIngredient>;
  versions: Record<string, CalcVersion>;
};

/* ---------- Results ---------- */

export type IngredientLine = {
  ingredientId: string;
  name: string;
  baseUnit: BaseUnit;
  prepNote: string | null;
  usable: number;
  yieldPct: number;
  raw: number;
  unitCost: number | null;
  cost: number | null;
};

export type ComponentLine = {
  versionId: string;
  name: string;
  versionNumber: number;
  baseUnit: BaseUnit;
  required: number;
  result: ScaleResult;
};

export type ScaleResult = {
  versionId: string;
  recipeName: string;
  baseUnit: BaseUnit;
  required: number; // canonical production requirement
  baseYield: number;
  multiplier: number;
  ingredients: IngredientLine[];
  components: ComponentLine[];
  cost: number; // sum of known costs (ingredients + components)
  missingCost: string[]; // ingredient names lacking a unit cost
  allergens: string[];
};

export class CalcError extends Error {}

/** Recursively scale a recipe version to a required canonical output quantity. */
export function scaleVersion(
  versionId: string,
  required: number,
  graph: CalcGraph,
  seen: string[] = [],
): ScaleResult {
  const v = graph.versions[versionId];
  if (!v) throw new CalcError("Recipe version not found");
  if (seen.includes(v.recipe_id))
    throw new CalcError(`Circular recipe dependency involving ${v.recipe_name}`);
  if (!(v.base_yield_quantity > 0)) throw new CalcError(`${v.recipe_name} has no base yield`);

  const multiplier = required / v.base_yield_quantity;
  const missingCost: string[] = [];
  const allergens = new Set<string>();
  let cost = 0;

  const ingredients: IngredientLine[] = [...v.ingredients]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ri) => {
      const ing = graph.ingredients[ri.ingredient_id];
      const yieldPct = ing?.yield_percentage ?? 100;
      const usable = ri.quantity * multiplier;
      const raw = usable / (yieldPct / 100);
      const unitCost = ing?.current_unit_cost ?? null;
      const lineCost = unitCost === null ? null : raw * unitCost;
      if (lineCost === null) missingCost.push(ing?.name ?? "Unknown ingredient");
      else cost += lineCost;
      for (const a of ing?.allergens ?? []) allergens.add(a);
      return {
        ingredientId: ri.ingredient_id,
        name: ing?.name ?? "Unknown ingredient",
        baseUnit: ing?.base_unit ?? "g",
        prepNote: ri.prep_note,
        usable,
        yieldPct,
        raw,
        unitCost,
        cost: lineCost,
      };
    });

  const components: ComponentLine[] = [...v.components]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rc) => {
      const childRequired = rc.quantity * multiplier;
      const child = graph.versions[rc.child_recipe_version_id];
      const result = scaleVersion(rc.child_recipe_version_id, childRequired, graph, [
        ...seen,
        v.recipe_id,
      ]);
      cost += result.cost;
      for (const n of result.missingCost) missingCost.push(n);
      for (const a of result.allergens) allergens.add(a);
      return {
        versionId: rc.child_recipe_version_id,
        name: child?.recipe_name ?? "Unknown recipe",
        versionNumber: child?.version_number ?? 1,
        baseUnit: child?.base_yield_unit ?? "g",
        required: childRequired,
        result,
      };
    });

  return {
    versionId,
    recipeName: v.recipe_name,
    baseUnit: v.base_yield_unit,
    required,
    baseYield: v.base_yield_quantity,
    multiplier,
    ingredients,
    components,
    cost,
    missingCost: [...new Set(missingCost)],
    allergens: [...allergens].sort(),
  };
}

/** production requirement = guests x per guest x uptake x buffer */
export function productionRequirement(
  guests: number,
  perGuest: number,
  uptakePct: number,
  bufferPct: number,
): number {
  return guests * perGuest * (uptakePct / 100) * (1 + bufferPct / 100);
}

/** Allergen names present anywhere in a recipe version tree. */
export function versionAllergens(versionId: string, graph: CalcGraph): string[] {
  const out = new Set<string>();
  const walk = (id: string, seen: string[]) => {
    const v = graph.versions[id];
    if (!v || seen.includes(id)) return;
    for (const ri of v.ingredients)
      for (const a of graph.ingredients[ri.ingredient_id]?.allergens ?? []) out.add(a);
    for (const rc of v.components) walk(rc.child_recipe_version_id, [...seen, id]);
  };
  walk(versionId, []);
  return [...out].sort();
}

/* ---------- Deterministic calculation trace ---------- */

const num = (n: number) => {
  const r = Math.round(n * 10000) / 10000;
  return String(r);
};

export function buildTrace(
  result: ScaleResult,
  input:
    | { mode: "profile"; guests: number; perGuest: number; uptake: number; buffer: number }
    | { mode: "target" },
): string[] {
  const lines: string[] = [];
  const u = result.baseUnit;
  if (input.mode === "profile") {
    lines.push(
      `${input.guests} guests × ${num(input.perGuest)}${u}/person × ${num(input.uptake)}% uptake × ${num(
        1 + input.buffer / 100,
      )} buffer`,
    );
    lines.push(`= ${num(result.required)}${u} = ${fmtQty(result.required, u)} ${result.recipeName}`);
  } else {
    lines.push(`Target production: ${num(result.required)}${u} = ${fmtQty(result.required, u)}`);
  }
  lines.push(`Base recipe yield: ${num(result.baseYield)}${u} (${fmtQty(result.baseYield, u)})`);
  lines.push(
    `Recipe multiplier: ${num(result.required)} ÷ ${num(result.baseYield)} = ${num(result.multiplier)}×`,
  );
  for (const i of result.ingredients) {
    lines.push(
      `${i.name}: ${num(i.usable / result.multiplier)}${i.baseUnit} × ${num(result.multiplier)} = ${num(
        i.usable,
      )}${i.baseUnit} usable`,
    );
    if (i.yieldPct !== 100)
      lines.push(
        `  yield ${num(i.yieldPct)}% → ${num(i.usable)} ÷ ${num(i.yieldPct / 100)} = ${num(i.raw)}${i.baseUnit} raw`,
      );
    if (i.cost !== null)
      lines.push(`  cost ${num(i.raw)} × ${fmtCost(i.unitCost ?? 0)} = ${fmtCost(i.cost)}`);
  }
  for (const c of result.components) {
    lines.push(
      `${c.name} (component): ${num(c.required / result.multiplier)}${c.baseUnit} × ${num(
        result.multiplier,
      )} = ${num(c.required)}${c.baseUnit}`,
    );
    for (const sub of buildTrace(c.result, { mode: "target" }).slice(1)) lines.push(`  ${sub}`);
  }
  return lines;
}
