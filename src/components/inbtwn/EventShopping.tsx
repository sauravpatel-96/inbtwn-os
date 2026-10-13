import { allPurchaseOptionsQuery, purchaseFromScratch } from "@/lib/costing";
import { usePersistentState } from "@/lib/tab-memory";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, TornCard, EmptyNote, GhostButton, Chip } from "@/components/inbtwn/bits";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery } from "@/lib/menu-queries";
import { versionBuffersQuery, dishBuffer, dishTarget } from "@/lib/production";
import { collectPurchases, fmtShopQty, shoppingCheckDetailsQuery, type ShoppingCheck, type ShoppingLine } from "@/lib/shopping";
import { scaleVersion, type ScaleResult } from "@/lib/recipe-calc";
import { fmtCost, type BaseUnit } from "@/lib/units";
import { eventKitQuery, kitItemsQuery, kitLines } from "@/lib/kit";

type Filter = "all" | "tobuy" | "collected";

const num = (n: number) => String(Math.round(n * 10000) / 10000);

function Detail({ line }: { line: ShoppingLine }) {
  return (
    <div className="mt-2 border-t border-ink/10 pt-2 font-mono text-[11px] leading-relaxed text-ink-soft">
      <div>Need {fmtShopQty(line.usable, line.baseUnit)} usable</div>
      <div>{num(line.yieldPct)}% yield</div>
      <div className="text-ink">Buy {fmtShopQty(line.purchase, line.baseUnit)}</div>
      <div className="mt-1">
        {line.cost === null ? "No cost recorded" : `Estimated cost ${fmtCost(line.cost)}`}
      </div>
    </div>
  );
}

function ShoppingRow({
  line,
  collected,
  onToggle,
  note,
}: {
  line: ShoppingLine;
  collected: boolean;
  onToggle: () => void;
  note?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const canExplain = line.yieldPct !== 100;
  return (
    <div className="border-b border-ink/10 last:border-0">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={collected}
          aria-label={`${collected ? "Uncollect" : "Collect"} ${line.name}`}
          className="tap -ml-2 flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
              collected ? "border-ink bg-ink text-cream" : "border-ink/40 bg-paper"
            }`}
          >
            {collected ? "✓" : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={() => canExplain && setOpen((o) => !o)}
          className={`flex min-h-[40px] flex-1 items-center justify-between gap-3 py-1 text-left ${
            canExplain ? "tap" : "cursor-default"
          } ${collected ? "text-ink-soft line-through opacity-60" : ""}`}
        >
          <span className="text-[14px] leading-tight">
            {line.name}
            {canExplain ? <span className="ml-1.5 font-mono text-[10px] text-ink-soft">ⓘ</span> : null}
          </span>
          <span className="shrink-0 text-right font-mono text-[14px]">
            {fmtShopQty(line.purchase, line.baseUnit)}
          </span>
        </button>
      </div>
      {note ? <div className="-mt-1 pb-1.5 pl-9 font-mono text-[10px] text-flame">{note}</div> : null}
      {open && canExplain ? <Detail line={line} /> : null}
    </div>
  );
}


function NonFood({ eventId, lines }: { eventId: string; lines: { id: string; name: string; qty: number; reusable: boolean }[] }) {
  if (!lines.length) return null;
  return (
    <div className="mt-4">
      <SectionHeading title="Non-food to buy" />
      <TornCard className="px-4 py-2 shadow-card">
        {lines.map((l) => (
          <div key={l.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2 last:border-0">
            <span className="text-[14px]">{l.name}</span>
            <span className="shrink-0 font-mono text-[13px]">
              {l.qty} × <span className="text-ink-soft">{l.reusable ? "to own" : "consumable"}</span>
            </span>
          </div>
        ))}
        <Link to="/events/$eventId" params={{ eventId }} search={{ s: "more" }} replace className="mt-1 block py-2 font-mono text-[11px] text-flame">
          From Event Kit →
        </Link>
      </TornCard>
    </div>
  );
}

export function EventShopping({ eventId, guestCount }: { eventId: string; guestCount: number | null }) {
  const qc = useQueryClient();
  const [filter, setFilter] = usePersistentState<Filter>(`shopping.${eventId}`, "tobuy", ["all","tobuy","collected"] as const);
  const [showMissing, setShowMissing] = useState(false);
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);
  const checks = useQuery(shoppingCheckDetailsQuery(eventId));
  const graphIngredients = graph.data?.ingredients;
  const kitItems = useQuery(kitItemsQuery);
  const kitRows = useQuery(eventKitQuery(eventId));
  const purchaseOpts = useQuery(allPurchaseOptionsQuery);
  const [showPacks, setShowPacks] = useState(false);

  const guests = guestCount ?? 0;

  const lines = useMemo<ShoppingLine[]>(() => {
    if (!graph.data || !menu.data) return [];
    const map = new Map<string, ShoppingLine>();
    for (const item of menu.data) {
      const perGuest = Number(item.quantity_per_guest ?? 0);
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      if (!versionId ) continue;
      const dt = dishTarget(item, guests, dishBuffer(item, buffers.data));
      if (!dt) continue;
      const target = dt.target;
      let result: ScaleResult | null = null;
      try {
        result = scaleVersion(versionId, target, graph.data);
      } catch {
        result = null;
      }
      if (result) collectPurchases(result, map);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [menu.data, graph.data, buffers.data, guests]);

  // Non-food purchases: derived from Event Kit only; never mixed into ingredients.
  const nonFood = useMemo(
    () => kitLines(kitRows.data ?? [], kitItems.data ?? [], guestCount ?? 0).filter((l) => l.toBuy > 0),
    [kitRows.data, kitItems.data, guestCount],
  );

  const checkMap = useMemo(
    () => new Map<string, ShoppingCheck>((checks.data ?? []).map((c) => [c.ingredient_id, c])),
    [checks.data],
  );
  // Collected counts as done unless a recorded quantity is now short of the current need.
  const shortBy = (l: ShoppingLine) => {
    const c = checkMap.get(l.ingredientId);
    if (!c || c.collected_quantity == null) return 0;
    const gap = l.purchase - c.collected_quantity;
    return gap > l.purchase * 0.005 ? gap : 0;
  };
  const collectedSet = useMemo(
    () => new Set(lines.filter((l) => checkMap.has(l.ingredientId) && shortBy(l) === 0).map((l) => l.ingredientId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, checkMap],
  );
  // Collected ingredients no longer required by the current menu.
  const orphanChecks = useMemo(() => {
    const current = new Set(lines.map((l) => l.ingredientId));
    return (checks.data ?? []).filter((c) => !current.has(c.ingredient_id));
  }, [lines, checks.data]);
  const collectedCount = lines.filter((l) => collectedSet.has(l.ingredientId)).length;

  const visible = lines.filter((l) => {
    const done = collectedSet.has(l.ingredientId);
    return filter === "all" ? true : filter === "collected" ? done : !done;
  });

  const noteFor = (l: ShoppingLine) => {
    const c = checkMap.get(l.ingredientId);
    if (!c || c.collected_quantity == null) return null;
    const gap = shortBy(l);
    if (gap > 0)
      return `Collected ${fmtShopQty(c.collected_quantity, l.baseUnit)} · menu changed, ${fmtShopQty(gap, l.baseUnit)} more needed`;
    if (c.collected_quantity - l.purchase > l.purchase * 0.005)
      return `Collected ${fmtShopQty(c.collected_quantity, l.baseUnit)} · now need ${fmtShopQty(l.purchase, l.baseUnit)}`;
    return null;
  };

  const knownCost = lines.reduce((sum, l) => sum + (l.cost ?? 0), 0);
  const missingCost = lines.filter((l) => l.cost === null);
  const scratch = useMemo(() => purchaseFromScratch(lines, purchaseOpts.data ?? []), [lines, purchaseOpts.data]);

  const toggle = async (line: ShoppingLine) => {
    const done = checkMap.has(line.ingredientId);
    const short = shortBy(line) > 0;
    const { error } = short
      ? await supabase
          .from("event_shopping_checks")
          .update({ collected_quantity: line.purchase })
          .eq("event_id", eventId)
          .eq("ingredient_id", line.ingredientId)
      : done
      ? await supabase
          .from("event_shopping_checks")
          .delete()
          .eq("event_id", eventId)
          .eq("ingredient_id", line.ingredientId)
      : await supabase
          .from("event_shopping_checks")
          .insert({ event_id: eventId, ingredient_id: line.ingredientId, collected_quantity: line.purchase });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["event-shopping-checks", eventId] });
  };

  if (menu.isLoading || graph.isLoading || buffers.isLoading)
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  if (!menu.data?.length)
    return (
      <div>
        <EmptyNote>No menu has been created yet.</EmptyNote>
        <Link to="/events/$eventId" params={{ eventId }} search={{ s: "menu" }} replace className="mt-3 block">
          <GhostButton className="w-full">Go to menu</GhostButton>
        </Link>
        <NonFood eventId={eventId} lines={nonFood.map((l) => ({ id: l.row.id, name: l.item.name, qty: l.toBuy, reusable: l.reusable }))} />
      </div>
    );

  return (
    <div className="pb-6">
      <div>
        <div className="font-display text-[26px] leading-none">Shopping</div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {guests > 0 ? `${guests} guests` : "Guest count not set"}
        </div>
      </div>

      <TornCard className="mt-4 px-4 py-3 shadow-card">
        <div className="font-mono text-[13px]">
          {collectedCount} / {lines.length} items collected
        </div>
        <div className="mt-2 h-1.5 w-full bg-ink/10">
          <div
            className="h-full bg-ink"
            style={{ width: `${lines.length ? (collectedCount / lines.length) * 100 : 0}%` }}
          />
        </div>
      </TornCard>

      <div className="mt-3 flex gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        <Chip active={filter === "tobuy"} onClick={() => setFilter("tobuy")}>
          To buy
        </Chip>
        <Chip active={filter === "collected"} onClick={() => setFilter("collected")}>
          Collected
        </Chip>
      </div>

      <div className="mt-4">
        <SectionHeading title="Shopping list" />
        {lines.length === 0 ? (
          <EmptyNote>No ingredient requirements yet.</EmptyNote>
        ) : visible.length === 0 ? (
          <EmptyNote>{filter === "collected" ? "Nothing collected yet." : "Everything collected."}</EmptyNote>
        ) : (
          <TornCard className="px-4 pb-5 pt-2 shadow-card">
            {visible.map((l) => (
              <ShoppingRow
                key={l.ingredientId}
                line={l}
                collected={collectedSet.has(l.ingredientId)}
                onToggle={() => toggle(l)}
                note={noteFor(l)}
              />
            ))}
          </TornCard>
        )}
      </div>

      {lines.length ? (
        <div className="mt-4">
          <SectionHeading title="Ingredient usage cost" />
          <TornCard className="px-4 py-4 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label-mono text-ink-soft">
                {missingCost.length ? "Known costs only" : "Total"}
              </span>
              <span className="font-mono text-[15px]">{fmtCost(knownCost)}</span>
            </div>
            {missingCost.length ? (
              <div className="mt-2 border border-ink/15 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-flame">
                    Costs missing for {missingCost.length} ingredient
                    {missingCost.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMissing((o) => !o)}
                    className="tap label-mono shrink-0 border border-ink/30 px-2 py-1 text-[10px]"
                  >
                    {showMissing ? "Hide" : "Review"}
                  </button>
                </div>
                {showMissing ? (
                  <div className="mt-2 font-mono text-[11px] leading-relaxed text-ink-soft">
                    {missingCost.map((l) => l.name).join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </TornCard>
        </div>
      ) : null}

      {lines.length ? (
        <div className="mt-4">
          <SectionHeading title="Purchase cost from scratch" />
          <TornCard className="px-4 py-4 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label-mono text-ink-soft">{scratch.complete ? "Whole packs" : "Known packs only"}</span>
              <span className="font-mono text-[15px]">{scratch.priced.length ? fmtCost(scratch.total) : "—"}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-soft">
              Cash needed buying full packs from your preferred options, ignoring stock you already have. Usage cost above can be lower.
            </div>
            {!scratch.complete ? (
              <div className="mt-1 font-mono text-[11px] text-flame">
                No pack price for {scratch.unavailable.length} ingredient{scratch.unavailable.length === 1 ? "" : "s"}
              </div>
            ) : null}
            {scratch.priced.length ? (
              <button type="button" onClick={() => setShowPacks((o) => !o)} className="label-mono mt-2 text-[10px] text-flame">
                {showPacks ? "Hide packs" : "Show packs"}
              </button>
            ) : null}
            {showPacks ? (
              <div className="mt-2 space-y-1 font-mono text-[11px]">
                {scratch.priced.map((p) => (
                  <div key={p.ingredientId} className="flex justify-between gap-3">
                    <span>
                      {p.name} · {p.packs} × {p.packLabel} ({p.supplier})
                    </span>
                    <span>{fmtCost(p.cost)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </TornCard>
        </div>
      ) : null}

      {orphanChecks.length ? (
        <div className="mt-4">
          <SectionHeading title="No longer required" />
          <TornCard className="px-4 py-2 opacity-80 shadow-card">
            {orphanChecks.map((c) => {
              const ing = graphIngredients?.[c.ingredient_id];
              return (
                <div key={c.ingredient_id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2 last:border-0">
                  <span className="text-[14px]">
                    {ing?.name ?? "Ingredient"}
                    <span className="block font-mono text-[10px] text-flame">No longer required · already collected</span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] text-ink-soft">
                    {c.collected_quantity != null && ing ? fmtShopQty(c.collected_quantity, ing.base_unit) : "✓"}
                  </span>
                </div>
              );
            })}
          </TornCard>
        </div>
      ) : null}

      <NonFood eventId={eventId} lines={nonFood.map((l) => ({ id: l.row.id, name: l.item.name, qty: l.toBuy, reusable: l.reusable }))} />
    </div>
  );
}
