import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eventQuery } from "@/lib/queries";
import { PageTitle, EmptyNote } from "@/components/inbtwn/bits";
import { EventForm } from "@/components/inbtwn/EventForm";

export const Route = createFileRoute("/_authenticated/events/$eventId/edit")({
  head: () => ({
    meta: [
      { title: "Edit event — INBTWN OS" },
      { name: "description", content: "Update event details, venue, times and guest count." },
      { property: "og:title", content: "Edit event — INBTWN OS" },
      { property: "og:description", content: "Update event details." },
    ],
  }),
  component: EditEventPage,
});

function EditEventPage() {
  const { eventId } = Route.useParams();
  const event = useQuery(eventQuery(eventId));
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (event.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!event.data) return <EmptyNote>Event not found.</EmptyNote>;

  return (
    <div>
      <div className="mb-1">
        <Link to="/events/$eventId" params={{ eventId }} className="font-mono text-[11px] text-ink-soft">
          ← Back
        </Link>
      </div>
      <PageTitle title="Edit event" />
      <EventForm
        initial={event.data}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["events"] });
          toast.success("Event updated");
          navigate({ to: "/events/$eventId", params: { eventId } });
        }}
      />
    </div>
  );
}
