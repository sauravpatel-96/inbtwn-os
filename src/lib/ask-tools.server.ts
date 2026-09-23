/**
 * Ask INBTWN — read-only business data layer.
 *
 * Every capability here is SELECT-only and runs through the caller's own
 * authenticated Supabase client, so organisation RLS applies exactly as it does
 * in the UI. Deterministic figures come from the existing Today / Finance
 * helpers so Ask and the app can never disagree. No insert, update, delete or
 * raw SQL is exposed to the model.
 */
import { tool } from "ai";
import { z } from "zod";
import { addDays, format, parseISO, isValid } from "date-fns";
import {
  fetchTodayData,
  buildToday,
  upcomingEvents,
  opsSummary,
  moneySummary,
  deriveEvent,
  type TodayData,
  type EventDerived,
} from "./today";
import {
  buildSchedule,
  costSummary,
  financeTotals,
  invoiceTotals,
  invoicePaymentState,
  labelOf,
  maybeNum,
  profitability,
  round2,
  COST_CATEGORIES,
  PAYMENT_CATEGORIES,
  PAYMENT_METHODS,
} from "./finance";
import { statusLabel, sourceLabel } from "./constants";
import { clientDisplayName } from "./format";

type ReadClient = { from: (table: string) => any };

const eventLink = (id: string, section?: string) => (section ? `/events/${id}?s=${section}` : `/events/${id}`);

function iso(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function inRange(date: string | null, from: string | null, to: string | null) {
  if (!date) return from === null && to === null;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/** Loads the org-wide read once per Ask request and derives every event. */
export async function loadAskContext(client: ReadClient, today: Date) {
  const data: TodayData = await fetchTodayData(client);
  const { attention, derived } = buildToday(data, today);
  return { data, attention, derived };
}

export type AskContext = Awaited<ReturnType<typeof loadAskContext>>;

function eventSummary(d: EventDerived) {
  return {
    event_id: d.event.id,
    title: d.event.title,
    date: d.event.event_date,
    status: statusLabel(d.event.status),
    completed: d.event.status === "completed",
    closeout_state: d.closed ? "closed" : "open",
    needs_marking_completed: d.needsCompletion,
    source: sourceLabel(d.event.source),
    platform_booking: d.platform,
    guests: d.event.guest_count,
    guest_count_status: d.event.guest_count_status,
    venue: d.event.venue_name,
    client: clientDisplayName(d.event.client),
    days_away: d.daysAway,
    link: eventLink(d.event.id),
  };
}

function findEvent(ctx: AskContext, id: string): EventDerived | null {
  return ctx.derived.find((d) => d.event.id === id) ?? null;
}

function financeFor(ctx: AskContext, d: EventDerived, today: Date) {
  const id = d.event.id;
  const terms = ctx.data.terms.find((t) => t.event_id === id) ?? null;
  const payments = ctx.data.payments.filter((p) => p.event_id === id);
  const invoices = ctx.data.invoices.filter((i) => i.event_id === id);
  const costs = ctx.data.costs.filter((c) => c.event_id === id);
  const totals = financeTotals({ terms, agreedTotal: d.agreed, payments, platform: d.platform });
  const schedule = buildSchedule({
    terms,
    agreedTotal: d.agreed,
    eventDate: d.event.event_date,
    payments,
    today,
  });
  const cs = costSummary(costs);
  const revenue = d.platform ? totals.revenue : d.agreed;
  const prof = profitability(revenue, cs.actual);
  const estProf = profitability(revenue, cs.estimated);

  return {
    event_id: id,
    title: d.event.title,
    platform_booking: d.platform,
    budget: maybeNum(d.event.budget),
    budget_note: "Budget is what the client may be willing to spend — it is never agreed revenue.",
    agreed_value: d.agreed,
    agreed_value_source: d.agreedSource,
    quote_status: d.quote?.status ?? null,
    quote_value: d.quoteTotal,
    quote_note: d.platform
      ? "A platform (Togather/Poptop) client-facing quote is not INBTWN revenue. Use the expected/actual payout."
      : "A quote is a commercial offer, not money received.",
    expected_payout: maybeNum(terms?.expected_payout),
    actual_payout: maybeNum(terms?.actual_payout),
    expected_payout_date: terms?.expected_payout_date ?? null,
    payout_status: terms?.payout_status ?? null,
    revenue,
    revenue_provisional: totals.revenueProvisional,
    received: totals.received,
    outstanding: totals.outstanding,
    overdue: Math.max(d.scheduleOverdue, d.invoiceOverdue),
    overdue_note:
      "A schedule obligation and its invoice are the same money — overdue is already deduplicated, never add them.",
    schedule: schedule.map((l) => ({
      line: l.label,
      required: l.required,
      received: l.received,
      outstanding: l.outstanding,
      due_date: l.dueDate,
      status: l.status,
    })),
    invoices: invoices.map((inv) => {
      const t = invoiceTotals(inv, payments, ctx.data.allocations);
      return {
        invoice_number: inv.invoice_number,
        kind: inv.kind,
        document_status: inv.status,
        payment_state: invoicePaymentState(inv, t, today),
        total: t.total,
        paid: t.paid,
        outstanding: t.outstanding,
        due_date: inv.due_date,
      };
    }),
    invoice_note: "An invoice is an amount requested. Only payment records prove money received.",
    payments: payments.map((p) => ({
      date: p.payment_date,
      amount: maybeNum(p.amount),
      category: labelOf(PAYMENT_CATEGORIES, p.category),
      method: labelOf(PAYMENT_METHODS, p.method),
      status: p.status,
      reference: p.reference,
    })),
    costs: costs.map((c) => ({
      category: labelOf(COST_CATEGORIES, c.category),
      description: c.description,
      estimated: maybeNum(c.estimated_amount),
      actual: maybeNum(c.actual_amount),
    })),
    costs_estimated_total: cs.estimated,
    costs_actual_total: cs.actual,
    costs_actual_complete: cs.actualComplete,
    food_costing_complete: d.ingredientsMissingCost === 0,
    ingredients_missing_cost: d.ingredientsMissingCost,
    profit_on_actual_costs: prof.profit,
    margin_on_actual_costs: prof.margin,
    profit_on_estimated_costs: estProf.profit,
    margin_on_estimated_costs: estProf.margin,
    profit_note:
      "Profit is only as complete as the recorded costs. If costs_actual_complete is false or ingredients_missing_cost > 0, say the picture is incomplete.",
    link: eventLink(id, "finance"),
  };
}

/** Builds the read-only tool set the model may call. */
export function buildAskTools(ctx: AskContext, today: Date, client: ReadClient) {
  const log: string[] = [];
  const mark = <T>(name: string, value: T): T => {
    log.push(name);
    return value;
  };

  const tools = {
    get_today_summary: tool({
      description:
        "Everything the Today screen shows: attention items, money summary, next-7-day operations and upcoming events. Use for 'what needs my attention', 'what's today', 'what's coming up'.",
      inputSchema: z.object({}),
      execute: async () =>
        mark("get_today_summary", {
          today: iso(today),
          attention: ctx.attention.map((a) => ({
            event: a.eventTitle,
            message: a.message,
            severity: a.severity,
            link: eventLink(a.eventId, a.section),
          })),
          money: moneySummary(ctx.derived, today),
          operations_next_7_days: opsSummary(ctx.derived),
          upcoming_7_days: upcomingEvents(ctx.derived).map(eventSummary),
        }),
    }),

    search_events: tool({
      description:
        "Find events by free text, status and/or date range. Dates are ISO yyyy-mm-dd and are applied server-side, so always compute explicit ranges from today's date.",
      inputSchema: z.object({
        query: z.string().nullable().describe("Free text matched against title, client and venue"),
        status: z.string().nullable().describe("Event status key e.g. confirmed, enquiry, completed"),
        from: z.string().nullable().describe("Inclusive start date yyyy-mm-dd"),
        to: z.string().nullable().describe("Inclusive end date yyyy-mm-dd"),
        limit: z.number().int().min(1).max(30).nullable(),
      }),
      execute: async ({ query, status, from, to, limit }) => {
        const q = (query ?? "").trim().toLowerCase();
        const rows = ctx.derived
          .filter((d) => {
            if (status && d.event.status !== status) return false;
            if ((from || to) && !inRange(d.event.event_date, from, to)) return false;
            if (!q) return true;
            const hay = [d.event.title, d.event.venue_name, clientDisplayName(d.event.client)]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          })
          .slice(0, limit ?? 15)
          .map(eventSummary);
        return mark("search_events", { today: iso(today), count: rows.length, events: rows });
      },
    }),

    get_event_details: tool({
      description:
        "Full non-financial detail for one event: schedule times, venue, client, guests, dietaries and the operational menu.",
      inputSchema: z.object({ event_id: z.string() }),
      execute: async ({ event_id }) => {
        const d = findEvent(ctx, event_id);
        if (!d) return mark("get_event_details", { error: "No such event is accessible." });
        const dietaries = await client
          .from("event_dietaries")
          .select("type, guest_count, severity, confirmed, notes")
          .eq("event_id", event_id);
        const menu = ctx.data.menu.filter((m) => m.event_id === event_id);
        return mark("get_event_details", {
          ...eventSummary(d),
          arrival_time: d.event.arrival_time,
          service_time: d.event.service_time,
          end_time: d.event.end_time,
          event_type: d.event.event_type,
          cuisine: d.event.cuisine,
          service_style: d.event.service_style,
          venue_address: d.event.venue_address,
          internal_notes: d.event.internal_notes,
          dietaries: dietaries.data ?? [],
          operational_menu: menu.map((m) => ({
            dish: m.recipe?.name ?? "Unnamed dish",
            recipe_linked: !!(m.recipe_version_id ?? m.recipe?.active_version_id),
          })),
          menu_note:
            "Only the operational Menu drives production. Proposal dishes may be free text and do not drive production.",
          links: {
            event: eventLink(event_id),
            menu: eventLink(event_id, "menu"),
            finance: eventLink(event_id, "finance"),
          },
        });
      },
    }),

    get_event_finance: tool({
      description:
        "Money for one event: agreed value and its source, payment schedule, invoices, payments, costs and profitability. Use for deposits, balances, invoices, payouts and profit questions.",
      inputSchema: z.object({ event_id: z.string() }),
      execute: async ({ event_id }) => {
        const d = findEvent(ctx, event_id);
        if (!d) return mark("get_event_finance", { error: "No such event is accessible." });
        return mark("get_event_finance", financeFor(ctx, d, today));
      },
    }),

    get_event_operations: tool({
      description:
        "Operational readiness for one event: menu size, dishes missing recipes, ingredients without cost, shopping remaining and packing remaining.",
      inputSchema: z.object({ event_id: z.string() }),
      execute: async ({ event_id }) => {
        const d = findEvent(ctx, event_id);
        if (!d) return mark("get_event_operations", { error: "No such event is accessible." });
        return mark("get_event_operations", {
          event_id,
          title: d.event.title,
          date: d.event.event_date,
          guests: d.event.guest_count,
          menu_items: d.menuCount,
          dishes_missing_recipes: d.dishesNeedingRecipes,
          ingredients_missing_cost: d.ingredientsMissingCost,
          shopping_items_remaining: d.shoppingRemaining,
          packing_items_remaining: d.packingRemaining,
          links: {
            menu: eventLink(event_id, "menu"),
            production: eventLink(event_id, "production"),
            shopping: eventLink(event_id, "shopping"),
            packing: eventLink(event_id, "packing"),
          },
        });
      },
    }),

    get_outstanding_payments: tool({
      description:
        "Who owes money across all direct (non-platform) events: outstanding and overdue amounts, already deduplicated between payment schedule and invoices.",
      inputSchema: z.object({
        overdue_only: z.boolean().nullable(),
      }),
      execute: async ({ overdue_only }) => {
        const rows = ctx.derived
          .filter((d) => !d.platform)
          .map((d) => ({
            event_id: d.event.id,
            title: d.event.title,
            client: clientDisplayName(d.event.client),
            date: d.event.event_date,
            agreed_value: d.agreed,
            outstanding: d.outstanding,
            overdue: Math.max(d.scheduleOverdue, d.invoiceOverdue),
            link: eventLink(d.event.id, "finance"),
          }))
          .filter((r) => (overdue_only ? r.overdue > 0 : (r.outstanding ?? 0) > 0 || r.overdue > 0));
        const m = moneySummary(ctx.derived, today);
        return mark("get_outstanding_payments", {
          events: rows,
          total_outstanding: m.outstanding,
          total_overdue: m.overdue,
          some_bookings_have_no_agreed_value: m.outstandingIncomplete,
          note: "Outstanding and overdue are already deduplicated across schedule and invoices — never sum them together.",
        });
      },
    }),

    get_platform_payouts: tool({
      description:
        "Togather/Poptop bookings and their INBTWN payouts. The client-facing quote is not revenue; an unrecorded payout amount is unknown.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = ctx.derived
          .filter((d) => d.platform)
          .map((d) => {
            const terms = ctx.data.terms.find((t) => t.event_id === d.event.id) ?? null;
            return {
              event_id: d.event.id,
              title: d.event.title,
              date: d.event.event_date,
              client_facing_quote: d.quoteTotal,
              expected_payout: maybeNum(terms?.expected_payout),
              actual_payout: maybeNum(terms?.actual_payout),
              expected_payout_date: terms?.expected_payout_date ?? null,
              payout_status: terms?.payout_status ?? null,
              payout_overdue: d.payoutOverdue,
              link: eventLink(d.event.id, "finance"),
            };
          });
        return mark("get_platform_payouts", {
          payouts: rows,
          note: "If expected_payout and actual_payout are both null the payout amount has not been recorded — say it is unknown, never quote the client-facing amount.",
        });
      },
    }),

    get_job_profitability: tool({
      description:
        "Revenue, recorded costs, profit and margin across events, with completeness flags. Optionally filter by date range.",
      inputSchema: z.object({
        from: z.string().nullable(),
        to: z.string().nullable(),
        limit: z.number().int().min(1).max(20).nullable(),
      }),
      execute: async ({ from, to, limit }) => {
        const rows = ctx.derived
          .filter((d) => (from || to ? inRange(d.event.event_date, from, to) : true))
          .slice(0, limit ?? 12)
          .map((d) => {
            const f = financeFor(ctx, d, today);
            return {
              event_id: d.event.id,
              title: d.event.title,
              date: d.event.event_date,
              revenue: f.revenue,
              revenue_provisional: f.revenue_provisional,
              costs_actual_total: f.costs_actual_total,
              costs_estimated_total: f.costs_estimated_total,
              costs_actual_complete: f.costs_actual_complete,
              ingredients_missing_cost: f.ingredients_missing_cost,
              profit_on_actual_costs: f.profit_on_actual_costs,
              margin_on_actual_costs: f.margin_on_actual_costs,
              link: f.link,
            };
          });
        return mark("get_job_profitability", { jobs: rows });
      },
    }),

    search_clients: tool({
      description: "Find clients by name, company or email, with their events.",
      inputSchema: z.object({ query: z.string().nullable(), limit: z.number().int().min(1).max(20).nullable() }),
      execute: async ({ query, limit }) => {
        const q = (query ?? "").trim().toLowerCase();
        const seen = new Map<string, { name: string; email: string | null; events: string[] }>();
        for (const d of ctx.derived) {
          const c = d.event.client;
          if (!c) continue;
          const name = clientDisplayName(c);
          if (q && !`${name} ${c.email ?? ""}`.toLowerCase().includes(q)) continue;
          const entry = seen.get(c.id) ?? { name, email: c.email ?? null, events: [] };
          entry.events.push(d.event.title);
          seen.set(c.id, entry);
        }
        return mark("search_clients", {
          clients: [...seen.entries()]
            .slice(0, limit ?? 10)
            .map(([id, v]) => ({ client_id: id, ...v, link: `/library/clients/${id}` })),
        });
      },
    }),

    search_recipes: tool({
      description: "Search the Recipe Library by name, category or cuisine.",
      inputSchema: z.object({ query: z.string().nullable(), limit: z.number().int().min(1).max(20).nullable() }),
      execute: async ({ query, limit }) => {
        let req = client
          .from("recipes")
          .select("id, name, category, cuisine, active")
          .order("name")
          .limit(limit ?? 15);
        if (query && query.trim()) req = req.ilike("name", `%${query.trim()}%`);
        const res = await req;
        return mark("search_recipes", {
          recipes: (res.data ?? []).map((r: any) => ({ ...r, link: `/library/recipes/${r.id}` })),
        });
      },
    }),

    get_recipe_details: tool({
      description: "One recipe: category, active version yield and its ingredient list.",
      inputSchema: z.object({ recipe_id: z.string() }),
      execute: async ({ recipe_id }) => {
        const r = await client
          .from("recipes")
          .select(
            "id, name, category, cuisine, description, active_version_id, version:recipe_versions!recipes_active_version_id_fkey(id, version_number, base_yield_quantity, base_yield_unit, default_portion_quantity, default_portion_unit)",
          )
          .eq("id", recipe_id)
          .maybeSingle();
        if (!r.data) return mark("get_recipe_details", { error: "No such recipe is accessible." });
        const versionId = r.data.active_version_id;
        const ings = versionId
          ? await client
              .from("recipe_ingredients")
              .select("quantity, unit, prep_note, ingredient:ingredients(name)")
              .eq("recipe_version_id", versionId)
              .order("sort_order")
          : { data: [] };
        return mark("get_recipe_details", {
          ...r.data,
          ingredients: (ings.data ?? []).map((i: any) => ({
            name: i.ingredient?.name ?? "Unknown",
            quantity: i.quantity,
            unit: i.unit,
            prep_note: i.prep_note,
          })),
          link: `/library/recipes/${recipe_id}`,
        });
      },
    }),
  };

  return { tools, log };
}

/** Deterministic date helpers exposed to the model in the system prompt. */
export function dateContext(today: Date) {
  return {
    today: iso(today),
    today_label: format(today, "EEE d MMM yyyy"),
    tomorrow: iso(addDays(today, 1)),
    in_7_days: iso(addDays(today, 7)),
    in_30_days: iso(addDays(today, 30)),
  };
}

export function parseDateSafe(s: string) {
  const d = parseISO(s);
  return isValid(d) ? d : new Date();
}

export const _round2 = round2;
