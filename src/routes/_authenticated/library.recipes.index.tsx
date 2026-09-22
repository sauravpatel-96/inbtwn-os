import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageTitle, TextInput, Chip, EmptyNote, TornCard } from "@/components/inbtwn/bits";
import { recipesQuery } from "@/lib/recipe-queries";
import { fmtQty, type BaseUnit } from "@/lib/units";
import { RECIPE_CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/library/recipes/")({
  head: () => ({
    meta: [
      { title: "Recipes — INBTWN OS" },
      { name: "description", content: "Scalable catering recipes with versions, yields and costs." },
      { property: "og:title", content: "Recipes — INBTWN OS" },
      { property: "og:description", content: "Your scalable catering recipe library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  const q = useQuery(recipesQuery);
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (cat && r.category !== cat) return false;
      if (!t) return true;
      return (
        r.name.toLowerCase().includes(t) ||
        (r.cuisine ?? "").toLowerCase().includes(t) ||
        r.category.toLowerCase().includes(t)
      );
    });
  }, [q.data, term, cat]);

  const used = RECIPE_CATEGORIES.filter((c) => (q.data ?? []).some((r) => r.category === c));

  return (
    <div>
      <div className="mb-1">
        <Link to="/library" className="font-mono text-[11px] text-ink-soft">
          ← Library
        </Link>
      </div>
      <PageTitle title="Recipes" aside={`${q.data?.length ?? 0} recipes`} />

      <div className="space-y-3">
        <TextInput placeholder="Search recipes" value={term} onChange={(e) => setTerm(e.target.value)} />
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
          to="/library/recipes/new"
          className="tap flex items-center justify-center gap-2 rounded-sm bg-ink px-4 py-3 font-semibold text-cream shadow-press"
        >
          <span className="font-display text-[20px] leading-none">+</span> New recipe
        </Link>
      </div>

      <div className="mt-4 space-y-2.5">
        {list.length === 0 ? (
          <EmptyNote>No recipes yet. Build your first one — sub-recipes are supported.</EmptyNote>
        ) : (
          list.map((r) => {
            const v = r.active_version;
            const base = (v?.base_yield_unit as BaseUnit) ?? "g";
            return (
              <TornCard key={r.id} className="px-4 py-3 shadow-card">
                <Link to="/library/recipes/$recipeId" params={{ recipeId: r.id }} className="block">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-display text-[20px] leading-none">{r.name}</div>
                    <div className="label-mono text-ink-soft">v{v?.version_number ?? 1}</div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-soft">
                    {r.cuisine ? (
                      <>
                        <span>{r.cuisine}</span>
                        <span>·</span>
                      </>
                    ) : null}
                    <span>{r.category}</span>
                    {v ? (
                      <>
                        <span>·</span>
                        <span>Yields {fmtQty(Number(v.base_yield_quantity), base)}</span>
                      </>
                    ) : null}
                  </div>
                </Link>
              </TornCard>
            );
          })
        )}
      </div>
    </div>
  );
}
