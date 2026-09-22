import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, EmptyNote, TornCard, GhostButton } from "@/components/inbtwn/bits";
import { recipeQuery, recipeVersionsQuery } from "@/lib/recipe-queries";
import { fmtQty, type BaseUnit } from "@/lib/units";
import { fmtDateLong } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/versions")({
  head: () => ({
    meta: [
      { title: "Recipe versions — INBTWN OS" },
      { name: "description", content: "Every historical version of this recipe." },
      { property: "og:title", content: "Recipe versions — INBTWN OS" },
      { property: "og:description", content: "Recipe version history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VersionsPage,
});

function VersionsPage() {
  const { recipeId } = Route.useParams();
  const recipe = useQuery(recipeQuery(recipeId));
  const versions = useQuery(recipeVersionsQuery(recipeId));
  const qc = useQueryClient();

  const setActive = async (id: string): Promise<void> => {
    const res = await supabase.from("recipes").update({ active_version_id: id }).eq("id", recipeId);
    if (res.error) return void toast.error(res.error.message);
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["recipe-graph"] });
    toast.success("Active version updated");
  };

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes/$recipeId" params={{ recipeId }} className="font-mono text-[11px] text-ink-soft">
          ← {recipe.data?.name ?? "Recipe"}
        </Link>
      </div>
      <PageTitle title="Versions" aside="history" />
      <div className="space-y-2.5">
        {(versions.data ?? []).length === 0 ? <EmptyNote>No versions yet.</EmptyNote> : null}
        {(versions.data ?? []).map((v) => {
          const isActive = recipe.data?.active_version_id === v.id;
          return (
            <TornCard key={v.id} className="px-4 py-3 shadow-card">
              <div className="flex items-baseline justify-between">
                <div className="font-display text-[20px] leading-none">v{v.version_number}</div>
                {isActive ? (
                  <span className="label-mono rounded-sm bg-ink px-1.5 py-0.5 text-cream">Active</span>
                ) : (
                  <GhostButton onClick={() => setActive(v.id)}>Make active</GhostButton>
                )}
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-ink-soft">
                Yields {fmtQty(Number(v.base_yield_quantity), v.base_yield_unit as BaseUnit)} · {fmtDateLong(v.created_at)}
              </div>
              {v.change_notes ? <div className="mt-1 text-[13px]">{v.change_notes}</div> : null}
            </TornCard>
          );
        })}
      </div>
    </div>
  );
}
