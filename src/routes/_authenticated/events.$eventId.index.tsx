import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { eventQuery, type EventRow, type ClientRow } from "@/lib/queries";
import { EVENT_STATUSES, GUEST_COUNT_STATUSES, type EventStatus } from "@/lib/constants";
import { fmtDateLong, fmtTime, fmtMoney, clientDisplayName, clientContactName } from "@/lib/format";
import { PageTitle, SectionHeading, StatusPill, SourceBadge, DemoTag, EmptyNote, Chip } from "@/components/inbtwn/bits";
import { Dietaries } from "@/components/inbtwn/Dietaries";
import { EventMenu } from "@/components/inbtwn/EventMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SECTIONS = ["overview", "menu", "production", "shopping", "packing", "staff", "client", "finance", "more"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Record<Section, string> = {
  overview: "Overview",
  menu: "Menu",
  production: "Production",
  shopping: "Shopping",
  packing: "Packing",
  staff: "Staff",
  client: "Client",
  finance: "Finance",
  more: "More",
};
const PLACEHOLDER: Partial<Record<Section, string>> = {
  production: "Production quantities arrive with the Recipe Engine (Build 2).",
  shopping: "Shopping lists will be generated from menus in a later build.",
  packing: "Packing and equipment lists are coming in a later build.",
  staff: "Staffing will be added in a later build.",
  finance: "Quotes, invoicing and profitability are coming in a later build.",
  more: "Tasks, expenses and documents will live here in a later build.",
};

export const Route = createFileRoute("/_authenticated/events/$eventId/")({
  validateSearch: z.object({ s: z.enum(SECTIONS).optional() }),
  head: () => ({
    meta: [
      { title: "Event — INBTWN OS" },
      { name: "description", content: "Event overview: dates, guests, venue, client, dietaries and readiness." },
      { property: "og:title", content: "Event — INBTWN OS" },
      { property: "og:description", content: "Event overview and readiness." },
    ],
  }),
  component: EventDetailPage,
});

function Row({ label, value, href }: { label: string; value: string | null | undefined; href?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2.5 last:border-0">
      <span className="label-mono shrink-0 text-ink-soft">{label}</span>
      {value ? (
        href ? (
          <a href={href} className="text-right font-medium text-flame">
            {value}
          </a>
        ) : (
          <span className="text-right font-medium">{value}</span>
        )
      ) : (
        <span className="font-mono text-[11px] text-ink-soft/70">Not set</span>
      )}
    </div>
  );
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { s = "overview" } = Route.useSearch();
  const qc = useQueryClient();
  const event = useQuery(eventQuery(eventId));
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);

  if (event.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  if (!event.data) return <EmptyNote>Event not found.</EmptyNote>;
  const e = event.data;
  const c = e.client;
  const money = fmtMoney(e.budget, e.currency);

  const applyStatus = async (status: EventStatus) => {
    const { error } = await supabase.from("events").update({ status }).eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Moved to ${EVENT_STATUSES.find((x) => x.value === status)?.label}`);
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const changeStatus = (status: EventStatus) => {
    if (status === e.status) return;
    if (status === "lost" || status === "cancelled") setPendingStatus(status);
    else applyStatus(status);
  };

  const readiness: { label: string; state: "ok" | "missing" | "na"; note: string }[] = [
    {
      label: "Client",
      state: c ? (c.email || c.phone ? "ok" : "missing") : "missing",
      note: c ? (c.email || c.phone ? "Attached with contact details" : "Attached, no contact details") : "No client attached",
    },
    { label: "Menu", state: "na", note: "Not set up yet" },
    { label: "Shopping", state: "na", note: "Not set up yet" },
    { label: "Production", state: "na", note: "Not set up yet" },
    { label: "Equipment", state: "na", note: "Not set up yet" },
    { label: "Payment", state: "na", note: "Not set up yet" },
  ];

  return (
    <div>
      <div className="mb-1">
        <Link to="/events" className="font-mono text-[11px] text-ink-soft">
          ← Events
        </Link>
      </div>

      {/* Header */}
      <div className="torn bg-cream px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={e.status} />
          <SourceBadge source={e.source} />
          {e.source_reference ? <span className="font-mono text-[10px] text-ink-soft">{e.source_reference}</span> : null}
          {e.is_demo ? <DemoTag /> : null}
        </div>
        <h1 className="mt-2 font-display text-[28px] leading-none">{e.title}</h1>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <div className="label-mono text-ink-soft">Date</div>
            <div className="font-semibold">{fmtDateLong(e.event_date)}</div>
          </div>
          <div>
            <div className="label-mono text-ink-soft">Guests</div>
            <div className="font-semibold">
              {e.guest_count ?? "—"}{" "}
              <span className="font-mono text-[10px] font-normal text-ink-soft">
                {GUEST_COUNT_STATUSES.find((g) => g.value === e.guest_count_status)?.label.toLowerCase()}
              </span>
            </div>
          </div>
          <div>
            <div className="label-mono text-ink-soft">Budget</div>
            <div className="font-semibold">{money ?? "—"}</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[11px] text-ink-soft">
          {e.venue_name || e.venue_address ? [e.venue_name, e.venue_address].filter(Boolean).join(" · ") : "Venue not set"}
        </div>
        <Link
          to="/events/$eventId/edit"
          params={{ eventId }}
          className="tap mt-3 inline-flex items-center rounded-sm border border-ink/20 bg-paper px-4 font-mono text-[12px] text-ink"
        >
          Edit event
        </Link>
      </div>

      {/* Section nav */}
      <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {SECTIONS.map((key) => (
            <Link
              key={key}
              to="/events/$eventId"
              params={{ eventId }}
              search={{ s: key }}
              replace
              className={`font-mono text-[11px] rounded-sm px-3 py-2 min-h-[36px] ${
                s === key ? "bg-ink text-cream" : "bg-cream text-ink-soft outline-1 outline-ink/15"
              }`}
            >
              {SECTION_LABEL[key]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6">
        {s === "overview" ? (
          <>
            <div>
              <SectionHeading title="Event" />
              <div className="torn bg-cream px-4 py-1">
                <Row label="Date" value={fmtDateLong(e.event_date)} />
                <Row label="Arrival" value={fmtTime(e.arrival_time)} />
                <Row label="Service" value={fmtTime(e.service_time)} />
                <Row label="End" value={fmtTime(e.end_time)} />
                <Row label="Guests" value={e.guest_count != null ? String(e.guest_count) : null} />
                <Row label="Type" value={e.event_type} />
                <Row label="Cuisine" value={e.cuisine} />
                <Row label="Service style" value={e.service_style} />
                <Row label="Venue" value={[e.venue_name, e.venue_address].filter(Boolean).join(", ") || null} />
                {e.venue_contact_name || e.venue_contact_phone ? (
                  <Row
                    label="Venue contact"
                    value={[e.venue_contact_name, e.venue_contact_phone].filter(Boolean).join(" · ")}
                    href={e.venue_contact_phone ? `tel:${e.venue_contact_phone.replace(/\s+/g, "")}` : undefined}
                  />
                ) : null}
              </div>
            </div>

            <ClientBlock event={e} compact />

            <Dietaries eventId={eventId} />

            <div>
              <SectionHeading title="Internal notes" />
              {e.internal_notes ? (
                <div className="torn whitespace-pre-wrap bg-cream px-4 py-3 text-sm">{e.internal_notes}</div>
              ) : (
                <EmptyNote>No notes yet.</EmptyNote>
              )}
            </div>

            <div>
              <SectionHeading title="Status" />
              <div className="flex flex-wrap gap-2">
                {EVENT_STATUSES.map((st) => (
                  <Chip key={st.value} active={e.status === st.value} onClick={() => changeStatus(st.value)}>
                    {st.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading title="Readiness" />
              <div className="grid grid-cols-2 gap-2">
                {readiness.map((r) => (
                  <div key={r.label} className={`torn px-3 py-3 ${r.state === "na" ? "bg-cream/60 opacity-70" : "bg-cream"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{r.label}</span>
                      <span
                        className={`size-2.5 rounded-full ${
                          r.state === "ok" ? "bg-s-conf" : r.state === "missing" ? "bg-flame" : "border border-dashed border-ink/40"
                        }`}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-ink-soft">{r.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : s === "client" ? (
          <ClientBlock event={e} />
        ) : (
          <div className="torn bg-cream px-5 py-8 text-center">
            <div className="font-display text-[22px] leading-none">{SECTION_LABEL[s]}</div>
            <p className="mt-3 font-mono text-[12px] text-ink-soft">{PLACEHOLDER[s]}</p>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(pendingStatus)} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">
              Mark as {pendingStatus === "lost" ? "Lost" : "Cancelled"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The event stays on record with all its information — nothing is deleted. You can change the status again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              className="bg-s-lost text-cream"
              onClick={() => {
                if (pendingStatus) applyStatus(pendingStatus);
                setPendingStatus(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientBlock({
  event,
  compact = false,
}: {
  event: EventRow & { client: ClientRow | null };
  compact?: boolean;
}) {
  const c = event.client;
  return (
    <div>
      <SectionHeading
        title="Client"
        action={
          c ? (
            <Link to="/library/clients/$clientId" params={{ clientId: c.id }} className="font-mono text-[11px] text-flame">
              Open client →
            </Link>
          ) : (
            <Link to="/events/$eventId/edit" params={{ eventId: event.id }} className="font-mono text-[11px] text-flame">
              Attach client
            </Link>
          )
        }
      />
      {c ? (
        <div className="torn bg-cream px-4 py-1">
          <Row label="Name" value={clientDisplayName(c)} />
          {c.company_name ? <Row label="Contact" value={clientContactName(c)} /> : null}
          <Row label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
          <Row label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone.replace(/\s+/g, "")}` : undefined} />
          {!compact ? (
            <>
              <Row label="Billing" value={c.billing_address} />
              <Row label="Event address" value={c.default_event_address} />
              {c.notes ? <Row label="Notes" value={c.notes} /> : null}
            </>
          ) : null}
        </div>
      ) : (
        <EmptyNote>No client attached to this event yet.</EmptyNote>
      )}
    </div>
  );
}
