import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { clientQuery, clientEventsQuery } from "@/lib/queries";
import { clientDisplayName, clientContactName } from "@/lib/format";
import { CLIENT_TYPES } from "@/lib/constants";
import { PageTitle, SectionHeading, EmptyNote, DemoTag } from "@/components/inbtwn/bits";
import { EventCard } from "@/components/inbtwn/EventCard";

export const Route = createFileRoute("/_authenticated/library/clients/$clientId/")({
  head: () => ({
    meta: [
      { title: "Client — INBTWN OS" },
      { name: "description", content: "Client contact details, notes and associated events." },
      { property: "og:title", content: "Client — INBTWN OS" },
      { property: "og:description", content: "Client details and events." },
    ],
  }),
  component: ClientDetailPage,
});

function Row({ label, value, href }: { label: string; value: string | null | undefined; href?: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2.5 last:border-0">
      <span className="label-mono shrink-0 text-ink-soft">{label}</span>
      {href ? (
        <a href={href} className="tap flex items-center text-right font-medium text-flame underline-offset-2">
          {value}
        </a>
      ) : (
        <span className="text-right font-medium">{value}</span>
      )}
    </div>
  );
}

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const client = useQuery(clientQuery(clientId));
  const events = useQuery(clientEventsQuery(clientId));

  if (client.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!client.data) return <EmptyNote>Client not found.</EmptyNote>;
  const c = client.data;
  const contact = clientContactName(c);

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/clients" className="font-mono text-[11px] text-ink-soft">
          ← Clients
        </Link>
      </div>
      <PageTitle
        title={clientDisplayName(c)}
        aside={
          <Link
            to="/library/clients/$clientId/edit"
            params={{ clientId }}
            className="rounded-sm border border-ink/20 bg-cream px-3 py-2 font-mono text-[11px] normal-case tracking-normal text-ink"
          >
            Edit
          </Link>
        }
      >
        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink-soft">
          {CLIENT_TYPES.find((t) => t.value === c.client_type)?.label}
          {c.is_demo ? <DemoTag /> : null}
        </div>
      </PageTitle>

      <div className="torn bg-cream px-4 py-2">
        <Row label="Contact" value={c.company_name ? contact : null} />
        <Row label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
        <Row label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone.replace(/\s+/g, "")}` : undefined} />
        <Row label="Billing" value={c.billing_address} />
        <Row label="Event address" value={c.default_event_address} />
        {!c.email && !c.phone ? <p className="py-2 font-mono text-[11px] text-ink-soft">No contact details yet.</p> : null}
      </div>

      {c.notes ? (
        <div className="mt-5">
          <SectionHeading title="Notes" />
          <div className="torn whitespace-pre-wrap bg-cream px-4 py-3 text-sm">{c.notes}</div>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionHeading
          title={`Events · ${events.data?.length ?? 0}`}
          action={
            <Link to="/events/new" search={{ clientId }} className="font-mono text-[11px] text-flame">
              + New enquiry
            </Link>
          }
        />
        {events.data?.length ? (
          <div className="flex flex-col gap-3">
            {events.data.map((e, i) => (
              <EventCard key={e.id} event={e} tilt={i % 2 ? 1 : -1} />
            ))}
          </div>
        ) : (
          <EmptyNote>No events for this client yet.</EmptyNote>
        )}
      </div>
    </div>
  );
}
