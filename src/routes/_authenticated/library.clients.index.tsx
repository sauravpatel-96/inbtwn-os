import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { clientsQuery } from "@/lib/queries";
import { clientDisplayName, clientContactName } from "@/lib/format";
import { PageTitle, EmptyNote, TextInput, DemoTag } from "@/components/inbtwn/bits";
import { CLIENT_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/library/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — INBTWN OS" },
      { name: "description", content: "Your client library: individuals, companies, agencies and venues." },
      { property: "og:title", content: "Clients — INBTWN OS" },
      { property: "og:description", content: "Search and manage your catering clients." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const clients = useQuery(clientsQuery);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (clients.data ?? []).filter((c) => {
      if (!needle) return true;
      return [c.company_name, c.first_name, c.last_name, c.email, c.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [clients.data, q]);

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
            + Add client
          </Link>
        }
      />
      <div className="torn mb-4 flex items-center gap-2.5 bg-cream px-3.5 py-1">
        <span className="font-display text-[18px] leading-none text-ink-soft">?</span>
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company, email, phone…"
          className="border-0 bg-transparent px-0 font-mono text-[14px]"
        />
      </div>

      {clients.isLoading ? (
        <p className="font-mono text-[12px] text-ink-soft">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyNote>{clients.data?.length ? "No matches." : "No clients yet."}</EmptyNote>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((c, i) => {
            const count = c.events?.[0]?.count ?? 0;
            const contact = clientContactName(c);
            return (
              <Link
                key={c.id}
                to="/library/clients/$clientId"
                params={{ clientId: c.id }}
                className={`torn flex items-center gap-3 bg-cream px-3.5 py-3 text-ink `}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-[15px] leading-tight">{clientDisplayName(c)}</p>
                    {c.is_demo ? <DemoTag /> : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-soft">
                    {[c.company_name && contact ? contact : null, c.email || c.phone].filter(Boolean).join(" · ") ||
                      CLIENT_TYPES.find((t) => t.value === c.client_type)?.label}
                  </p>
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
