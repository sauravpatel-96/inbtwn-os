import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SectionHeading, TornCard, EmptyNote, GhostButton } from "@/components/inbtwn/bits";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery, portionLabel, fmtPortion, type MenuItem, type PortionSize } from "@/lib/menu-queries";
import {
  versionBuffersQuery,
  dishBuffer,
  fmtProdQty,
  bigProdQty,
  collectIngredients,
  type TotalLine,
} from "@/lib/production";
import { buildTrace, scaleVersion, type ComponentLine, type ScaleResult } from "@/lib/recipe-calc";
import { fmtCost, fmtQty, type BaseUnit } from "@/lib/units";

type Dish = {
  item: MenuItem;
  name: string;
  base: BaseUnit;
  perGuest: number;
  service: number;
  buffer: number;
  target: number;
  result: ScaleResult | null;
  error: string | null;
};

function num(n: number) {
  return String(Math.round(n * 10000) / 10000);
}

function ComponentRow({ c }: { c: ComponentLine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink/10 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap flex w-full items-baseline justify-between gap-3 py-3 text-left"
      >
        <span className="text-[14px] font-semibold">
          <span className="mr-1.5 font-mono text-[11px] text-ink-soft">{open ? "−" : "+"}</span>
          {c.name}
        </span>
        <span className="font-mono text-[14px]">{fmtProdQty(c.required, c.baseUnit)}</span>
      </button>
      {open ? (
        <div className="mb-3 border-l border-ink/15 pl-3">
          {c.result.ingredients.map((i) => (
            <div key={i.ingredientId} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="text-[13px]">{i.name}</span>
              <span className="text-right font-mono text-[12px]">
                {fmtProdQty(i.usable, i.baseUnit)}
                {i.yieldPct !== 100 ? (
                  <span className="block text-ink-soft">{fmtProdQty(i.raw, i.baseUnit)} raw</span>
                ) : null}
              </span>
            </div>
          ))}
          {c.result.components.map((sub) => (
            <ComponentRow key={sub.versionId} c={sub} />
          ))}
          {c.result.ingredients.length === 0 && c.result.components.length === 0 ? (
            <div className="py-2 font-mono text-[11px] text-ink-soft">No ingredients recorded.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DishCard({ dish, guests }: { dish: Dish; guests: number }) {
  const [showTrace, setShowTrace] = useState(false);
  const r = dish.result;
  const big = r ? bigProdQty(r.required, dish.base) : null;

  const trace = useMemo(() => {
    if (!r) return [];
    const lines = [
      `${guests} guests × ${num(dish.perGuest)}${dish.base}/person`,
      `= ${num(dish.service)}${dish.base} = ${fmtQty(dish.service, dish.base)} service requirement`,
      `${fmtQty(dish.service, dish.base)} × ${num(1 + dish.buffer / 100)} buffer (${num(dish.buffer)}%)`,
      `= ${num(dish.target)}${dish.base} = ${fmtQty(dish.target, dish.base)} production target`,
    ];
    return [...lines, ...buildTrace(r, { mode: "target" }).slice(1)];
  }, [r, guests, dish]);

  return (
    <TornCard className="mb-3 px-4 py-4 pb-5 shadow-card">
      <div className="font-display text-[22px] leading-none uppercase">{dish.name}</div>
      <div className="mt-1 font-mono text-[11px] text-ink-soft">
        {dish.item.recipe_id ? (
          <>
            {portionLabel(dish.item.portion_size as PortionSize)} ·{" "}
            {fmtPortion(dish.perGuest, dish.base)}/person
          </>
        ) : (
          "No quantities until a recipe is linked"
        )}
      </div>

      {dish.error ? (
        <div className="mt-3 bg-flame/10 px-3 py-2 font-mono text-[11px] text-flame">{dish.error}</div>
      ) : !r ? (
        <div className="mt-3 font-mono text-[12px] text-ink-soft">
          Set a guest count and a portion for this dish to see production quantities.
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
            <span className="label-mono text-ink-soft">Service requirement</span>
            <span className="font-mono text-[15px]">{fmtProdQty(dish.service, dish.base)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="label-mono text-ink-soft">Buffer</span>
            <span className="font-mono text-[13px]">+{num(dish.buffer)}%</span>
          </div>

          <div className="mt-2 bg-ink px-4 py-5 text-center text-cream">
            <div className="label-mono text-cream/70">Make</div>
            <div className="font-display text-[48px] leading-none">
              {big?.value}
              <span className="ml-2 text-[24px]">{big?.unit}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-cream/70">
              production target · multiplier {num(r.multiplier)}×
            </div>
          </div>

          {r.components.length ? (
            <div className="mt-4">
              <div className="label-mono mb-1 text-ink-soft">Prep</div>
              {r.components.map((c) => (
                <ComponentRow key={c.versionId} c={c} />
              ))}
            </div>
          ) : null}

          {r.ingredients.length ? (
            <div className="mt-4">
              <div className="label-mono mb-1 text-ink-soft">Direct ingredients</div>
              {r.ingredients.map((i) => (
                <div
                  key={i.ingredientId}
                  className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2 last:border-0"
                >
                  <span className="text-[14px]">{i.name}</span>
                  <span className="text-right font-mono text-[13px]">
                    {fmtProdQty(i.usable, i.baseUnit)}
                    {i.yieldPct !== 100 ? (
                      <span className="block text-ink-soft">{fmtProdQty(i.raw, i.baseUnit)} raw</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="label-mono text-ink-soft">Estimated ingredient cost</span>
            {r.missingCost.length ? (
              <span className="font-mono text-[12px] text-flame">Cost incomplete</span>
            ) : (
              <span className="font-mono text-[15px]">{fmtCost(r.cost)}</span>
            )}
          </div>
          {r.missingCost.length ? (
            <div className="mt-1 font-mono text-[10px] text-ink-soft">
              No cost for: {r.missingCost.join(", ")}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowTrace((s) => !s)}
            className="tap mt-4 w-full border border-ink/20 bg-cream px-4 py-3 font-mono text-[12px]"
          >
            {showTrace ? "Hide calculation" : "How calculated"}
          </button>
          {showTrace ? (
            <pre className="mt-2 whitespace-pre-wrap border border-ink/15 bg-paper px-3 py-3 font-mono text-[11px] leading-relaxed">
              {trace.join("\n")}
            </pre>
          ) : null}
        </>
      )}
    </TornCard>
  );
}

export function EventProduction({ eventId, guestCount }: { eventId: string; guestCount: number | null }) {
  const [showTotals, setShowTotals] = useState(false);
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);

  const guests = guestCount ?? 0;

  const dishes = useMemo<Dish[]>(() => {
    if (!graph.data || !menu.data) return [];
    return menu.data.map((item) => {
      const base = item.quantity_unit as BaseUnit;
      const perGuest = Number(item.quantity_per_guest ?? 0);
      const service = guests * perGuest;
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      const buffer = versionId ? dishBuffer(item, buffers.data) : 0;
      const target = service * (1 + buffer / 100);
      let result: ScaleResult | null = null;
      let error: string | null = null;
      if (!versionId) error = item.recipe_id ? "This dish has no recipe version to calculate from." : "Recipe not linked — link a recipe on the Menu to calculate this dish.";
      else if (guests > 0 && perGuest > 0) {
        try {
          result = scaleVersion(versionId, target, graph.data!);
        } catch (e) {
          error = e instanceof Error ? e.message : "Calculation failed";
        }
      }
      return {
        item,
        name: item.recipe?.name ?? item.dish_name ?? "Dish",
        base,
        perGuest,
        service,
        buffer,
        target,
        result,
        error,
      };
    });
  }, [menu.data, graph.data, buffers.data, guests]);

  const totals = useMemo<TotalLine[]>(() => {
    const map = new Map<string, TotalLine>();
    for (const d of dishes) if (d.result) collectIngredients(d.result, map);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dishes]);

  if (menu.isLoading || graph.isLoading || buffers.isLoading)
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  if (!menu.data?.length)
    return (
      <div>
        <EmptyNote>No menu has been created yet.</EmptyNote>
        <Link to="/events/$eventId" params={{ eventId }} search={{ s: "menu" }} replace className="mt-3 block">
          <GhostButton className="w-full">Go to menu</GhostButton>
        </Link>
      </div>
    );

  return (
    <div className="pb-6">
      <div>
        <div className="font-display text-[26px] leading-none">Production</div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {guests > 0 ? `${guests} guests` : "Guest count not set"}
        </div>
      </div>

      <div className="mt-5">
        <SectionHeading title="Dishes" />
        {dishes.map((d) => (
          <DishCard key={d.item.id} dish={d} guests={guests} />
        ))}
      </div>

      <div className="mt-4">
        <SectionHeading
          title="Total ingredient requirements"
          action={
            showTotals && totals.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowTotals(false)}
                className="tap font-mono text-[11px] text-ink underline decoration-ink/30 underline-offset-4"
              >
                Collapse
              </button>
            ) : undefined
          }
        />
        {totals.length === 0 ? (
          <EmptyNote>No ingredient requirements yet.</EmptyNote>
        ) : !showTotals ? (
          <TornCard className="flex items-center justify-between gap-4 px-4 py-3 shadow-card">
            <span className="font-mono text-[12px]">
              {totals.length} {totals.length === 1 ? "ingredient" : "ingredients"}
            </span>
            <button
              type="button"
              onClick={() => setShowTotals(true)}
              className="tap shrink-0 font-mono text-[11px] text-ink underline decoration-ink/30 underline-offset-4"
            >
              View all
            </button>
          </TornCard>
        ) : (
          <TornCard className="px-4 pb-5 pt-2 shadow-card">
            {totals.map((t) => (
              <div
                key={t.ingredientId}
                className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2.5 last:border-0"
              >
                <span className="text-[14px]">{t.name}</span>
                <span className="text-right font-mono text-[13px]">
                  {fmtProdQty(t.usable, t.baseUnit)}
                  {t.hasYield ? (
                    <span className="block text-ink-soft">{fmtProdQty(t.raw, t.baseUnit)} raw requirement</span>
                  ) : null}
                </span>
              </div>
            ))}
            <div className="space-y-1 pt-4 font-mono text-[10px] leading-relaxed text-ink-soft">
              <p>Quantities shown are usable production requirements.</p>
              <p>Theoretical requirements only — not a shopping list.</p>
            </div>
          </TornCard>
        )}
      </div>
    </div>
  );
}
