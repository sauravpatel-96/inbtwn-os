import { useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TAB_ROOT,
  clearTabMemory,
  getTabMemory,
  isRememberable,
  setTabMemory,
  tabForPath,
  type TabKey,
} from "@/lib/tab-memory";

let suppressUntil = 0;

function restoreScroll(y: number) {
  if (y <= 0) return;
  suppressUntil = Date.now() + 3000;
  const started = Date.now();
  let heldSince = 0;
  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.min(y, Math.max(0, max));
    if (Math.abs(window.scrollY - target) > 2) {
      window.scrollTo(0, target);
      heldSince = 0;
    } else if (max >= y - 4) {
      heldSince ||= Date.now();
    }
    // Keep re-applying until content has loaded and the position has held (router may reset to top).
    if ((heldSince && Date.now() - heldSince > 400) || Date.now() - started > 3000) {
      suppressUntil = Date.now() + 200;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Records the current location + scroll into its tab's memory. Mount once in the shell. */
export function useTabMemoryRecorder() {
  const location = useRouterState({ select: (s) => s.location });
  const href = location.pathname + (location.searchStr ?? "");
  const current = useRef({ href, tab: tabForPath(location.pathname) });
  const first = useRef(true);

  useEffect(() => {
    const tab = tabForPath(location.pathname);
    current.current = { href, tab };
    if (!tab || !isRememberable(location.pathname)) return;
    const prev = getTabMemory(tab);
    if (first.current) {
      first.current = false;
      // Refresh on a remembered screen: bring back its scroll position.
      if (prev?.href === href) {
        restoreScroll(prev.y);
        return;
      }
    }
    if (prev?.href !== href) {
      suppressUntil = Math.max(suppressUntil, Date.now() + 400);
      setTabMemory(tab, { href, y: 0 });
    }
  }, [href, location.pathname]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (Date.now() < suppressUntil) return;
      clearTimeout(t);
      t = setTimeout(() => {
        if (Date.now() < suppressUntil) return;
        const { href: h, tab } = current.current;
        if (!tab) return;
        const mem = getTabMemory(tab);
        if (mem?.href === h) setTabMemory(tab, { href: h, y: Math.round(window.scrollY) });
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);
}

const ENTITY_CHECKS: { re: RegExp; table: "events" | "recipes" | "ingredients" | "clients" }[] = [
  { re: /^\/events\/([0-9a-f-]{36})/, table: "events" },
  { re: /^\/library\/recipes\/([0-9a-f-]{36})/, table: "recipes" },
  { re: /^\/library\/ingredients\/([0-9a-f-]{36})/, table: "ingredients" },
  { re: /^\/library\/clients\/([0-9a-f-]{36})/, table: "clients" },
];

async function stillValid(href: string): Promise<boolean> {
  const path = href.split("?")[0] ?? href;
  for (const c of ENTITY_CHECKS) {
    const m = path.match(c.re);
    if (m) {
      const { data, error } = await supabase.from(c.table).select("id").eq("id", m[1]!).maybeSingle();
      return !error && !!data;
    }
  }
  return true;
}

/** Returns a handler that opens a main tab at its remembered location. */
export function useOpenTab() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return useCallback(
    async (tab: TabKey) => {
      const here = tabForPath(pathname);
      // Today always opens its dashboard; re-tapping the active tab goes to its root.
      const mem = tab === "today" || here === tab ? undefined : getTabMemory(tab);
      if (tab === "today") {
        const t = getTabMemory("today");
        await router.navigate({ href: TAB_ROOT.today });
        if (here !== "today" && t?.href === TAB_ROOT.today) restoreScroll(t.y);
        return;
      }
      if (!mem) {
        await router.navigate({ href: TAB_ROOT[tab] });
        return;
      }
      if (!(await stillValid(mem.href))) {
        clearTabMemory(tab);
        await router.navigate({ href: TAB_ROOT[tab] });
        return;
      }
      await router.navigate({ href: mem.href });
      restoreScroll(mem.y);
    },
    [router, pathname],
  );
}
