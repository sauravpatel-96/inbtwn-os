import { useEffect, useState } from "react";

/**
 * Per-tab navigation memory ("take me back to where I was").
 * Stored in localStorage so it survives refresh. Navigation-only: never stores form drafts.
 */
export type TabKey = "today" | "events" | "library" | "ask";
export type TabMemory = { href: string; y: number };

const KEY = "inbtwn.tabs.v1";
export const TAB_ROOT: Record<TabKey, string> = {
  today: "/today",
  events: "/events",
  library: "/library",
  ask: "/ask",
};

export function tabForPath(pathname: string): TabKey | null {
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/library") || pathname.startsWith("/settings")) return "library";
  if (pathname.startsWith("/ask")) return "ask";
  return null;
}

/** Create/edit forms are not remembered — drafts are a separate concern. */
export function isRememberable(pathname: string): boolean {
  return !/\/(new|edit)\/?$/.test(pathname);
}

function readAll(): Partial<Record<TabKey, TabMemory>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getTabMemory(tab: TabKey): TabMemory | undefined {
  return readAll()[tab];
}

export function setTabMemory(tab: TabKey, mem: TabMemory) {
  try {
    const all = readAll();
    all[tab] = mem;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — memory is best-effort */
  }
}

export function clearTabMemory(tab: TabKey) {
  try {
    const all = readAll();
    delete all[tab];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Lightweight persisted view state (filters etc.). */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const storageKey = `inbtwn.view.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(storageKey) as T | null;
      return v && allowed.includes(v) ? v : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}
