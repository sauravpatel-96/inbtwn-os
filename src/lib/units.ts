/**
 * Canonical units: g (weight), ml (volume), each (count).
 * No weight<->volume conversion is ever performed.
 */
export type BaseUnit = "g" | "ml" | "each";
export type DisplayUnit = "g" | "kg" | "ml" | "L" | "each";

export const BASE_UNITS: { value: BaseUnit; label: string }[] = [
  { value: "g", label: "Weight (g)" },
  { value: "ml", label: "Volume (ml)" },
  { value: "each", label: "Count (each)" },
];

const UNIT_META: Record<DisplayUnit, { base: BaseUnit; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  L: { base: "ml", factor: 1000 },
  each: { base: "each", factor: 1 },
};

/** Friendly entry units that are compatible with a canonical base unit. */
export function unitsFor(base: BaseUnit): DisplayUnit[] {
  if (base === "g") return ["g", "kg"];
  if (base === "ml") return ["ml", "L"];
  return ["each"];
}

export function baseOf(unit: DisplayUnit): BaseUnit {
  return UNIT_META[unit].base;
}

export function compatible(a: BaseUnit, b: BaseUnit): boolean {
  return a === b;
}

/** Convert a friendly quantity into canonical base units. */
export function toBase(quantity: number, unit: DisplayUnit): number {
  return quantity * UNIT_META[unit].factor;
}

/** Convert canonical quantity into a friendly unit. */
export function fromBase(quantity: number, unit: DisplayUnit): number {
  return quantity / UNIT_META[unit].factor;
}

function trim(n: number, dp: number): string {
  const s = n.toFixed(dp);
  return s.replace(/\.?0+$/, "");
}

/** 3500 g -> "3.5 kg"; 750 ml -> "750 ml"; 2500 ml -> "2.5 L"; 40 -> "40 each" */
export function fmtQty(baseQty: number | null | undefined, base: BaseUnit): string {
  if (baseQty === null || baseQty === undefined || Number.isNaN(baseQty)) return "—";
  if (base === "each") {
    const rounded = Math.round(baseQty * 100) / 100;
    return `${trim(rounded, 2)} each`;
  }
  const big = base === "g" ? "kg" : "L";
  if (Math.abs(baseQty) >= 1000) return `${trim(baseQty / 1000, 2)} ${big}`;
  return `${trim(Math.round(baseQty * 100) / 100, 2)} ${base}`;
}

/** Big headline split, e.g. { value: "5.51", unit: "KG" } */
export function bigQty(baseQty: number, base: BaseUnit): { value: string; unit: string } {
  const full = fmtQty(baseQty, base);
  const idx = full.lastIndexOf(" ");
  return { value: full.slice(0, idx), unit: full.slice(idx + 1).toUpperCase() };
}

/** Pick the natural display unit for a canonical quantity. */
export function displayUnitFor(baseQty: number, base: BaseUnit): DisplayUnit {
  if (base === "each") return "each";
  if (Math.abs(baseQty) >= 1000) return base === "g" ? "kg" : "L";
  return base;
}

export function fmtCost(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

/** "£6.00/kg" — cost is stored per canonical base unit. */
export function fmtUnitCost(costPerBase: number | null | undefined, base: BaseUnit): string {
  if (costPerBase === null || costPerBase === undefined) return "No cost";
  if (base === "each") return `${fmtCost(costPerBase)}/each`;
  const big = base === "g" ? "kg" : "L";
  return `${fmtCost(costPerBase * 1000)}/${big}`;
}

/** £30 for 5 kg -> 0.006 per g */
export function deriveUnitCost(price: number, quantity: number, unit: DisplayUnit): number {
  return price / toBase(quantity, unit);
}
