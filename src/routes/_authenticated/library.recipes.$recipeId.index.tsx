import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle, SectionHeading, TornCard, EmptyNote } from "@/components/inbtwn/bits";
import { graphQuery, profilesQuery, recipeQuery } from "@/lib/recipe-queries";
import { scaleVersion, versionAllergens, type ScaleResult } from "@/lib/recipe-calc";
import { fmtCost, fmtQty, fmtUnitCost, type BaseUnit } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/")({
  head: () => ({
    meta: [
      { title: "Recipe — INBTWN OS" },
      { name: "description", content: "Recipe yield, ingredients, components, allergens and cost." },
      { property: "og:title", content: "Recipe — INBTWN OS" },
      { property: "og:description", content: "Recipe detail and costing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { recipeId } = Route.useParams();
  const recipe = useQuery(recipeQuery(recipeId));
  const graph = useQuery(graphQuery);
  const profiles = useQuery(profilesQuery(recipeId));

  if (recipe.isLoading || graph.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  const r = recipe.data;
  if (!r) return <EmptyNote>Recipe not found.</EmptyNote>;
  const v = r.active_version;
  const base = (v?.base_yield_unit as BaseUnit) ?? "g";

  let batch: ScaleResult | null = null;
  let calcError: string | null = null;
  if (v && graph.data) {
    try {
      batch = scaleVersion(v.id, Number(v.base_yield_quantity), graph.data);
    } catch (e) {
      calcError = e instanceof Error ? e.message : "Calculation failed";
    }
  }
  const allergens = v && graph.data ? versionAllergens(v.id, graph.data) : [];
  const costComplete = batch ? batch.missingCost.length === 0 : false;
  const portion = v?.default_portion_quantity ? Number(v.default_portion_quantity) : null;

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes" className="font-mono text-[11px] text-ink-soft">
          ← Recipes
        </Link>
      </div>
      <PageTitle title={r.name} aside={`v${v?.version_number ?? 1}`}>
        <div className="mt-1 font-mono text-[12px] text-ink-soft">
          {[r.cuisine, r.category].filter(Boolean).join(" · ")}
        </div>
      </PageTitle>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/library/recipes/$recipeId/scale"
          params={{ recipeId }}
          className="tap flex items-center justify-center rounded-sm bg-flame px-4 py-3 font-semibold text-cream shadow-press"
        >
          Scale
        </Link>
        <Link
          to="/library/recipes/$recipeId/edit"
          params={{ recipeId }}
          className="tap flex items-center justify-center rounded-sm border border-ink/20 bg-cream px-4 py-3 font-mono text-[12px]"
        >
          Edit
        </Link>
        <Link
          to="/library/recipes/$recipeId/profiles"
          params={{ recipeId }}
          className="tap flex items-center justify-center rounded-sm border border-ink/20 bg-cream px-4 py-2.5 font-mono text-[12px]"
        >
          Production profiles
        </Link>
        <Link
          to="/library/recipes/$recipeId/prep"
          params={{ recipeId }}
          className="tap flex items-center justify-center rounded-sm border border-ink/20 bg-cream px-4 py-2.5 font-mono text-[12px]"
        >
          Prep &amp; production
        </Link>
        <Link
          to="/library/recipes/$recipeId/versions"
          params={{ recipeId }}
          className="tap flex items-center justify-center rounded-sm border border-ink/20 bg-cream px-4 py-2.5 font-mono text-[12px]"
        >
          View versions
        </Link>
      </div>

      {r.description ? <p className="mt-4 text-[14px]">{r.description}</p> : null}

      <div className="mt-5">
        <SectionHeading title="Production" />
        <TornCard className="px-4 py-3 shadow-card">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="label-mono text-ink-soft">Base yield</div>
              <div className="font-display text-[20px] leading-tight">
                {v ? fmtQty(Number(v.base_yield_quantity), base) : "—"}
              </div>
            </div>
            <div>
              <div className="label-mono text-ink-soft">Portion</div>
              <div className="font-display text-[20px] leading-tight">
                {portion ? fmtQty(portion, base) : "—"}
              </div>
            </div>
            <div>
              <div className="label-mono text-ink-soft">Buffer</div>
              <div className="font-display text-[20px] leading-tight">
                {v ? `${Number(v.default_buffer_percentage)}%` : "—"}
              </div>
            </div>
          </div>
        </TornCard>
      </div>

      {calcError ? <div className="mt-4 torn bg-flame/10 px-4 py-3 text-[13px] text-flame">{calcError}</div> : null}

      <div className="mt-5">
        <SectionHeading title="Ingredients" />
        {batch && batch.ingredients.length ? (
          <TornCard className="px-4 py-2 shadow-card">
            {batch.ingredients.map((i) => (
              <div key={i.ingredientId} className="flex items-baseline justify-between border-b border-ink/8 py-2 last:border-0">
                <div>
                  <div className="text-[14px]">{i.name}</div>
                  {i.prepNote ? <div className="font-mono text-[11px] text-ink-soft">{i.prepNote}</div> : null}
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px]">{fmtQty(i.usable, i.baseUnit)}</div>
                  {i.yieldPct !== 100 ? (
                    <div className="font-mono text-[11px] text-ink-soft">{fmtQty(i.raw, i.baseUnit)} raw</div>
                  ) : null}
                </div>
              </div>
            ))}
          </TornCard>
        ) : (
          <EmptyNote>No ingredients on this version.</EmptyNote>
        )}
      </div>

      {batch && batch.components.length ? (
        <div className="mt-5">
          <SectionHeading title="Components" />
          <TornCard className="px-4 py-2 shadow-card">
            {batch.components.map((c) => (
              <Link
                key={c.versionId}
                to="/library/recipes/$recipeId"
                params={{ recipeId: graph.data?.versions[c.versionId]?.recipe_id ?? recipeId }}
                className="flex items-baseline justify-between border-b border-ink/8 py-2 last:border-0"
              >
                <span className="text-[14px] underline">{c.name}</span>
                <span className="font-mono text-[13px]">{fmtQty(c.required, c.baseUnit)}</span>
              </Link>
            ))}
          </TornCard>
        </div>
      ) : null}

      <div className="mt-5">
        <SectionHeading
          title="Production profiles"
          action={
            <Link to="/library/recipes/$recipeId/profiles" params={{ recipeId }} className="font-mono text-[12px] underline">
              Manage
            </Link>
          }
        />
        {(profiles.data ?? []).length === 0 ? (
          <EmptyNote>No profiles yet — you can still scale by target quantity.</EmptyNote>
        ) : (
          <div className="space-y-2">
            {(profiles.data ?? []).map((p) => (
              <TornCard key={p.id} className="flex items-baseline justify-between px-4 py-2.5">
                <span className="text-[14px]">{p.name}</span>
                <span className="font-mono text-[11px] text-ink-soft">
                  {Number(p.quantity_per_guest)}{p.unit}/guest · {Number(p.expected_uptake_percentage)}% uptake ·{" "}
                  {Number(p.buffer_percentage)}% buffer
                </span>
              </TornCard>
            ))}
          </div>
        )}
      </div>

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
          <EmptyNote>No allergens recorded against the ingredients used.</EmptyNote>
        )}
      </div>

      <div className="mt-5">
        <SectionHeading title="Cost" />
        <TornCard className="px-4 py-3 shadow-card">
          {batch ? (
            <>
              <div className="flex items-baseline justify-between py-1">
                <span className="label-mono text-ink-soft">Base batch</span>
                <span className="font-mono text-[13px]">{fmtCost(batch.cost)}</span>
              </div>
              <div className="flex items-baseline justify-between py-1">
                <span className="label-mono text-ink-soft">Per output</span>
                <span className="font-mono text-[13px]">
                  {fmtUnitCost(batch.cost / batch.baseYield, base)}
                </span>
              </div>
              {portion ? (
                <div className="flex items-baseline justify-between py-1">
                  <span className="label-mono text-ink-soft">Per portion</span>
                  <span className="font-mono text-[13px]">
                    {fmtCost((batch.cost / batch.baseYield) * portion)}
                  </span>
                </div>
              ) : null}
              {!costComplete ? (
                <div className="mt-2 rounded-sm bg-flame/10 px-3 py-2 font-mono text-[11px] text-flame">
                  Cost incomplete — no cost for: {batch.missingCost.join(", ")}
                </div>
              ) : null}
            </>
          ) : (
            <span className="font-mono text-[12px] text-ink-soft">No costing available.</span>
          )}
        </TornCard>
      </div>

      {v?.method ? (
        <div className="mt-5">
          <SectionHeading title="Method" />
          <TornCard className="whitespace-pre-wrap px-4 py-3 text-[14px] leading-relaxed">{v.method}</TornCard>
        </div>
      ) : null}
    </div>
  );
}
