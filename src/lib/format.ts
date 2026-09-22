import { format, parseISO, differenceInCalendarDays, isValid } from "date-fns";
import { DEFAULT_CURRENCY } from "./constants";

/** "Sat 24 Oct" */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "Date TBC";
  const date = parseISO(d);
  if (!isValid(date)) return "Date TBC";
  return format(date, "EEE d MMM");
}

/** "Sat 24 Oct 2026" */
export function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "Date TBC";
  const date = parseISO(d);
  if (!isValid(date)) return "Date TBC";
  return format(date, "EEE d MMM yyyy");
}

/** Split for the big date block: { dow: "Sat", day: "24", mon: "Oct" } */
export function dateParts(d: string | null | undefined) {
  if (!d) return null;
  const date = parseISO(d);
  if (!isValid(date)) return null;
  return { dow: format(date, "EEE"), day: format(date, "dd"), mon: format(date, "MMM") };
}

/** "18:30" from a postgres time "18:30:00" */
export function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

export function fmtMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return null;
  const isInteger = Number.isInteger(n);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const date = parseISO(d);
  if (!isValid(date)) return null;
  return differenceInCalendarDays(date, new Date());
}

export function daysSince(iso: string): number {
  return differenceInCalendarDays(new Date(), parseISO(iso));
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function clientDisplayName(c: {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined): string {
  if (!c) return "No client";
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (c.company_name && person) return `${c.company_name}`;
  return c.company_name || person || "Unnamed client";
}

export function clientContactName(c: {
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined): string | null {
  if (!c) return null;
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return person || null;
}
