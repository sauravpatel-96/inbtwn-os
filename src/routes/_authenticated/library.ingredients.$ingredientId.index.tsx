import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle, SectionHeading, TornCard, EmptyNote } from "@/components/inbtwn/bits";
import { ingredientQuery } from "@/lib/recipe-queries";
import { fmtCost, fmtUnitCost, type BaseUnit } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/library/ingredients/$ingredientId/")({
  head: () => ({
    meta: [
      { title: "Ingredient — INBTWN OS" },
      { name: "description", content: "Ingredient yield, cost and allergen detail." },
      { property: "og:title", content: "Ingredient — INBTWN OS" },
      { property: "og:description", content: "Ingredient yield, cost and allergens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IngredientDetail,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/8 py-2 last:border-0">
      <span className="label-mono text-ink-soft">{label}</span>
      <span className="font-mono text-[13px]">{value}</span>
    </div>
  );
}

function IngredientDetail() {
  const { ingredientId } = Route.useParams();
  const q = useQuery(ingredientQuery(ingredientId));
  const i = q.data;

  if (q.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!i) return <EmptyNote>Ingredient not found.</EmptyNote>;

  const base = i.base_unit as BaseUnit;
  const allergens = (i.ingredient_allergens ?? []).map((a) => a.allergen?.name).filter(Boolean);

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/ingredients" className="font-mono text-[11px] text-ink-soft">
          ← Ingredients
        </Link>
      </div>
      <PageTitle
        title={i.name}
        aside={
          <Link
            to="/library/ingredients/$ingredientId/edit"
            params={{ ingredientId }}
            className="font-mono text-[12px] underline"
          >
            Edit
          </Link>
        }
      >
        <div className="mt-1 font-mono text-[12px] text-ink-soft">{i.category}</div>
      </PageTitle>

      <TornCard className="px-4 py-3 shadow-card">
        <Row label="Base unit" value={base} />
        <Row label="Usable yield" value={`${Number(i.yield_percentage)}%`} />
        <Row label="Unit cost" value={fmtUnitCost(i.current_unit_cost, base)} />
        {i.cost_price != null && i.cost_quantity != null ? (
          <Row
            label="Entered as"
            value={`${fmtCost(Number(i.cost_price))} for ${Number(i.cost_quantity)} ${i.cost_unit}`}
          />
        ) : null}
        <Row label="Inventory tracked" value={i.track_inventory ? "Yes" : "No"} />
      </TornCard>

      <div className="mt-5">
        <SectionHeading title="Allergens" />
        {allergens.length ? (
          <div className="flex flex-wrap gap-2">
            {allergens.map((a) => (
              <span key={a} className="label-mono rounded-sm bg-flame/15 px-2 py-1 text-flame">
                {a}
              </span>
            ))}
          </div>
        ) : (
          <EmptyNote>No allergens assigned.</EmptyNote>
        )}
      </div>

      {i.notes ? (
        <div className="mt-5">
          <SectionHeading title="Notes" />
          <TornCard className="whitespace-pre-wrap px-4 py-3 text-[14px]">{i.notes}</TornCard>
        </div>
      ) : null}
    </div>
  );
}
