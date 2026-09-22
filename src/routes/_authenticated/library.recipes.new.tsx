import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageTitle } from "@/components/inbtwn/bits";
import { RecipeEditor } from "@/components/inbtwn/RecipeEditor";

export const Route = createFileRoute("/_authenticated/library/recipes/new")({
  head: () => ({
    meta: [
      { title: "New recipe — INBTWN OS" },
      { name: "description", content: "Create a scalable catering recipe with ingredients and sub-recipes." },
      { property: "og:title", content: "New recipe — INBTWN OS" },
      { property: "og:description", content: "Create a scalable catering recipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewRecipePage,
});

function NewRecipePage() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes" className="font-mono text-[11px] text-ink-soft">
          ← Recipes
        </Link>
      </div>
      <PageTitle title="New recipe" aside="v1" />
      <RecipeEditor onSaved={(recipeId) => navigate({ to: "/library/recipes/$recipeId", params: { recipeId } })} />
    </div>
  );
}
