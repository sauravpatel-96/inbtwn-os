import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientQuery } from "@/lib/queries";
import { PageTitle, EmptyNote } from "@/components/inbtwn/bits";
import { ClientForm } from "@/components/inbtwn/ClientForm";

export const Route = createFileRoute("/_authenticated/library/clients/$clientId/edit")({
  head: () => ({
    meta: [
      { title: "Edit client — INBTWN OS" },
      { name: "description", content: "Update client contact details and notes." },
      { property: "og:title", content: "Edit client — INBTWN OS" },
      { property: "og:description", content: "Update client details." },
    ],
  }),
  component: EditClientPage,
});

function EditClientPage() {
  const { clientId } = Route.useParams();
  const client = useQuery(clientQuery(clientId));
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (client.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!client.data) return <EmptyNote>Client not found.</EmptyNote>;

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/clients/$clientId" params={{ clientId }} className="font-mono text-[11px] text-ink-soft">
          ← Back
        </Link>
      </div>
      <PageTitle title="Edit client" />
      <ClientForm
        initial={client.data}
        submitLabel="Save changes"
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["clients"] });
          qc.invalidateQueries({ queryKey: ["events"] });
          toast.success("Client updated");
          navigate({ to: "/library/clients/$clientId", params: { clientId } });
        }}
      />
    </div>
  );
}
