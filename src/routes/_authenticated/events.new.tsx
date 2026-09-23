import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { PageTitle } from "@/components/inbtwn/bits";
import { EventForm } from "@/components/inbtwn/EventForm";

export const Route = createFileRoute("/_authenticated/events/new")({
  validateSearch: z.object({
    clientId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "New enquiry — INBTWN OS" },
      { name: "description", content: "Capture a new catering enquiry in seconds." },
      { property: "og:title", content: "New enquiry — INBTWN OS" },
      { property: "og:description", content: "Capture a new catering enquiry." },
    ],
  }),
  component: NewEventPage,
});

function NewEventPage() {
  const { clientId, contactId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div>
      <div className="mb-1">
        <Link to="/events" className="font-mono text-[11px] text-ink-soft">
          ← Events
        </Link>
      </div>
      <PageTitle title="New enquiry" aside="status: Enquiry" />
      <EventForm
        presetClientId={clientId}
        presetContactId={contactId}
        onSaved={(e) => {
          qc.invalidateQueries({ queryKey: ["events"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
          toast.success("Enquiry created");
          navigate({ to: "/events/$eventId", params: { eventId: e.id } });
        }}
      />
    </div>
  );
}
