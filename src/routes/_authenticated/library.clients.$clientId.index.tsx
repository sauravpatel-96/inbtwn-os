import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clientQuery, type ContactRow } from "@/lib/queries";
import { todayDataQuery, type EventDerived } from "@/lib/today";
import { clientMetrics, clientContactsQuery, contactName, primaryContactOf } from "@/lib/crm";
import { clientDisplayName, clientContactName, fmtDate, fmtMoney } from "@/lib/format";
import { CLIENT_TYPES } from "@/lib/constants";
import { PageTitle, SectionHeading, EmptyNote, DemoTag, StatusPill, SourceBadge, GhostButton } from "@/components/inbtwn/bits";
import { ContactForm } from "@/components/inbtwn/ContactForm";

export const Route = createFileRoute("/_authenticated/library/clients/$clientId/")({
  head: () => ({
    meta: [
      { title: "Client — INBTWN OS" },
      { name: "description", content: "Client relationship: contacts, event history and money." },
      { property: "og:title", content: "Client — INBTWN OS" },
      { property: "og:description", content: "Client contacts, events and relationship summary." },
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
        <span className="text-right font-medium break-words">{value}</span>
      )}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="bg-cream px-3 py-2.5 outline-1 outline-ink/10">
      <div className="label-mono text-[9px] text-ink-soft">{label}</div>
      <div className="font-display text-[20px] leading-tight">{value}</div>
      {note ? <div className="font-mono text-[10px] text-ink-soft">{note}</div> : null}
    </div>
  );
}

function EventRow({ d }: { d: EventDerived }) {
  const e = d.event;
  const money = d.platform
    ? d.expectedPayout === null
      ? "Payout unknown"
      : `${d.payoutReceived ? "Payout" : "Expected payout"} ${fmtMoney(d.expectedPayout, e.currency)}`
    : d.agreed === null
      ? "No agreed value"
      : `Agreed ${fmtMoney(d.agreed, e.currency)}`;
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: e.id }}
      className="block bg-cream px-3.5 py-3 text-ink outline-1 outline-ink/10"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={e.status} />
        <SourceBadge source={e.source} />
      </div>
      <p className="mt-1.5 truncate font-semibold text-[15px] leading-tight">{e.title}</p>
      <p className="truncate font-mono text-[11px] text-ink-soft">
        {fmtDate(e.event_date)} · {money}
      </p>
    </Link>
  );
}

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const client = useQuery(clientQuery(clientId));
  const contacts = useQuery(clientContactsQuery(clientId));
  const data = useQuery(todayDataQuery);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const metrics = useMemo(
    () => (data.data ? clientMetrics(clientId, data.data) : null),
    [data.data, clientId],
  );

  if (client.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!client.data) return <EmptyNote>Client not found.</EmptyNote>;
  const c = client.data;
  const isOrg = c.client_type !== "individual";
  const contactRows = (contacts.data ?? []).filter((x) => showArchived || x.active);
  const primary = primaryContactOf(contacts.data);
  const currency = c.client_type ? "GBP" : "GBP";

  const refreshContacts = () => {
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const archiveContact = async (row: ContactRow) => {
    const { error } = await supabase
      .from("client_contacts")
      .update({ active: !row.active, is_primary: row.active ? false : row.is_primary })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(row.active ? "Contact archived" : "Contact restored");
    refreshContacts();
  };

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/clients" className="font-mono text-[11px] text-ink-soft">
          ← Clients
        </Link>
      </div>
      <PageTitle title={clientDisplayName(c)}>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-soft">
          {isOrg ? CLIENT_TYPES.find((t) => t.value === c.client_type)?.label : "Individual"}
          {c.active === false ? <span className="text-flame">Archived</span> : null}
          {c.is_demo ? <DemoTag /> : null}
        </div>
      </PageTitle>

      <div className="mb-4 flex gap-2">
        <Link
          to="/events/new"
          search={{ clientId, ...(primary ? { contactId: primary.id } : {}) }}
          className="tap flex-1 rounded-sm bg-ink px-3 py-2.5 text-center font-mono text-[12px] text-cream"
        >
          + New event
        </Link>
        <Link
          to="/library/clients/$clientId/edit"
          params={{ clientId }}
          className="tap rounded-sm border border-ink/20 bg-cream px-3 py-2.5 font-mono text-[12px] text-ink"
        >
          Edit client
        </Link>
      </div>

      <div
        className={
          [c.email, c.phone, c.website, c.source, c.billing_address, c.default_event_address, primary].some(Boolean)
            ? "bg-cream px-4 py-2 outline-1 outline-ink/10"
            : "hidden"
        }
      >
        {/* The active primary contact record is authoritative; the older
            client-level fields are only a fallback when no contact exists. */}
        <Row label="Primary contact" value={primary ? contactName(primary) : c.company_name ? clientContactName(c) : null} />
        <Row
          label="Email"
          value={primary?.email ?? c.email}
          href={(primary?.email ?? c.email) ? `mailto:${primary?.email ?? c.email}` : undefined}
        />
        <Row
          label="Phone"
          value={primary?.phone ?? c.phone}
          href={
            (primary?.phone ?? c.phone)
              ? `tel:${(primary?.phone ?? c.phone ?? "").replace(/\s+/g, "")}`
              : undefined
          }
        />
        <Row label="Website" value={c.website} />
        <Row label="Source" value={c.source} />
        <Row label="Billing" value={c.billing_address} />
        <Row label="Event address" value={c.default_event_address} />
      </div>

      {/* Relationship summary — reuses the authoritative Finance rules */}
      <div className="mt-6">
        <SectionHeading title="Relationship" />
        {!metrics ? (
          <p className="font-mono text-[12px] text-ink-soft">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Events" value={String(metrics.totalCount)} />
              <Metric label="Upcoming" value={String(metrics.upcomingCount)} />
              <Metric label="Completed" value={String(metrics.completedCount)} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Metric
                label="Agreed (direct)"
                value={fmtMoney(metrics.agreed, currency) ?? "—"}
                note={metrics.agreedUnknown ? `${metrics.agreedUnknown} not yet agreed` : undefined}
              />
              <Metric label="Received" value={fmtMoney(metrics.received, currency) ?? "—"} />
              <Metric label="Outstanding" value={fmtMoney(metrics.outstanding, currency) ?? "—"} />
            </div>
            {metrics.platformCount ? (
              <div className="mt-2 bg-cream px-3 py-2.5 outline-1 outline-ink/10">
                <div className="label-mono text-[9px] text-ink-soft">Platform payouts</div>
                <p className="mt-0.5 font-mono text-[12px] text-ink">
                  {[
                    metrics.payoutReceived ? `${fmtMoney(metrics.payoutReceived, currency)} received` : null,
                    metrics.payoutExpected ? `${fmtMoney(metrics.payoutExpected, currency)} expected` : null,
                    metrics.payoutUnknown ? `${metrics.payoutUnknown} payout unknown` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No payouts recorded"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-soft">
                  Platform bookings settle through the platform. Client-facing quote values are not counted as revenue.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Contacts */}
      {isOrg ? (
        <div className="mt-6">
          <SectionHeading
            title={`Contacts · ${contactRows.length}`}
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAdding((s) => !s);
                }}
                className="font-mono text-[11px] text-flame"
              >
                {adding ? "Cancel" : "+ Add contact"}
              </button>
            }
          />
          {adding ? (
            <div className="mb-3 bg-cream px-4 py-4 outline-1 outline-ink/10">
              <ContactForm
                clientId={clientId}
                onSaved={() => {
                  setAdding(false);
                  refreshContacts();
                  toast.success("Contact added");
                }}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : null}
          {contactRows.length === 0 ? (
            <EmptyNote>No contacts yet.</EmptyNote>
          ) : (
            <div className="flex flex-col gap-2.5">
              {contactRows.map((x) =>
                editing?.id === x.id ? (
                  <div key={x.id} className="bg-cream px-4 py-4 outline-1 outline-ink/10">
                    <ContactForm
                      clientId={clientId}
                      initial={x}
                      onSaved={() => {
                        setEditing(null);
                        refreshContacts();
                        toast.success("Contact updated");
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <div key={x.id} className="bg-cream px-3.5 py-3 outline-1 outline-ink/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[15px] leading-tight">
                          {contactName(x)}
                          {x.is_primary && x.active ? <span className="ml-2 label-mono text-flame">Primary</span> : null}
                          {!x.active ? <span className="ml-2 label-mono text-ink-soft">Archived</span> : null}
                        </p>
                        {x.role ? <p className="font-mono text-[11px] text-ink-soft">{x.role}</p> : null}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px]">
                      {x.email ? (
                        <a href={`mailto:${x.email}`} className="tap break-all text-flame">
                          {x.email}
                        </a>
                      ) : null}
                      {x.phone ? (
                        <a href={`tel:${x.phone.replace(/\s+/g, "")}`} className="tap text-flame">
                          {x.phone}
                        </a>
                      ) : null}
                    </div>
                    {x.notes ? <p className="mt-1 whitespace-pre-wrap text-[13px]">{x.notes}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <GhostButton type="button" onClick={() => setEditing(x)}>
                        Edit
                      </GhostButton>
                      <GhostButton type="button" onClick={() => archiveContact(x)}>
                        {x.active ? "Archive" : "Restore"}
                      </GhostButton>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
          {(contacts.data ?? []).some((x) => !x.active) ? (
            <button
              type="button"
              onClick={() => setShowArchived((s) => !s)}
              className="mt-2 font-mono text-[11px] text-ink-soft"
            >
              {showArchived ? "Hide archived contacts" : "Show archived contacts"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Notes */}
      {c.notes ? (
        <div className="mt-6">
          <SectionHeading title="Relationship notes" />
          <div className="whitespace-pre-wrap bg-cream px-4 py-3 text-sm outline-1 outline-ink/10">{c.notes}</div>
        </div>
      ) : null}

      {/* Events */}
      <div className="mt-6">
        <SectionHeading title={`Upcoming · ${metrics?.upcoming.length ?? 0}`} />
        {metrics?.upcoming.length ? (
          <div className="flex flex-col gap-2.5">
            {metrics.upcoming.map((d) => (
              <EventRow key={d.event.id} d={d} />
            ))}
          </div>
        ) : (
          <EmptyNote>No upcoming events.</EmptyNote>
        )}
      </div>

      {metrics?.past.length ? (
        <div className="mt-6">
          <SectionHeading title={`Past · ${metrics.past.length}`} />
          <div className="flex flex-col gap-2.5">
            {metrics.past.map((d) => (
              <EventRow key={d.event.id} d={d} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
