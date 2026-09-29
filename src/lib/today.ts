import { kitLines, kitSummary, type KitItemRow, type EventKitRow } from "./kit";
import { addDays as _kitAddDays, format as _kitFormat } from "date-fns";
import { computeAnchors, nextItem, timeline, type Anchors, type RunSheetItemRow, type TimedItem } from "./runsheet";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSchedule,
  financeTotals,
  invoiceTotals,
  isPlatformSource,
  maybeNum,
  resolveAgreedValue,
  round2,
  type AllocationRow,
  type CostRow,
  type Invoice,
  type InvoiceItemRow,
  type InvoiceRow,
  type PaymentRow,
  type TermsRow,
} from "./finance";
import { quoteTotals, type Quote, type QuoteChargeRow, type QuoteRow } from "./quote";
import { daysUntil } from "./format";
import type { EventWithClient } from "./queries";
import { CLIENT_SUMMARY } from "./queries";
import { manualKey } from "./packing";
import { labourTotals, shiftName, type ShiftRow, type StaffMemberRow } from "./staff";
import { parseClock } from "./runsheet";

/* ------------------------------------------------------------------ */
/* Raw org-wide data                                                    */
/* ------------------------------------------------------------------ */

type MenuRow = {
  event_id: string;
  recipe_id: string | null;
  recipe_version_id: string | null;
  recipe: { id: string; name: string; active_version_id: string | null } | null;
};
type ProposalItemLite = { event_id: string; recipe_id: string | null };
type PackingItemLite = { id: string; event_id: string };
type CheckLite = { event_id: string; item_key: string };
type ShopCheckLite = { event_id: string; ingredient_id: string };
type IngredientLite = { id: string; current_unit_cost: number | string | null };
type RecipeIngredientLite = { recipe_version_id: string; ingredient_id: string };
type RecipeComponentLite = { parent_recipe_version_id: string; child_recipe_version_id: string };
export type TaskLite = {
  id: string;
  event_id: string;
  name: string;
  scheduled_date: string | null;
  status: string;
  approximate_minutes: number | null;
  assignment: string;
  source: string;
  recipe_id?: string | null;
  recipe_name?: string | null;
  /** Generated task whose dish is no longer on the confirmed menu. */
  orphaned?: boolean;
};

export type TodayData = {
  events: EventWithClient[];
  terms: TermsRow[];
  payments: PaymentRow[];
  invoices: Invoice[];
  allocations: AllocationRow[];
  costs: CostRow[];
  quotes: (QuoteRow & { charges: QuoteChargeRow[] })[];
  menu: MenuRow[];
  proposalItems: ProposalItemLite[];
  packingItems: PackingItemLite[];
  packingChecks: CheckLite[];
  shoppingChecks: ShopCheckLite[];
  ingredients: IngredientLite[];
  recipeIngredients: RecipeIngredientLite[];
  recipeComponents: RecipeComponentLite[];
  tasks: TaskLite[];
  runSheet: RunSheetItemRow[];
  shifts: ShiftRow[];
  staff: StaffMemberRow[];
  kitItems: KitItemRow[];
  eventKit: EventKitRow[];
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/** Minimal shape both the browser client and an authenticated server client satisfy. */
type ReadClient = { from: (table: string) => any };

/**
 * One org-wide read used by every Today derivation, and by the read-only Ask
 * business-data layer on the server. RLS scopes it to the organisation.
 */
export async function fetchTodayData(client: ReadClient = supabase as unknown as ReadClient): Promise<TodayData> {
  const supabase = client as unknown as typeof import("@/integrations/supabase/client")["supabase"];
  {
    const [
      events,
      terms,
      payments,
      invoiceRows,
      invoiceItems,
      allocations,
      costs,
      quoteRows,
      quoteCharges,
      menu,
      proposalItems,
      packingItems,
      packingChecks,
      shoppingChecks,
      ingredients,
      recipeIngredients,
      recipeComponents,
      tasks,
      runSheet,
      shifts,
      staff,
      kitItems,
      eventKit,
    ] = await Promise.all([
      supabase
        .from("events")
        .select(`*, client:clients(${CLIENT_SUMMARY})`)
        .order("event_date", { ascending: true, nullsFirst: false }),
      supabase.from("event_payment_terms").select("*"),
      supabase.from("event_payments").select("*"),
      supabase.from("event_invoices").select("*"),
      supabase.from("event_invoice_items").select("*"),
      supabase.from("event_payment_allocations").select("*"),
      supabase.from("event_costs").select("*"),
      supabase.from("event_quotes").select("*"),
      supabase.from("event_quote_charges").select("*"),
      supabase.from("event_menu_items").select("event_id, recipe_id, recipe_version_id, recipe:recipes(id, name, active_version_id)"),
      supabase.from("event_proposal_items").select("event_id, recipe_id"),
      supabase.from("event_packing_items").select("id, event_id"),
      supabase.from("event_packing_checks").select("event_id, item_key"),
      supabase.from("event_shopping_checks").select("event_id, ingredient_id"),
      supabase.from("ingredients").select("id, current_unit_cost"),
      supabase.from("recipe_ingredients").select("recipe_version_id, ingredient_id"),
      supabase.from("recipe_components").select("parent_recipe_version_id, child_recipe_version_id"),
      supabase
        .from("event_tasks")
        .select("id, event_id, name, scheduled_date, status, approximate_minutes, assignment, source, recipe_id, recipe:recipes!event_tasks_recipe_id_fkey(name)"),
      supabase.from("event_run_sheet_items").select("*"),
      supabase.from("event_staff_shifts").select("*"),
      supabase.from("staff_members").select("*"),
      supabase.from("kit_items").select("*"),
      supabase.from("event_kit_items").select("*"),
    ]);

    const items = unwrap<InvoiceItemRow[]>(invoiceItems);
    const charges = unwrap<QuoteChargeRow[]>(quoteCharges);

    return {
      events: unwrap<EventWithClient[]>(events),
      terms: unwrap<TermsRow[]>(terms),
      payments: unwrap<PaymentRow[]>(payments),
      invoices: unwrap<InvoiceRow[]>(invoiceRows).map((i) => ({
        ...i,
        items: items.filter((it) => it.invoice_id === i.id),
      })),
      allocations: unwrap<AllocationRow[]>(allocations),
      costs: unwrap<CostRow[]>(costs),
      quotes: unwrap<QuoteRow[]>(quoteRows).map((q) => ({
        ...q,
        charges: charges.filter((c) => c.quote_id === q.id),
      })),
      menu: unwrap<MenuRow[]>(menu),
      proposalItems: unwrap<ProposalItemLite[]>(proposalItems),
      packingItems: unwrap<PackingItemLite[]>(packingItems),
      packingChecks: unwrap<CheckLite[]>(packingChecks),
      shoppingChecks: unwrap<ShopCheckLite[]>(shoppingChecks),
      ingredients: unwrap<IngredientLite[]>(ingredients),
      recipeIngredients: unwrap<RecipeIngredientLite[]>(recipeIngredients),
      recipeComponents: unwrap<RecipeComponentLite[]>(recipeComponents),
      tasks: (() => {
        const menuByEvent = new Map<string, Set<string>>();
        for (const m of unwrap<{ event_id: string; recipe_id: string | null }[]>(menu)) {
          if (!m.recipe_id) continue;
          if (!menuByEvent.has(m.event_id)) menuByEvent.set(m.event_id, new Set());
          menuByEvent.get(m.event_id)!.add(m.recipe_id);
        }
        return unwrap<(TaskLite & { recipe?: { name: string } | null })[]>(tasks).map(({ recipe, ...t }) => ({
          ...t,
          recipe_name: recipe?.name ?? null,
          orphaned: t.source === "recipe" && !!t.recipe_id && !(menuByEvent.get(t.event_id)?.has(t.recipe_id) ?? false),
        }));
      })(),
      runSheet: unwrap<RunSheetItemRow[]>(runSheet),
      shifts: unwrap<ShiftRow[]>(shifts),
      staff: unwrap<StaffMemberRow[]>(staff),
      kitItems: unwrap<KitItemRow[]>(kitItems),
      eventKit: unwrap<EventKitRow[]>(eventKit),
    };
  }
}

export const todayDataQuery = queryOptions({
  queryKey: ["today-data"],
  queryFn: () => fetchTodayData(),
});


/* ------------------------------------------------------------------ */
/* Per-event derived view                                              */
/* ------------------------------------------------------------------ */

export type EventSection =
  | "overview"
  | "proposal"
  | "pricing"
  | "quote"
  | "menu"
  | "production"
  | "shopping"
  | "packing"
  | "staff"
  | "finance";

export type EventDerived = {
  event: EventWithClient;
  platform: boolean;
  daysAway: number | null;
  past: boolean;
  agreed: number | null;
  agreedSource: "quote" | "manual" | null;
  quote: (QuoteRow & { charges: QuoteChargeRow[] }) | null;
  quoteTotal: number | null;
  scheduleOverdue: number;
  depositOutstanding: number;
  invoiceOverdue: number;
  outstanding: number | null;
  expectedPayout: number | null;
  payoutReceived: boolean;
  payoutOverdue: boolean;
  menuCount: number;
  dishesNeedingRecipes: number;
  ingredientsMissingCost: number;
  shoppingRemaining: number;
  packingRemaining: number;
  /** Admin/financial close-out state, separate from the operational status. */
  closed: boolean;
  /** Past confirmed work that has not been marked completed yet. */
  needsCompletion: boolean;
};

/** Recursively collect every ingredient used by a set of recipe versions (ids only). */
function ingredientIdsFor(versionIds: string[], data: TodayData): Set<string> {
  const out = new Set<string>();
  const seen = new Set<string>();
  const stack = [...versionIds];
  while (stack.length) {
    const v = stack.pop() as string;
    if (seen.has(v)) continue;
    seen.add(v);
    for (const ri of data.recipeIngredients) if (ri.recipe_version_id === v) out.add(ri.ingredient_id);
    for (const rc of data.recipeComponents)
      if (rc.parent_recipe_version_id === v) stack.push(rc.child_recipe_version_id);
  }
  return out;
}

const quoteValueOf = (q: (QuoteRow & { charges: QuoteChargeRow[] }) | null): number | null => {
  if (!q) return null;
  const stored = maybeNum(q.agreed_total);
  if (stored !== null) return stored;
  const totals = quoteTotals({ ...q, sections: [] } as unknown as Quote);
  return totals.total > 0 ? round2(totals.total) : null;
};

export function deriveEvent(event: EventWithClient, data: TodayData, today: Date): EventDerived {
  const id = event.id;
  const platform = isPlatformSource(event.source);
  const terms = data.terms.find((t) => t.event_id === id) ?? null;
  const payments = data.payments.filter((p) => p.event_id === id);
  const invoices = data.invoices.filter((i) => i.event_id === id);
  const quote = data.quotes.find((q) => q.event_id === id) ?? null;
  const quoteTotal = quoteValueOf(quote);
  const accepted = quote?.status === "accepted";

  const { value: agreed, source: agreedSource } = resolveAgreedValue({
    terms,
    quoteValue: accepted ? quoteTotal : null,
    quoteAccepted: accepted,
  });

  const schedule = buildSchedule({ terms, agreedTotal: agreed, eventDate: event.event_date, payments, today });
  const scheduleOverdue = round2(
    schedule.filter((l) => l.status === "overdue").reduce((s, l) => s + l.outstanding, 0),
  );
  const depositLine = schedule.find((l) => l.key === "deposit");
  const depositOutstanding =
    depositLine && (depositLine.status === "outstanding" || depositLine.status === "part")
      ? depositLine.outstanding
      : 0;

  const invoiceOverdue = round2(
    invoices.reduce((s, inv) => {
      if (inv.status === "cancelled") return s;
      const due = inv.due_date ? new Date(`${inv.due_date}T00:00:00`) : null;
      if (!due || due >= today) return s;
      const t = invoiceTotals(inv, payments, data.allocations);
      return s + Math.max(t.outstanding, 0);
    }, 0),
  );

  const totals = financeTotals({ terms, agreedTotal: agreed, payments, platform });
  const expectedPayout = maybeNum(terms?.actual_payout) ?? maybeNum(terms?.expected_payout);
  const payoutReceived = terms?.payout_status === "received";
  const payoutDue = terms?.expected_payout_date ? new Date(`${terms.expected_payout_date}T00:00:00`) : null;

  const menuRows = data.menu.filter((m) => m.event_id === id);
  const versionIds = menuRows
    .map((m) => m.recipe_version_id ?? m.recipe?.active_version_id ?? null)
    .filter((v): v is string => !!v);
  const ingredientIds = ingredientIdsFor(versionIds, data);
  const costMap = new Map(data.ingredients.map((i) => [i.id, maybeNum(i.current_unit_cost)]));
  const ingredientsMissingCost = [...ingredientIds].filter((i) => costMap.get(i) == null).length;

  const shoppingChecked = new Set(
    data.shoppingChecks.filter((c) => c.event_id === id).map((c) => c.ingredient_id),
  );
  const shoppingRemaining = [...ingredientIds].filter((i) => !shoppingChecked.has(i)).length;

  const packKeys = [
    ...versionIds.map((v) => `food:${v}`),
    ...data.packingItems.filter((p) => p.event_id === id).map((p) => manualKey(p.id)),
  ];
  const packChecked = new Set(data.packingChecks.filter((c) => c.event_id === id).map((c) => c.item_key));
  const packingRemaining = packKeys.filter((k) => !packChecked.has(k)).length;

  // Operational menu only — proposal dishes are client-facing and may be free text.
  const dishesNeedingRecipes = menuRows.filter(
    (m) => !(m.recipe_version_id ?? m.recipe?.active_version_id),
  ).length;

  const d = daysUntil(event.event_date);
  const isPast = d !== null && d < 0;

  return {
    closed: (event as { closeout_state?: string | null }).closeout_state === "closed",
    needsCompletion: isPast && (event.status === "confirmed" || event.status === "in_progress"),
    event,
    platform,
    daysAway: d,
    past: d !== null && d < 0,
    agreed,
    agreedSource,
    quote,
    quoteTotal,
    scheduleOverdue,
    depositOutstanding,
    invoiceOverdue,
    outstanding: totals.outstanding,
    expectedPayout,
    payoutReceived,
    payoutOverdue: !payoutReceived && !!payoutDue && payoutDue < today,
    menuCount: menuRows.length,
    dishesNeedingRecipes,
    ingredientsMissingCost,
    shoppingRemaining,
    packingRemaining,
  };
}

/* ------------------------------------------------------------------ */
/* Attention                                                            */
/* ------------------------------------------------------------------ */

export type Severity = "high" | "medium" | "low";
const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export type AttentionItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  message: string;
  severity: Severity;
  section: EventSection;
  actionLabel: string;
  /** Lower sorts first within a severity. */
  urgency: number;
  /** In-app action rather than navigation. */
  action?: "complete";
  /** Supporting detail shown under the main message. */
  secondary?: string;
};

const EXCLUDED = ["cancelled", "lost"];

export function buildToday(data: TodayData, today = new Date()): {
  attention: AttentionItem[];
  derived: EventDerived[];
} {
  const derived = data.events
    .filter((e) => !EXCLUDED.includes(e.status))
    .map((e) => deriveEvent(e, data, today));

  const items: AttentionItem[] = [];
  const push = (
    d: EventDerived,
    id: string,
    message: string,
    severity: Severity,
    section: EventSection,
    actionLabel: string,
    urgency: number,
    extra?: { action?: "complete"; secondary?: string },
  ) =>
    items.push({
      id: `${d.event.id}:${id}`,
      eventId: d.event.id,
      eventTitle: d.event.title,
      message,
      severity,
      section,
      actionLabel,
      urgency,
      ...(extra?.action ? { action: extra.action } : {}),
      ...(extra?.secondary ? { secondary: extra.secondary } : {}),
    });

  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);

  for (const d of derived) {
    const away = d.daysAway;
    const pre = away === null || away >= 0;
    const urgency = away ?? 999;

    /* ----- Finance (always relevant, before and after the event) ----- */
    // Past work still waiting to be marked completed leads with that; the money
    // note rides along as secondary detail rather than a second row.
    const lead = d.needsCompletion;
    let financeNote: string | null = null;
    if (d.platform) {
      if (d.payoutOverdue) {
        const amount = d.expectedPayout !== null ? `${money(d.expectedPayout)} ` : "";
        financeNote = `${amount}platform payout overdue`;
        if (!lead) push(d, "payout", financeNote, "high", "finance", "View Finance", urgency);
      }
    } else {
      // A schedule obligation and its invoice are the same money — never both.
      if (d.scheduleOverdue > 0) {
        financeNote = `${money(d.scheduleOverdue)} balance overdue`;
        if (!lead) push(d, "overdue", financeNote, "high", "finance", "View Finance", urgency);
      } else if (d.invoiceOverdue > 0) {
        financeNote = `${money(d.invoiceOverdue)} invoice overdue`;
        if (!lead) push(d, "invoice", financeNote, "high", "finance", "View Finance", urgency);
      }
      if (pre && d.scheduleOverdue === 0 && d.depositOutstanding > 0) {
        push(
          d,
          "deposit",
          `${money(d.depositOutstanding)} deposit outstanding`,
          "medium",
          "finance",
          "View Finance",
          urgency,
        );
      }
    }

    /* ----- Operational completion (never automatic) ----- */
    if (lead) {
      push(d, "complete", "Event has passed", "high", "overview", "Mark completed", urgency, {
        action: "complete",
        ...(financeNote ? { secondary: financeNote } : {}),
      });
    }

    /* ----- Staff still to pay after the job ----- */
    if (away !== null && away < 0 && !d.closed) {
      const lt = labourTotals(data.shifts.filter((sh) => sh.event_id === d.event.id));
      if (lt.unpaid > 0) {
        push(d, "staff-unpaid", `${money(lt.unpaid)} staff not yet paid`, "low", "staff", "View Staff", urgency);
      }
    }

    if (!pre || d.event.status === "completed") continue;

    /* ----- Commercial ----- */
    const stage = d.event.status;
    if ((stage === "quoting" || stage === "awaiting_client") && d.quote && d.quote.status !== "accepted") {
      const amount = d.quoteTotal !== null ? `${money(d.quoteTotal)} ` : "";
      push(d, "quote", `Quote ${amount}not accepted`, "medium", "quote", "View Quote", urgency);
    }
    const confirmed = stage === "confirmed" || stage === "in_progress";
    // Platform bookings settle via the payout, so an agreed value is only expected on direct work.
    if (confirmed && !d.platform && d.agreed === null) {
      push(d, "agreed", "Confirmed without an agreed value", "high", "finance", "Set value", urgency);
    }

    /* ----- Menu & production ----- */
    // Only urgent inside the 7-day operational window; the Menu screen keeps its own readiness warnings.
    if (confirmed && away !== null && away >= 0 && away <= 7 && d.dishesNeedingRecipes > 0) {
      push(
        d,
        "recipes",
        `${d.dishesNeedingRecipes} ${d.dishesNeedingRecipes === 1 ? "dish needs a recipe" : "dishes need recipes"}`,
        "high",
        "menu",
        "Fix Menu",
        urgency,
      );
    }
    if (confirmed && away !== null && away <= 7 && d.menuCount === 0) {
      push(d, "menu", "No menu items yet", "high", "menu", "Build Menu", urgency);
    }
    if (away !== null && away <= 7 && d.menuCount > 0 && d.ingredientsMissingCost > 0) {
      push(
        d,
        "cost",
        `${d.ingredientsMissingCost} ingredients have no cost`,
        "low",
        "production",
        "View Production",
        urgency,
      );
    }

    /* ----- Staff still needed ----- */
    if (confirmed && away !== null && away >= 0 && away <= 7) {
      const need = data.shifts.filter((sh) => sh.event_id === d.event.id && !sh.is_owner && !sh.staff_member_id).length;
      if (need > 0) {
        push(d, "staff-needed", `${need} ${need === 1 ? "person" : "people"} still needed`, "medium", "staff", "View Staff", urgency);
      }
    }

    /* ----- Operations ----- */
    if (away !== null && away <= 3 && d.shoppingRemaining > 0) {
      push(
        d,
        "shopping",
        `${d.shoppingRemaining} items left to buy`,
        away <= 1 ? "high" : "medium",
        "shopping",
        "View Shopping",
        urgency,
      );
    }
    if (away !== null && away <= 1 && d.packingRemaining > 0) {
      push(
        d,
        "packing",
        `${d.packingRemaining} packing items remaining`,
        "high",
        "packing",
        "View Packing",
        urgency,
      );
    }
  }

  items.sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.urgency - b.urgency || a.eventTitle.localeCompare(b.eventTitle),
  );
  return { attention: items, derived };
}

/* ------------------------------------------------------------------ */
/* Upcoming, operations and money                                       */
/* ------------------------------------------------------------------ */

export function upcomingEvents(derived: EventDerived[], days = 7): EventDerived[] {
  return derived
    .filter((d) => d.daysAway !== null && d.daysAway >= 0 && d.daysAway <= days && d.event.status !== "completed")
    .sort((a, b) => (a.daysAway ?? 0) - (b.daysAway ?? 0));
}

export type OpsSummary = {
  shoppingItems: number;
  shoppingEvents: number;
  packingItems: number;
  packingEvents: number;
  recipeGaps: number;
  recipeGapEvents: number;
};

/** Operational work for events happening within the window (past events excluded). */
export function opsSummary(derived: EventDerived[], days = 7): OpsSummary {
  const live = derived.filter(
    (d) => d.daysAway !== null && d.daysAway >= 0 && d.daysAway <= days && d.event.status !== "completed",
  );
  const shopping = live.filter((d) => d.shoppingRemaining > 0);
  const packing = live.filter((d) => d.packingRemaining > 0);
  const recipes = live.filter((d) => d.dishesNeedingRecipes > 0);
  return {
    shoppingItems: shopping.reduce((s, d) => s + d.shoppingRemaining, 0),
    shoppingEvents: shopping.length,
    packingItems: packing.reduce((s, d) => s + d.packingRemaining, 0),
    packingEvents: packing.length,
    recipeGaps: recipes.reduce((s, d) => s + d.dishesNeedingRecipes, 0),
    recipeGapEvents: recipes.length,
  };
}

export type MoneySummary = {
  overdue: number;
  outstanding: number;
  outstandingIncomplete: boolean;
  payouts: number;
  payoutsIncomplete: boolean;
  confirmedThisMonth: number;
};

/**
 * Deliberate definitions: event budget is never revenue, an unknown platform
 * payout is never counted, and a schedule obligation and its invoice are
 * counted once.
 */
export function moneySummary(derived: EventDerived[], today = new Date()): MoneySummary {
  let overdue = 0;
  let outstanding = 0;
  let outstandingIncomplete = false;
  let payouts = 0;
  let payoutsIncomplete = false;
  let confirmedThisMonth = 0;

  const month = today.getMonth();
  const year = today.getFullYear();

  for (const d of derived) {
    if (d.platform) {
      if (!d.payoutReceived) {
        if (d.expectedPayout !== null) payouts += d.expectedPayout;
        else if (d.event.status === "confirmed" || d.event.status === "in_progress" || d.event.status === "completed")
          payoutsIncomplete = true;
      }
      continue;
    }

    // The same obligation may appear in both the schedule and an invoice.
    overdue += Math.max(d.scheduleOverdue, d.invoiceOverdue);

    const booked = ["confirmed", "in_progress", "completed"].includes(d.event.status);
    if (booked) {
      if (d.outstanding !== null) outstanding += Math.max(d.outstanding, 0);
      else outstandingIncomplete = true;
      if (d.agreed !== null && d.event.event_date) {
        const ed = new Date(`${d.event.event_date}T00:00:00`);
        if (ed.getMonth() === month && ed.getFullYear() === year) confirmedThisMonth += d.agreed;
      }
    }
  }

  return {
    overdue: round2(overdue),
    outstanding: round2(outstanding),
    outstandingIncomplete,
    payouts: round2(payouts),
    payoutsIncomplete,
    confirmedThisMonth: round2(confirmedThisMonth),
  };
}

/* ------------------------------------------------------------------ */
/* Prep tasks                                                           */
/* ------------------------------------------------------------------ */

export type PrepEventGroup = {
  eventId: string;
  title: string;
  eventDate: string | null;
  overdue: TaskLite[];
  dueToday: TaskLite[];
  upcoming: TaskLite[];
  minutes: number;
};

export type PrepSummary = {
  groups: PrepEventGroup[];
  taskCount: number;
  minutes: number;
};

/**
 * Prep work that is live right now: outstanding tasks due today or earlier for
 * events that are still active. Completed, closed, cancelled and lost jobs
 * never resurface here.
 */
export function prepSummary(derived: EventDerived[], data: TodayData, today = new Date(), windowDays = 7): PrepSummary {
  // Local calendar keys only (yyyy-MM-dd) — never via UTC.
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = key(today);
  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + windowDays);
  const horizonKey = key(horizon);
  const byDate = (a: TaskLite, b: TaskLite) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "");

  const groups: PrepEventGroup[] = [];
  for (const d of derived) {
    const st = d.event.status;
    if (st === "completed" || st === "cancelled" || st === "lost" || d.closed) continue;
    const open = data.tasks.filter((t) => t.event_id === d.event.id && t.status !== "done" && !t.orphaned);
    if (open.length === 0) continue;
    const overdue = open.filter((t) => t.scheduled_date !== null && t.scheduled_date < todayKey).sort(byDate);
    const dueToday = open.filter((t) => t.scheduled_date === todayKey);
    const upcoming = open
      .filter((t) => t.scheduled_date !== null && t.scheduled_date > todayKey && t.scheduled_date <= horizonKey)
      .sort(byDate);
    if (overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0) continue;
    groups.push({
      eventId: d.event.id,
      title: d.event.title,
      eventDate: d.event.event_date,
      overdue,
      dueToday,
      upcoming,
      minutes: [...overdue, ...dueToday, ...upcoming].reduce((s, t) => s + (t.approximate_minutes ?? 0), 0),
    });
  }
  groups.sort((a, b) => b.overdue.length - a.overdue.length || (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  return {
    groups,
    taskCount: groups.reduce((s, g) => s + g.overdue.length + g.dueToday.length + g.upcoming.length, 0),
    minutes: groups.reduce((s, g) => s + g.minutes, 0),
  };
}

/* ---------------- Event Day (run sheet) ---------------- */

export type StaffCall = { name: string; time: string; unassigned: boolean };
export type EventDayCard = { eventId: string; title: string; anchors: Anchors; next: TimedItem | null; remaining: number; total: number; staffCalls: StaffCall[] };

/** Non-owner event-day staff with a start time, earliest first (display only). */
export function staffCallsFor(eventId: string, eventDate: string | null, data: TodayData): StaffCall[] {
  return data.shifts
    .filter((sh) => sh.event_id === eventId && !sh.is_owner && sh.work_type === "event" && sh.start_time && (!sh.shift_date || sh.shift_date === eventDate))
    .sort((a, b) => (parseClock(a.start_time) ?? 0) - (parseClock(b.start_time) ?? 0))
    .map((sh) => ({ name: shiftName(sh, data.staff), time: sh.start_time!.slice(0, 5), unassigned: !sh.staff_member_id }));
}

/** One-line staffing state for an upcoming event, or null when there is nothing to say. */
export function staffLine(eventId: string, data: TodayData): string | null {
  const lt = labourTotals(data.shifts.filter((sh) => sh.event_id === eventId));
  if (lt.unassigned > 0) return `Staff: ${lt.unassigned} ${lt.unassigned === 1 ? "person" : "people"} still needed`;
  if (lt.people > 0) return `Staff: ${lt.people} ${lt.people === 1 ? "helper" : "helpers"} confirmed`;
  return null;
}
/**
 * One-line Event Kit state for an upcoming event, only when actionable:
 * items still to buy, or — within 2 days — reusable kit not fully packed.
 */
export function kitTodayLine(eventId: string, eventDate: string | null, guests: number | null, data: TodayData, today = new Date()): string | null {
  const rows = data.eventKit.filter((r) => r.event_id === eventId);
  if (!rows.length) return null;
  const k = kitSummary(kitLines(rows, data.kitItems, guests ?? 0));
  if (k.toBuy > 0) return `Kit: ${k.toBuy} ${k.toBuy === 1 ? "item" : "items"} still to buy`;
  if (eventDate) {
    const soon = _kitFormat(_kitAddDays(today, 2), "yyyy-MM-dd");
    if (eventDate <= soon && k.reusableTotal > 0 && k.reusablePacked < k.reusableTotal)
      return `Equipment: ${k.reusablePacked}/${k.reusableTotal} packed`;
  }
  return null;
}
export type EventDaySummary = { today: EventDayCard[]; missing: { eventId: string; title: string; eventDate: string | null }[] };

/** Today: live run sheets for events happening today. Before: upcoming 7-day events with no run sheet yet. */
export function eventDaySummary(derived: EventDerived[], data: TodayData, today = new Date(), windowDays = 7): EventDaySummary {
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = key(today);
  const horizonKey = key(new Date(today.getFullYear(), today.getMonth(), today.getDate() + windowDays));
  const out: EventDaySummary = { today: [], missing: [] };
  for (const d of derived) {
    const e = d.event;
    if (!["confirmed", "in_progress"].includes(e.status) || d.closed || !e.event_date) continue;
    const items = data.runSheet.filter((r) => r.event_id === e.id);
    if (e.event_date === todayKey) {
      const anchors = computeAnchors(e);
      const tl = timeline(items, anchors);
      out.today.push({
        eventId: e.id,
        title: e.title,
        anchors,
        next: nextItem(tl),
        remaining: tl.filter((i) => i.status !== "done").length,
        total: tl.length,
        staffCalls: staffCallsFor(e.id, e.event_date, data),
      });
    } else if (e.event_date > todayKey && e.event_date <= horizonKey && items.length === 0) {
      out.missing.push({ eventId: e.id, title: e.title, eventDate: e.event_date });
    }
  }
  return out;
}

/** Archived events are kept intact but excluded from operational workload views. */
export function isArchived(e: { archived_at?: string | null }): boolean {
  return !!e.archived_at;
}
export function activeOnly(data: TodayData): TodayData {
  return { ...data, events: data.events.filter((e) => !isArchived(e)) };
}
