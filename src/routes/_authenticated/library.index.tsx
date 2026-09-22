import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/inbtwn/bits";
import { clientsQuery } from "@/lib/queries";

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

const LATER = ["Recipes", "Ingredients", "Equipment", "Suppliers", "Templates"];

function LibraryPage() {
  const clients = useQuery(clientsQuery);
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
