import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { fmtDate, todayISO } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/today", label: "Today", glyph: "◕" },
  { to: "/events", label: "Events", glyph: "▤" },
] as const;
const NAV_RIGHT = [
  { to: "/library", label: "Library", glyph: "▦" },
  { to: "/ask", label: "Ask", glyph: "?" },
] as const;

function NavItem({ to, label, glyph }: { to: string; label: string; glyph: string }) {
  return (
    <Link
      to={to}
      className="tap flex flex-col items-center justify-center gap-1 py-1.5 text-ink-soft"
      activeProps={{ className: "text-ink" }}
    >
      <span className="font-display text-[16px] leading-none">{glyph}</span>
      <span className="label-mono text-[9px]">{label}</span>
    </Link>
  );
}

export function QuickAddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (
    to: "/events/new" | "/library/clients/new" | "/library/recipes/new" | "/library/ingredients/new",
  ) => {
    onOpenChange(false);
    navigate({ to });
  };
  const later = ["Expense", "Task", "Purchase"];
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-paper border-ink/10">
        <div className="mx-auto w-full max-w-md px-5 pb-safe pt-2">
          <DrawerTitle className="font-display text-[26px] leading-none">Quick add</DrawerTitle>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => go("/events/new")}
              className="torn tap bg-cream px-4 py-4 text-left shadow-card active:translate-y-px"
            >
              <div className="font-display text-[22px] leading-none text-flame">+</div>
              <div className="mt-2 font-semibold">New Enquiry</div>
              <div className="font-mono text-[11px] text-ink-soft">Start an Event</div>
            </button>
            <button
              onClick={() => go("/library/clients/new")}
              className="torn tap bg-cream px-4 py-4 text-left shadow-card active:translate-y-px"
            >
              <div className="font-display text-[22px] leading-none text-ink">+</div>
              <div className="mt-2 font-semibold">New Client</div>
              <div className="font-mono text-[11px] text-ink-soft">Add to Library</div>
            </button>
            <button
              onClick={() => go("/library/recipes/new")}
              className="torn tap bg-cream px-4 py-4 text-left shadow-card active:translate-y-px"
            >
              <div className="font-display text-[22px] leading-none text-ink">+</div>
              <div className="mt-2 font-semibold">New Recipe</div>
              <div className="font-mono text-[11px] text-ink-soft">Scalable recipe</div>
            </button>
            <button
              onClick={() => go("/library/ingredients/new")}
              className="torn tap bg-cream px-4 py-4 text-left shadow-card active:translate-y-px"
            >
              <div className="font-display text-[22px] leading-none text-ink">+</div>
              <div className="mt-2 font-semibold">New Ingredient</div>
              <div className="font-mono text-[11px] text-ink-soft">Yield &amp; cost</div>
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {later.map((l) => (
              <div
                key={l}
                className="rounded-sm border border-dashed border-ink/20 px-2 py-3 text-center opacity-60"
              >
                <div className="text-sm font-medium">{l}</div>
                <div className="label-mono text-[9px] text-ink-soft">Coming later</div>
              </div>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function AppShell({ children, orgName }: { children: ReactNode; orgName?: string | undefined }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen w-full bg-shell">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper md:max-w-5xl md:flex-row md:bg-transparent">
        {/* Desktop sidebar */}
        <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-ink/10 md:bg-paper md:px-4 md:py-6">
          <div className="mb-6 font-display text-[26px] leading-none tracking-tight">
            INBTWN<span className="ml-1 align-top font-hand text-[11px]">OS</span>
          </div>
          {[...NAV, ...NAV_RIGHT].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="tap flex items-center gap-3 rounded-sm px-3 font-mono text-[12px] text-ink-soft hover:bg-cream"
              activeProps={{ className: "bg-cream text-ink" }}
            >
              <span className="font-display text-[14px]">{n.glyph}</span>
              {n.label}
            </Link>
          ))}
          <button
            onClick={() => setQuickOpen(true)}
            className="tap mt-3 flex items-center justify-center gap-2 rounded-sm bg-flame px-3 font-semibold text-cream shadow-press"
          >
            <span className="font-display text-[20px] leading-none">+</span> Quick add
          </button>
          <div className="mt-auto">
            {orgName ? (
              <div className="mb-2 truncate font-mono text-[11px] text-ink-soft">{orgName}</div>
            ) : null}
            <button onClick={signOut} className="font-mono text-[11px] text-ink-soft underline">
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:bg-paper">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between px-5 pb-3 pt-5 md:hidden">
            <Link to="/today" className="font-display text-[26px] leading-none tracking-tight">
              INBTWN<span className="ml-1 align-top font-hand text-[11px]">OS</span>
            </Link>
            <div className="flex items-center gap-2">
              {orgName ? (
                <span className="label-hand max-w-[120px] truncate rounded-sm bg-ink px-2 py-1 text-[10px] text-cream">
                  {orgName}
                </span>
              ) : null}
              <span className="font-mono text-[11px] text-ink-soft">{fmtDate(todayISO())}</span>
            </div>
          </header>

          <main className="flex-1 px-5 pb-28 md:px-8 md:py-8">{children}</main>

          {/* Mobile bottom nav */}
          <nav className="jag fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-ink/10 bg-cream/95 px-2 pb-safe pt-3 backdrop-blur md:hidden">
            <div className="grid grid-cols-5 items-end">
              {NAV.map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
              <div className="flex flex-col items-center gap-1">
                <button
                  aria-label="Quick add"
                  onClick={() => setQuickOpen(true)}
                  className={cn(
                    "-mt-6 grid size-12 place-items-center rounded-full bg-flame text-cream shadow-press active:translate-y-[2px] active:shadow-none",
                  )}
                >
                  <span className="font-display text-[26px] leading-none">+</span>
                </button>
                <span className="label-mono text-[9px] text-ink-soft">Add</span>
              </div>
              {NAV_RIGHT.map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
            </div>
          </nav>
        </div>
      </div>
      <QuickAddSheet open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
