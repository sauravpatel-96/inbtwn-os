import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle, EmptyNote } from "@/components/inbtwn/bits";
import { RecipeEditor } from "@/components/inbtwn/RecipeEditor";
import { recipeQuery } from "@/lib/recipe-queries";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/edit")({
  head: () => ({
    meta: [
      { title: "Edit recipe — INBTWN OS" },
      { name: "description", content: "Edit a recipe and save it as a new version." },
      { property: "og:title", content: "Edit recipe — INBTWN OS" },
      { property: "og:description", content: "Edit a recipe formulation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditRecipePage,
});

function EditRecipePage() {
  const { recipeId } = Route.useParams();
  const q = useQuery(recipeQuery(recipeId));
  const navigate = useNavigate();

  if (q.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!q.data) return <EmptyNote>Recipe not found.</EmptyNote>;

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes/$recipeId" params={{ recipeId }} className="font-mono text-[11px] text-ink-soft">
          ← {q.data.name}
        </Link>
      </div>
      <PageTitle title="Edit recipe" aside={`v${q.data.active_version?.version_number ?? 1} → new`} />
      <RecipeEditor
        recipe={q.data}
        version={q.data.active_version}
        onSaved={() => navigate({ to: "/library/recipes/$recipeId", params: { recipeId } })}
      />
    </div>
  );
}
