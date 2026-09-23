import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { clientsQuery, eventsQuery } from "@/lib/queries";
import { clientDisplayName } from "@/lib/format";
import { fmtDate } from "@/lib/format";
import { contactName, primaryContactOf } from "@/lib/crm";
import { PageTitle, EmptyNote, TextInput, DemoTag, Chip } from "@/components/inbtwn/bits";
import { CLIENT_TYPES, ACTIVE_STATUSES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/library/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — INBTWN OS" },
      { name: "description", content: "Your client library: organisations, individuals, contacts and event history." },
      { property: "og:title", content: "Clients — INBTWN OS" },
      { property: "og:description", content: "Search and manage your catering clients." },
    ],
  }),
  component: ClientsPage,
});

type TypeFilter = "all" | "organisation" | "individual";
type StateFilter = "active" | "archived";

function ClientsPage() {
  const clients = useQuery(clientsQuery);
  const events = useQuery(eventsQuery);
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [state, setState] = useState<StateFilter>("active");

  const today = new Date().toISOString().slice(0, 10);
  const nextEventOf = useMemo(() => {
    const map = new Map<string, { title: string; date: string | null }>();
    const rows = (events.data ?? [])
      .filter((e) => e.event_date && e.event_date >= today && ACTIVE_STATUSES.includes(e.status))
      .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
    for (const e of rows) {
      if (e.client_id && !map.has(e.client_id)) map.set(e.client_id, { title: e.title, date: e.event_date });
    }
    return map;
  }, [events.data, today]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (clients.data ?? []).filter((c) => {
      const isOrg = c.client_type !== "individual";
      if (type === "organisation" && !isOrg) return false;
      if (type === "individual" && isOrg) return false;
      if (state === "active" && c.active === false) return false;
      if (state === "archived" && c.active !== false) return false;
      if (!needle) return true;
      const contactBits = (c.contacts ?? []).flatMap((x) => [x.first_name, x.last_name, x.email, x.phone]);
      return [c.company_name, c.first_name, c.last_name, c.email, c.phone, ...contactBits]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [clients.data, q, type, state]);

  return (
    <div>
      <div className="mb-1">
        <Link to="/library" className="font-mono text-[11px] text-ink-soft">
          ← Library
        </Link>
      </div>
      <PageTitle
        title="Clients"
        aside={
          <Link to="/library/clients/new" className="rounded-sm bg-ink px-3 py-2 font-mono text-[11px] normal-case tracking-normal text-cream">
            + New client
          </Link>
        }
      />
      <div className="mb-3 flex items-center gap-2.5 bg-cream px-3.5 py-1 outline-1 outline-ink/10">
        <span className="font-display text-[18px] leading-none text-ink-soft">?</span>
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, contact, email, phone…"
          className="border-0 bg-transparent px-0 font-mono text-[14px]"
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={type === "all"} onClick={() => setType("all")}>
          All
        </Chip>
        <Chip active={type === "organisation"} onClick={() => setType("organisation")}>
          Organisations
        </Chip>
        <Chip active={type === "individual"} onClick={() => setType("individual")}>
          Individuals
        </Chip>
        <Chip active={state === "archived"} onClick={() => setState(state === "archived" ? "active" : "archived")}>
          Archived
        </Chip>
      </div>

      {clients.isLoading ? (
        <p className="font-mono text-[12px] text-ink-soft">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyNote>{clients.data?.length ? "No matches." : "No clients yet."}</EmptyNote>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((c) => {
            const count = c.events?.[0]?.count ?? 0;
            const primary = primaryContactOf(c.contacts);
            const next = nextEventOf.get(c.id);
            return (
              <Link
                key={c.id}
                to="/library/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex items-center gap-3 bg-cream px-3.5 py-3 text-ink outline-1 outline-ink/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-[15px] leading-tight">{clientDisplayName(c)}</p>
                    {c.is_demo ? <DemoTag /> : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-soft">
                    {[
                      c.client_type === "individual"
                        ? "Individual"
                        : CLIENT_TYPES.find((t) => t.value === c.client_type)?.label,
                      primary ? contactName(primary) : null,
                      c.active === false ? "Archived" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {next ? (
                    <p className="truncate font-mono text-[11px] text-flame">
                      Next: {fmtDate(next.date)} · {next.title}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[20px] leading-none">{count}</div>
                  <div className="label-mono text-[9px] text-ink-soft">events</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
