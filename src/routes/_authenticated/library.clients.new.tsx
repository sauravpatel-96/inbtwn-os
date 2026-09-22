import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageTitle } from "@/components/inbtwn/bits";
import { ClientForm } from "@/components/inbtwn/ClientForm";

export const Route = createFileRoute("/_authenticated/library/clients/new")({
  head: () => ({
    meta: [
      { title: "New client — INBTWN OS" },
      { name: "description", content: "Add a new client to your library." },
      { property: "og:title", content: "New client — INBTWN OS" },
      { property: "og:description", content: "Add a new catering client." },
    ],
  }),
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div>
      <div className="mb-1">
        <Link to="/library/clients" className="font-mono text-[11px] text-ink-soft">
          ← Clients
        </Link>
      </div>
      <PageTitle title="New client" />
      <ClientForm
        onSaved={(c) => {
          qc.invalidateQueries({ queryKey: ["clients"] });
          toast.success("Client saved");
          navigate({ to: "/library/clients/$clientId", params: { clientId: c.id } });
        }}
      />
    </div>
  );
}
