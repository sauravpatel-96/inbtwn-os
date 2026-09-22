import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageTitle, EmptyNote } from "@/components/inbtwn/bits";
import { IngredientForm } from "@/components/inbtwn/IngredientForm";
import { ingredientQuery } from "@/lib/recipe-queries";

export const Route = createFileRoute("/_authenticated/library/ingredients/$ingredientId/edit")({
  head: () => ({
    meta: [
      { title: "Edit ingredient — INBTWN OS" },
      { name: "description", content: "Update ingredient yield, cost and allergens." },
      { property: "og:title", content: "Edit ingredient — INBTWN OS" },
      { property: "og:description", content: "Update an ingredient." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditIngredientPage,
});

function EditIngredientPage() {
  const { ingredientId } = Route.useParams();
  const q = useQuery(ingredientQuery(ingredientId));
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (q.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!q.data) return <EmptyNote>Ingredient not found.</EmptyNote>;

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/ingredients/$ingredientId" params={{ ingredientId }} className="font-mono text-[11px] text-ink-soft">
          ← {q.data.name}
        </Link>
      </div>
      <PageTitle title="Edit ingredient" />
      <IngredientForm
        existing={q.data}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["ingredients"] });
          qc.invalidateQueries({ queryKey: ["recipe-graph"] });
          toast.success("Ingredient updated");
          navigate({ to: "/library/ingredients/$ingredientId", params: { ingredientId } });
        }}
      />
    </div>
  );
}
