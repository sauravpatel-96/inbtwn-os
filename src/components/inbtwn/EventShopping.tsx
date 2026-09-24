import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, TornCard, EmptyNote, GhostButton, Chip } from "@/components/inbtwn/bits";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery } from "@/lib/menu-queries";
import { versionBuffersQuery } from "@/lib/production";
import { collectPurchases, fmtShopQty, shoppingChecksQuery, type ShoppingLine } from "@/lib/shopping";
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
}: {
  line: ShoppingLine;
  collected: boolean;
  onToggle: () => void;
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
  const [filter, setFilter] = useState<Filter>("tobuy");
  const [showMissing, setShowMissing] = useState(false);
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);
  const checks = useQuery(shoppingChecksQuery(eventId));
  const kitItems = useQuery(kitItemsQuery);
  const kitRows = useQuery(eventKitQuery(eventId));

  const guests = guestCount ?? 0;

  const lines = useMemo<ShoppingLine[]>(() => {
    if (!graph.data || !menu.data) return [];
    const map = new Map<string, ShoppingLine>();
    for (const item of menu.data) {
      const perGuest = Number(item.quantity_per_guest ?? 0);
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      if (!versionId || guests <= 0 || perGuest <= 0) continue;
      const buffer = buffers.data?.[versionId] ?? 0;
      const target = guests * perGuest * (1 + buffer / 100);
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

  const collectedSet = useMemo(() => new Set(checks.data ?? []), [checks.data]);
  const collectedCount = lines.filter((l) => collectedSet.has(l.ingredientId)).length;

  const visible = lines.filter((l) => {
    const done = collectedSet.has(l.ingredientId);
    return filter === "all" ? true : filter === "collected" ? done : !done;
  });

  const knownCost = lines.reduce((sum, l) => sum + (l.cost ?? 0), 0);
  const missingCost = lines.filter((l) => l.cost === null);

  const toggle = async (line: ShoppingLine) => {
    const done = collectedSet.has(line.ingredientId);
    const { error } = done
      ? await supabase
          .from("event_shopping_checks")
          .delete()
          .eq("event_id", eventId)
          .eq("ingredient_id", line.ingredientId)
      : await supabase
          .from("event_shopping_checks")
          .insert({ event_id: eventId, ingredient_id: line.ingredientId });
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
              />
            ))}
          </TornCard>
        )}
      </div>

      {lines.length ? (
        <div className="mt-4">
          <SectionHeading title="Estimated purchase cost" />
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

      <NonFood eventId={eventId} lines={nonFood.map((l) => ({ id: l.row.id, name: l.item.name, qty: l.toBuy, reusable: l.reusable }))} />
    </div>
  );
}
