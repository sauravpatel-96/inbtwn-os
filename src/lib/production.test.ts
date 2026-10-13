import {expect,test} from "vitest";
import {dishBuffer, fmtProdQty} from "./production";
const b={v1:5,v4:0,v5:10};
test("active 0% wins over pinned 5%",()=>expect(dishBuffer({recipe_version_id:"v1",recipe:{active_version_id:"v4"}},b)).toBe(0));
test("45 each",()=>{for(const [p,e] of [[5,48],[0,45],[10,50]] as const) expect(fmtProdQty(45*(1+p/100),"each")).toBe(`${e} each`)});
test("20x1.1=22",()=>expect(fmtProdQty(20*1.1,"each")).toBe("22 each"));
import { dishTarget } from "./dish-target";
import { portionQuantity } from "./menu-queries";
const each = (pg: number) => ({ quantity_unit: "each", quantity_per_guest: pg, quantity_mode: "per_guest", fixed_quantity: null });
test("fractional per-guest counts, 45 guests 0%", () => {
  expect(dishTarget(each(0.5), 45, 0)?.target).toBe(23);
  expect(dishTarget(each(0.75), 45, 0)?.target).toBe(34);
  expect(dishTarget(each(1), 45, 0)?.target).toBe(45);
});
test("0.75/person buffers 0/5/10 → 34/36/38", () => {
  expect(dishTarget(each(0.75), 45, 0)?.target).toBe(34);
  expect(dishTarget(each(0.75), 45, 5)?.target).toBe(36);
  expect(dishTarget(each(0.75), 45, 10)?.target).toBe(38);
});
test("fixed 34 ignores guests and buffer", () => {
  const f = { quantity_unit: "each", quantity_per_guest: 1, quantity_mode: "fixed", fixed_quantity: 34 };
  expect(dishTarget(f, 45, 10)?.target).toBe(34);
  expect(dishTarget(f, 60, 10)?.target).toBe(34);
});
test("weight dishes keep full precision", () => {
  expect(dishTarget({ quantity_unit: "g", quantity_per_guest: 75, quantity_mode: "per_guest", fixed_quantity: null }, 45, 5)?.target).toBeCloseTo(3543.75);
});
test("recipe preset wins over standard × factor", () => {
  expect(portionQuantity(1, "medium", { portion_medium: 1.5 })).toBe(1.5);
  expect(portionQuantity(1, "medium", null)).toBe(0.75);
});
