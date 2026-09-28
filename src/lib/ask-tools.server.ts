import { isReusable, kitCategoryLabel, kitLines, kitSummary, purchaseLabel } from "./kit";
import { computeAnchors, fmtClock, nextItem, ruleLabel, timeline } from "./runsheet";
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
import { loadCalcGraph } from "./recipe-queries";
import { scaleVersion, type ScaleResult } from "./recipe-calc";
import { collectPurchases } from "./shopping";
import { OPTION_SELECT, normalise, summariseCost, purchaseFromScratch, resolveOption, latestPrice, optionUnitCost, costReason } from "./costing";
import { buildCloseout } from "./closeout";
import { z } from "zod";
import { addDays, format, parseISO, isValid } from "date-fns";
import {
  fetchTodayData,
  buildToday,
  activeOnly,
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
import { calcShift, combinedCosts, labourTotals, shiftName, workTypeLabel } from "./staff";

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
  // `derived` covers every event (archived included) for historical questions;
  // `active` + `attention` exclude archived events for current-work questions.
  const { derived } = buildToday(data, today);
  const { attention, derived: active } = buildToday(activeOnly(data), today);
  return { data, attention, derived, active };
}

export type AskContext = Awaited<ReturnType<typeof loadAskContext>>;

function eventSummary(d: EventDerived) {
  return {
    event_id: d.event.id,
    title: d.event.title,
    date: d.event.event_date,
    status: statusLabel(d.event.status),
    archived: !!d.event.archived_at,
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
  const shifts = ctx.data.shifts.filter((sh) => sh.event_id === id);
  const cs = combinedCosts(costs, shifts);
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
    staff_labour: cs.usesStaff
      ? {
          source: "From Staff shifts",
          estimated: cs.labour.estimated,
          actual_recorded: cs.labour.actual,
          actual_complete: cs.labour.actualComplete,
          shifts_without_actual_hours: cs.labour.actualMissing,
          unpaid_to_staff: cs.labour.unpaid,
        }
      : null,
    staff_labour_note:
      "When staff_labour is present it is already included in the cost totals, and manual 'Staff' job costs are NOT counted (replaced by Staff shifts). Never add them together.",
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
          money: moneySummary(ctx.active, today),
          operations_next_7_days: opsSummary(ctx.active),
          upcoming_7_days: upcomingEvents(ctx.active).map(eventSummary),
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
        const m = moneySummary(ctx.active, today);
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

    get_closeout: tool({
      description:
        "Close-out state of jobs: whether the catering happened (completed) and whether the admin/financial record is finished (closed), with the real outstanding items. Use for questions like 'which jobs still need closing', 'is X finished', 'what is left to do for X', 'which completed jobs still owe me money' or 'which completed events have incomplete costs'.",
      inputSchema: z.object({
        event_id: z.string().nullable().describe("One specific event, or null for all jobs needing close-out."),
      }),
      execute: async ({ event_id }) => {
        const list = event_id
          ? ctx.derived.filter((d) => d.event.id === event_id)
          : ctx.active.filter((d) => d.event.status === "completed" && !d.closed);
        return mark("get_closeout", {
          jobs: list.map((d) => {
            const co = buildCloseout(d, ctx.data, today);
            return {
              event_id: d.event.id,
              title: d.event.title,
              date: d.event.event_date,
              completed: co.completed,
              closeout_state: co.closed ? "closed" : "open",
              ready_to_close: co.ready,
              outstanding_items: co.warnings,
              link: eventLink(d.event.id),
            };
          }),
        });
      },
    }),


    get_run_sheet: tool({
      description:
        "Event-day run sheet for one event or events on a date: service, arrival and departure times (derived: arrival = service - arrival lead; departure = arrival - travel - travel buffer), travel and buffer minutes, and each run-sheet item with calculated clock time, rule (anchor + offset or fixed), duration, assignment and status, plus the next incomplete item. Use for 'what time do I leave', 'what time do I arrive', 'run sheet for Saturday', 'what's next', 'what do I do before leaving' (items before departure), 'what happens after I arrive' (items at/after arrival). Read-only: edit on Event > Plan > Event day.",
      inputSchema: z.object({
        event_id: z.string().nullable().describe("One event id, or null to use date"),
        date: z.string().nullable().describe("Event date yyyy-mm-dd when event_id is null; null = today and upcoming 7 days"),
      }),
      execute: async ({ event_id, date }) => {
        const from = iso(today);
        const to = iso(addDays(today, 7));
        const events = (event_id ? ctx.derived : ctx.active)
          .filter((d) => (event_id ? d.event.id === event_id : date ? d.event.event_date === date : inRange(d.event.event_date, from, to)))
          .filter((d) => !["cancelled", "lost"].includes(d.event.status));
        return mark("get_run_sheet", {
          events: events.map((d) => {
            const e = d.event;
            const a = computeAnchors(e);
            const tl = timeline(ctx.data.runSheet.filter((r) => r.event_id === e.id), a);
            const nx = nextItem(tl);
            return {
              event: e.title,
              event_id: e.id,
              event_date: e.event_date,
              service_time: a.service != null ? fmtClock(a.service) : null,
              arrival_time: a.arrival != null ? fmtClock(a.arrival) : null,
              departure_time: a.departure != null ? fmtClock(a.departure) : null,
              arrival_lead_minutes: e.arrival_lead_minutes,
              travel_minutes: e.travel_minutes,
              travel_buffer_minutes: e.travel_buffer_minutes,
              generated: tl.length > 0,
              next: nx ? { time: fmtClock(nx.time), name: nx.name } : null,
              items: tl.map((i) => ({
                time: i.time != null ? fmtClock(i.time) : null,
                end: i.end != null ? fmtClock(i.end) : null,
                name: i.name,
                rule: ruleLabel(i),
                anchor: i.anchor_type,
                duration_minutes: i.duration_minutes,
                assignment: i.assignment,
                status: i.status,
                source: i.source,
              })),
              link: eventLink(e.id, "plan"),
            };
          }),
          note: "Times are derived from the event's service time, arrival lead, travel and buffer. Read-only; edit on Event > Plan > Event day.",
        });
      },
    }),
    get_staff: tool({
      description:
        "Staff & labour: the casual staff directory and event shifts. Each shift has who (Me/owner, a named staff member, or an unassigned role still needed), work type (Prep/Event/Other), date, planned start/finish/break, planned paid hours, hourly rate, estimated cost, optional actual start/finish/break, actual hours and actual cost, and Paid/Unpaid. Use for 'who is working X', 'what time is Sam starting', 'how much will staff cost', 'what did I actually spend on staff', 'who haven't I paid', 'do I still need anyone'. Owner (Me) shifts never cost anything and are never owed wages. Read-only: shifts are edited on the event's Staff tab.",
      inputSchema: z.object({
        event_id: z.string().nullable().describe("One event id, or null"),
        from: z.string().nullable().describe("Inclusive shift/event date yyyy-mm-dd"),
        to: z.string().nullable().describe("Inclusive shift/event date yyyy-mm-dd"),
        unpaid_only: z.boolean().nullable(),
      }),
      execute: async ({ event_id, from, to, unpaid_only }) => {
        const byEvent = new Map((event_id ? ctx.derived : ctx.active).map((d) => [d.event.id, d]));
        const shifts = ctx.data.shifts
          .filter((sh) => byEvent.has(sh.event_id))
          .filter((sh) => (event_id ? sh.event_id === event_id : true))
          .filter((sh) => (from || to ? inRange(sh.shift_date ?? byEvent.get(sh.event_id)!.event.event_date, from, to) : true))
          .filter((sh) => (unpaid_only ? !sh.is_owner && !!sh.staff_member_id && sh.payment_status !== "paid" : true));
        const eventIds = [...new Set(shifts.map((s) => s.event_id))];
        return mark("get_staff", {
          directory: ctx.data.staff.map((m) => ({ name: m.name, default_hourly_rate: maybeNum(m.default_hourly_rate), active: m.active, phone: m.phone, email: m.email })),
          events: eventIds.map((eid) => {
            const d = byEvent.get(eid)!;
            const list = shifts.filter((s) => s.event_id === eid);
            const lt = labourTotals(ctx.data.shifts.filter((s) => s.event_id === eid));
            return {
              event: d.event.title,
              event_id: eid,
              event_date: d.event.event_date,
              estimated_labour: lt.estimated,
              actual_labour_recorded: lt.actual,
              actual_complete: lt.actualComplete,
              shifts_without_actual_hours: lt.actualMissing,
              unpaid_to_staff: lt.unpaid,
              still_needed: lt.unassigned,
              shifts: list.map((sh) => {
                const c = calcShift(sh);
                const r2 = (n: number | null) => (n == null ? null : round2(n));
                return {
                  who: sh.is_owner ? "Me (owner)" : shiftName(sh, ctx.data.staff),
                  role: sh.role_label,
                  assigned: sh.is_owner || !!sh.staff_member_id,
                  owner: sh.is_owner,
                  work_type: workTypeLabel(sh.work_type),
                  date: sh.shift_date,
                  start: sh.start_time?.slice(0, 5) ?? null,
                  finish: sh.end_time?.slice(0, 5) ?? null,
                  unpaid_break_minutes: sh.break_minutes,
                  planned_hours: c.plannedHours,
                  hourly_rate: sh.is_owner ? 0 : maybeNum(sh.hourly_rate),
                  estimated_cost: sh.is_owner ? 0 : r2(c.plannedCost),
                  actual_start: sh.actual_start_time?.slice(0, 5) ?? null,
                  actual_finish: sh.actual_end_time?.slice(0, 5) ?? null,
                  actual_hours: c.actualHours,
                  actual_cost: sh.is_owner ? null : r2(c.actualCost),
                  payment: sh.is_owner ? "n/a (owner)" : !sh.staff_member_id ? "n/a (unassigned)" : sh.payment_status,
                  paid_at: sh.paid_at,
                };
              }),
              link: eventLink(eid, "staff"),
            };
          }),
          note: "Estimated and actual are separate: never present estimated cost as actual. If actual hours are missing say so. Read-only; changes happen on Event > Staff.",
        });
      },
    }),
    get_event_kit: tool({
      description:
        "Event Kit: equipment, reusable serveware and consumables. Returns the kit library (owned quantities for reusable items, per-guest rules for consumables) and each event's kit list: required quantity, owned, how many to buy (reusable shortage = required - owned; consumables only when purchase status is Need to buy), consumable purchase status (Need to buy / Have enough / Bought), packed quantity and whether fully packed, and for reusable items packed-out vs returned and missing. Use for 'what equipment do I need for X', 'do I need to buy anything', 'have I packed everything', 'how many buffet units do I own', 'what's missing', 'what hasn't come back'. Consumables never return. No hire. Read-only: changes happen on Event > Kit & more, Packing, or Library > Event Kit.",
      inputSchema: z.object({
        event_id: z.string().nullable().describe("One event id, or null for library / all events"),
        from: z.string().nullable().describe("Inclusive event date yyyy-mm-dd"),
        to: z.string().nullable().describe("Inclusive event date yyyy-mm-dd"),
      }),
      execute: async ({ event_id, from, to }) => {
        const byEvent = new Map((event_id ? ctx.derived : ctx.active).map((d) => [d.event.id, d]));
        const eventIds = [...new Set(ctx.data.eventKit.map((r) => r.event_id))]
          .filter((id) => byEvent.has(id))
          .filter((id) => (event_id ? id === event_id : true))
          .filter((id) => (from || to ? inRange(byEvent.get(id)!.event.event_date, from, to) : true));
        return mark("get_event_kit", {
          library: ctx.data.kitItems
            .filter((i) => i.active)
            .map((i) => ({
              name: i.name,
              category: kitCategoryLabel(i.category),
              owned: isReusable(i.category) ? (i.owned_quantity ?? 0) : null,
              per_guest: i.per_guest == null ? null : Number(i.per_guest),
            })),
          library_link: "/library/kit",
          events: eventIds.map((eid) => {
            const e = byEvent.get(eid)!.event;
            const lines = kitLines(ctx.data.eventKit.filter((r) => r.event_id === eid), ctx.data.kitItems, e.guest_count ?? 0);
            const k = kitSummary(lines);
            return {
              event: e.title,
              event_id: eid,
              event_date: e.event_date,
              guests: e.guest_count,
              summary: {
                items: k.total,
                still_to_buy: k.toBuy,
                not_fully_packed: k.notPacked,
                reusable_awaiting_return_check: k.returnPending,
                missing_after_return: k.missing,
              },
              items: lines.map((l) => ({
                name: l.item.name,
                category: kitCategoryLabel(l.category),
                required: l.required,
                owned: l.owned,
                to_buy: l.toBuy,
                status: l.reusable ? (l.toBuy > 0 ? `Buy ${l.toBuy}` : "Ready") : purchaseLabel(l.row.purchase_status),
                packed: `${l.packed}/${l.required}`,
                fully_packed: l.packedComplete,
                returned: l.reusable ? l.returned : "n/a (consumable)",
                missing: l.reusable ? l.missing : null,
                notes: l.row.notes,
              })),
              kit_link: eventLink(eid, "more"),
              packing_link: eventLink(eid, "packing"),
            };
          }),
          note: "Read-only. Never change owned quantities, packed or returned counts, or purchase statuses — direct the user to the kit/packing link.",
        });
      },
    }),
    get_food_costing: tool({
      description:
        "Food costing (read-only). Three SEPARATE figures — never add them together or confuse them: (A) ingredient usage cost from recipes = what the ingredients actually used cost; (B) purchase cost from scratch = cash needed buying whole packs with no stock on hand; (C) actual food purchases = receipts recorded for the event. Pass event_id for an event (A, B, C, food cost % of agreed revenue only when costing is complete), recipe_id for recipe batch/portion cost with component roll-up, or ingredient_name to look up purchase options, suppliers, latest prices, purchase unit cost and yield-adjusted usable cost. Incomplete costing must be described as 'known' cost with the missing ingredients listed.",
      inputSchema: z.object({
        event_id: z.string().nullable(),
        recipe_id: z.string().nullable(),
        ingredient_name: z.string().nullable(),
      }),
      execute: async ({ event_id, recipe_id, ingredient_name }) => {
        const [graph, optsRes, statusRes] = await Promise.all([
          loadCalcGraph(client),
          client.from("ingredient_purchase_options").select(OPTION_SELECT),
          client.from("ingredients").select("id, name, base_unit, yield_percentage, current_unit_cost, cost_status, cost_source"),
        ]);
        const options = normalise(optsRes.data ?? []);
        const status: Record<string, any> = Object.fromEntries((statusRes.data ?? []).map((r: any) => [r.id, r]));
        const out: Record<string, unknown> = {};
        if (ingredient_name) {
          const q = ingredient_name.toLowerCase();
          out["ingredients"] = (statusRes.data ?? [])
            .filter((i: any) => i.name.toLowerCase().includes(q))
            .slice(0, 5)
            .map((i: any) => {
              const opts = options.filter((o) => o.ingredient_id === i.id && o.active);
              const chosen = resolveOption(opts);
              const unit = i.current_unit_cost == null ? null : Number(i.current_unit_cost);
              const y = Number(i.yield_percentage);
              return {
                name: i.name,
                cost_status: i.cost_status === "ok" || unit != null ? "costed" : costReason(i.cost_status),
                purchase_unit_cost_per_base_unit: unit,
                usable_cost_per_base_unit: unit == null || !(y > 0) ? null : unit / (y / 100),
                base_unit: i.base_unit,
                usable_yield_percentage: y,
                options: opts.map((o) => ({
                  supplier: o.supplier?.name,
                  pack: `${o.pack_quantity} ${o.pack_unit}`,
                  preferred: o.is_preferred,
                  used_for_costing: chosen?.id === o.id,
                  latest_price: latestPrice(o)?.pack_price ?? null,
                  price_date: latestPrice(o)?.effective_date ?? null,
                  unit_cost: optionUnitCost(o, i.base_unit),
                  test_price: o.is_test,
                })),
                link: `/library/ingredients/${i.id}`,
              };
            });
        }
        if (recipe_id) {
          const r = await client.from("recipes").select("id, name, active_version_id").eq("id", recipe_id).maybeSingle();
          const v = r.data?.active_version_id ? graph.versions[r.data.active_version_id] : null;
          if (v) {
            try {
              const res = scaleVersion(v.id, v.base_yield_quantity, graph);
              const s = summariseCost([res], status);
              const portion = v.default_portion_quantity;
              out["recipe"] = {
                name: v.recipe_name,
                costing_complete: s.complete,
                ingredients_costed: `${s.costedCount} of ${s.ingredientCount}`,
                batch_cost: res.cost,
                batch_yield: `${v.base_yield_quantity}${v.base_yield_unit}`,
                cost_per_portion: portion ? (res.cost / res.baseYield) * portion : null,
                components: res.components.map((c) => ({ name: c.name, cost: c.result.cost, complete: c.result.missingCost.length === 0 })),
                missing: s.missing,
                link: `/library/recipes/${recipe_id}`,
              };
            } catch (e) {
              out["recipe"] = { error: (e as Error).message };
            }
          } else out["recipe"] = { error: "Recipe has no active version or is not accessible." };
        }
        if (event_id) {
          const d = findEvent(ctx, event_id);
          if (!d) return mark("get_food_costing", { error: "No such event is accessible." });
          const [menu, bufs, buys] = await Promise.all([
            client.from("event_menu_items").select("recipe_version_id, quantity_per_guest, recipe:recipes(active_version_id)").eq("event_id", event_id),
            client.from("recipe_versions").select("id, default_buffer_percentage"),
            client.from("event_food_purchases").select("amount, purchase_date, notes, is_test, supplier:suppliers(name)").eq("event_id", event_id),
          ]);
          const buffer: Record<string, number> = Object.fromEntries((bufs.data ?? []).map((b: any) => [b.id, Number(b.default_buffer_percentage ?? 0)]));
          const guests = d.event.guest_count ?? 0;
          const results: ScaleResult[] = [];
          for (const m of menu.data ?? []) {
            const vid = m.recipe_version_id ?? m.recipe?.active_version_id;
            const pg = Number(m.quantity_per_guest ?? 0);
            if (!vid || guests <= 0 || pg <= 0) continue;
            try {
              results.push(scaleVersion(vid, guests * pg * (1 + (buffer[vid] ?? 0) / 100), graph));
            } catch {
              /* skip */
            }
          }
          const s = summariseCost(results, status);
          const lines = new Map();
          for (const r of results) collectPurchases(r, lines);
          const scratch = purchaseFromScratch([...lines.values()], options);
          const fin = financeFor(ctx, d, today) as any;
          const revenue = fin?.revenue ?? null;
          const purchases = (buys.data ?? []).map((b: any) => ({ supplier: b.supplier?.name ?? null, date: b.purchase_date, amount: Number(b.amount), notes: b.notes, test: b.is_test }));
          out["event"] = {
            title: d.event.title,
            guests,
            A_ingredient_usage_cost: { amount: s.known, complete: s.complete, ingredients_costed: `${s.costedCount} of ${s.ingredientCount}`, missing: s.missing },
            B_purchase_cost_from_scratch: { amount: scratch.total, complete: scratch.complete, packs: scratch.priced.map((p) => ({ name: p.name, packs: p.packs, pack: p.packLabel, supplier: p.supplier, cost: p.cost })), no_pack_price: scratch.unavailable.map((u) => u.name) },
            C_actual_food_purchases: { total: purchases.reduce((a: number, p: any) => a + p.amount, 0), purchases },
            food_cost_percentage_of_revenue: s.complete && typeof revenue === "number" && revenue > 0 ? Math.round((s.known / revenue) * 1000) / 10 : null,
            links: { finance: eventLink(event_id, "finance"), shopping: eventLink(event_id, "shopping") },
          };
        }
        out["note"] = "Read-only. Prices, suppliers and purchases are changed in Library > Ingredients / Suppliers or Event > Finance.";
        return mark("get_food_costing", out);
      },
    }),
    get_prep_tasks: tool({
      description:
        "Prep plan tasks across events: name, scheduled date, status, assignment, approximate minutes, whether the task came from a recipe prep step or was added manually, and the event it belongs to. Use for 'what do I need to do today', 'what prep is on Friday', 'what is left for Y11 Banquet'. Only tasks for dishes on the current menu (plus manual tasks) are returned as current work; recorded prep for removed dishes is listed separately as no_longer_required. Read-only: tasks can only be changed on the event's Plan tab.",
      inputSchema: z.object({
        event_id: z.string().nullable().describe("Limit to one event, or null for all events"),
        from: z.string().nullable().describe("Inclusive start date yyyy-mm-dd"),
        to: z.string().nullable().describe("Inclusive end date yyyy-mm-dd"),
        outstanding_only: z.boolean().nullable().describe("Default true: exclude completed tasks"),
      }),
      execute: async ({ event_id, from, to, outstanding_only }) => {
        const byEvent = new Map((event_id ? ctx.derived : ctx.active).map((d) => [d.event.id, d]));
        const scoped = ctx.data.tasks.filter((t) => (event_id ? t.event_id === event_id : true));
        const rows = scoped
          .filter((t) => !t.orphaned)
          .filter((t) => (outstanding_only === false ? true : t.status !== "done"))
          .filter((t) => (from || to ? inRange(t.scheduled_date, from, to) : true))
          .filter((t) => byEvent.has(t.event_id))
          .map((t) => {
            const d = byEvent.get(t.event_id)!;
            return {
              task: t.name,
              event: d.event.title,
              event_id: t.event_id,
              event_date: d.event.event_date,
              event_status: statusLabel(d.event.status),
              scheduled_date: t.scheduled_date,
              overdue: !!t.scheduled_date && t.scheduled_date < iso(today) && t.status !== "done",
              status: t.status,
              assignment: t.assignment,
              approximate_minutes: t.approximate_minutes,
              source: t.source,
              link: eventLink(t.event_id, "plan"),
            };
          })
          .sort((a, b) => (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999"));
        const minutes = rows.reduce((s, r) => s + (r.approximate_minutes ?? 0), 0);
        return mark("get_prep_tasks", {
          today: iso(today),
          count: rows.length,
          total_approximate_minutes: minutes,
          tasks: rows,
          no_longer_required: scoped
            .filter((t) => t.orphaned && t.status !== "todo")
            .filter((t) => byEvent.has(t.event_id))
            .map((t) => ({
              task: t.name,
              dish: t.recipe_name,
              event: byEvent.get(t.event_id)!.event.title,
              status: t.status,
              link: eventLink(t.event_id, "plan"),
            })),
          note: "tasks = CURRENT required prep only. no_longer_required = recorded prep (done/in progress) for dishes since removed from the menu; mention it briefly if relevant, never as outstanding work. Prep tasks are scheduled work only. Completing one never changes production, shopping, packing, event status or finance. Tasks are edited on the event's Plan tab.",
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
