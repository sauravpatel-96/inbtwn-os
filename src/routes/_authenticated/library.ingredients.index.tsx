import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageTitle, TextInput, Chip, EmptyNote, TornCard } from "@/components/inbtwn/bits";
import { ingredientsQuery } from "@/lib/recipe-queries";
import { fmtUnitCost, type BaseUnit } from "@/lib/units";
import { INGREDIENT_CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/library/ingredients/")({
  head: () => ({
    meta: [
      { title: "Ingredients — INBTWN OS" },
      { name: "description", content: "Your catering ingredient library with yields, costs and allergens." },
      { property: "og:title", content: "Ingredients — INBTWN OS" },
      { property: "og:description", content: "Ingredient yields, unit costs and allergens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IngredientsPage,
});

function IngredientsPage() {
  const q = useQuery(ingredientsQuery);
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [costFilter, setCostFilter] = useState<"all" | "costed" | "needs">("all");

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (q.data ?? []).filter((i) => {
      if (cat && i.category !== cat) return false;
      if (costFilter === "costed" && i.current_unit_cost == null) return false;
      if (costFilter === "needs" && i.current_unit_cost != null) return false;
      if (!t) return true;
      return i.name.toLowerCase().includes(t) || i.category.toLowerCase().includes(t);
    });
  }, [q.data, term, cat, costFilter]);

  const used = INGREDIENT_CATEGORIES.filter((c) => (q.data ?? []).some((i) => i.category === c));

  return (
    <div>
      <div className="mb-1">
        <Link to="/library" className="font-mono text-[11px] text-ink-soft">
          ← Library
        </Link>
      </div>
      <PageTitle title="Ingredients" aside={`${q.data?.length ?? 0} items`} />

      <div className="space-y-3">
        <TextInput placeholder="Search ingredients" value={term} onChange={(e) => setTerm(e.target.value)} />
        <div className="flex gap-2">
          {(["all", "costed", "needs"] as const).map((f) => (
            <Chip key={f} active={costFilter === f} onClick={() => setCostFilter(f)}>
              {f === "all" ? "All" : f === "costed" ? "Costed" : `Needs price (${(q.data ?? []).filter((i) => i.current_unit_cost == null).length})`}
            </Chip>
          ))}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Chip active={!cat} onClick={() => setCat(null)}>
            All
          </Chip>
          {used.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} className="whitespace-nowrap">
              {c}
            </Chip>
          ))}
        </div>
        <Link
          to="/library/ingredients/new"
          className="tap flex items-center justify-center gap-2 rounded-sm bg-ink px-4 py-3 font-semibold text-cream shadow-press"
        >
          <span className="font-display text-[20px] leading-none">+</span> New ingredient
        </Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {list.length === 0 ? (
          <EmptyNote>No ingredients yet. Add chicken thigh, double cream, whatever you buy.</EmptyNote>
        ) : (
          list.map((i) => (
            <TornCard key={i.id} className="px-4 py-3 shadow-card">
              <Link to="/library/ingredients/$ingredientId" params={{ ingredientId: i.id }} className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold leading-tight">{i.name}</div>
                  <div className="font-mono text-[12px] text-ink">
                    {i.current_unit_cost == null ? (
                      <span className="text-flame">{i.cost_status === "no_preferred" ? "Set preferred" : i.cost_status === "unit_mismatch" ? "Unit mismatch" : "Needs price"}</span>
                    ) : (
                      fmtUnitCost(i.current_unit_cost, i.base_unit as BaseUnit)
                    )}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-soft">
                  <span>{i.category}</span>
                  <span>·</span>
                  <span>Yield {Number(i.yield_percentage)}%</span>
                  {i.ingredient_allergens?.length ? (
                    <span className="text-flame">
                      {i.ingredient_allergens.map((a) => a.allergen?.name).filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                </div>
              </Link>
            </TornCard>
          ))
        )}
      </div>
    </div>
  );
}
