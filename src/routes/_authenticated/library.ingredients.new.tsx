import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageTitle } from "@/components/inbtwn/bits";
import { IngredientForm } from "@/components/inbtwn/IngredientForm";

export const Route = createFileRoute("/_authenticated/library/ingredients/new")({
  head: () => ({
    meta: [
      { title: "New ingredient — INBTWN OS" },
      { name: "description", content: "Add an ingredient with yield, cost and allergens." },
      { property: "og:title", content: "New ingredient — INBTWN OS" },
      { property: "og:description", content: "Add an ingredient to your library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewIngredientPage,
});

function NewIngredientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div>
      <div className="mb-1">
        <Link to="/library/ingredients" className="font-mono text-[11px] text-ink-soft">
          ← Ingredients
        </Link>
      </div>
      <PageTitle title="New ingredient" />
      <IngredientForm
        onSaved={(row) => {
          qc.invalidateQueries({ queryKey: ["ingredients"] });
          qc.invalidateQueries({ queryKey: ["recipe-graph"] });
          toast.success("Ingredient saved");
          navigate({ to: "/library/ingredients/$ingredientId", params: { ingredientId: row.id } });
        }}
      />
    </div>
  );
}
