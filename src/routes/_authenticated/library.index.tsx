import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/inbtwn/bits";
import { clientsQuery } from "@/lib/queries";
import { ingredientsQuery, recipesQuery } from "@/lib/recipe-queries";

export const Route = createFileRoute("/_authenticated/library/")({
  head: () => ({
    meta: [
      { title: "Library — INBTWN OS" },
      { name: "description", content: "Clients, recipes, ingredients, equipment, suppliers and templates." },
      { property: "og:title", content: "Library — INBTWN OS" },
      { property: "og:description", content: "Your catering reference library." },
    ],
  }),
  component: LibraryPage,
});

const LATER = ["Suppliers", "Templates"];

function LibraryPage() {
  const clients = useQuery(clientsQuery);
  const recipes = useQuery(recipesQuery);
  const ingredients = useQuery(ingredientsQuery);
  return (
    <div>
      <PageTitle title="Library" aside="reference" />
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/library/clients"
          className="torn tap col-span-2 bg-cream px-4 py-4 text-ink shadow-card active:bg-panel"
        >
          <div className="flex items-baseline justify-between">
            <div className="font-display text-[24px] leading-none">Clients</div>
            <div className="font-display text-[24px] leading-none text-flame">
              {clients.data?.length ?? "–"}
            </div>
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">People and companies you cater for</div>
        </Link>
        <Link to="/library/recipes" className="torn tap bg-cream px-4 py-4 text-ink shadow-card active:bg-panel">
          <div className="flex items-baseline justify-between">
            <div className="font-display text-[22px] leading-none">Recipes</div>
            <div className="font-display text-[22px] leading-none text-flame">
              {recipes.data?.length ?? "–"}
            </div>
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">Scale, cost, version</div>
        </Link>
        <Link to="/library/ingredients" className="torn tap bg-cream px-4 py-4 text-ink shadow-card active:bg-panel">
          <div className="flex items-baseline justify-between">
            <div className="font-display text-[22px] leading-none">Ingredients</div>
            <div className="font-display text-[22px] leading-none text-flame">
              {ingredients.data?.length ?? "–"}
            </div>
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">Yields, costs, allergens</div>
        </Link>
        <Link to="/library/kit" className="torn tap col-span-2 bg-cream px-4 py-4 text-ink shadow-card active:bg-panel">
          <div className="font-display text-[22px] leading-none">Event Kit</div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">Equipment, serveware and consumables you own</div>
        </Link>
        <Link to="/library/suppliers" className="torn tap col-span-2 bg-cream px-4 py-4 text-ink shadow-card active:bg-panel">
          <div className="font-display text-[22px] leading-none">Suppliers</div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">Where you buy ingredients</div>
        </Link>
        <Link to="/library/staff" className="torn tap col-span-2 bg-cream px-4 py-4 text-ink shadow-card active:bg-panel">
          <div className="font-display text-[22px] leading-none">Staff</div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">Casual helpers and hourly rates</div>
        </Link>
        <Link
          to="/settings/business"
          className="torn tap col-span-2 bg-cream px-4 py-4 text-ink shadow-card active:bg-panel"
        >
          <div className="font-display text-[22px] leading-none">Business &amp; Documents</div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">
            Your details, bank details and quote/invoice defaults
          </div>
        </Link>
        {LATER.map((l) => (
          <div key={l} className="torn bg-cream/70 px-4 py-4 opacity-70">
            <div className="font-display text-[20px] leading-none">{l}</div>
            <div className="label-mono mt-1 text-ink-soft">Coming later</div>
          </div>
        ))}
      </div>
    </div>
  );
}
