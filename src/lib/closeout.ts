/**
 * Close-out — the admin/financial finishing state of a job.
 *
 * Operational status (Completed) says the catering happened.
 * Close-out (Open / Closed) says the paperwork is finished.
 * Everything here is derived from existing records: nothing is written,
 * settled, invented or inferred as paid.
 */
import { costSummary, invoiceTotals, invoicePaymentState, PAYMENT_STATE_LABELS } from "./finance";
import { fmtMoney } from "./format";
import type { EventDerived, TodayData } from "./today";

export type CloseoutCheck = { key: string; label: string; ok: boolean };

export type Closeout = {
  completed: boolean;
  closed: boolean;
  checks: CloseoutCheck[];
  /** Human wording for everything still unfinished. */
  warnings: string[];
  ready: boolean;
};

export const isClosed = (e: { closeout_state?: string | null }) => e.closeout_state === "closed";

export function buildCloseout(d: EventDerived, data: TodayData, today = new Date()): Closeout {
  const e = d.event;
  const currency = e.currency ?? "GBP";
  const money = (n: number) => fmtMoney(n, currency) ?? String(n);
  const checks: CloseoutCheck[] = [];
  const warnings: string[] = [];

  const completed = e.status === "completed";
  const add = (key: string, label: string, ok: boolean) => checks.push({ key, label, ok });
  const warn = (key: string, label: string) => {
    add(key, label, false);
    warnings.push(label);
  };

  add("completed", completed ? "Event completed" : "Event not marked completed", completed);
  if (!completed) warnings.push("The event has not been marked completed");

  /* ----- Money owed ----- */
  if (d.platform) {
    if (d.payoutReceived) {
      add("payout", "Platform payout received", true);
    } else if (d.expectedPayout !== null) {
      warn("payout", `${money(d.expectedPayout)} platform payout still awaited`);
    } else {
      warn("payout", "Platform payout amount not recorded");
    }
  } else {
    const outstanding = d.outstanding;
    if (outstanding === null) {
      warn("agreed", "No agreed value recorded");
    } else if (outstanding > 0.004) {
      warn("outstanding", `${money(outstanding)} outstanding`);
    } else {
      add("outstanding", "Balance settled", true);
    }
  }

  /* ----- Invoices ----- */
  const payments = data.payments.filter((p) => p.event_id === e.id);
  const invoices = data.invoices.filter((i) => i.event_id === e.id && i.status !== "cancelled");
  let invoiceIssues = 0;
  for (const inv of invoices) {
    const t = invoiceTotals(inv, payments, data.allocations);
    const state = invoicePaymentState(inv, t, today);
    if (state === "paid") continue;
    invoiceIssues += 1;
    warn(`invoice:${inv.id}`, `Invoice ${inv.invoice_number} ${PAYMENT_STATE_LABELS[state].toLowerCase()}`);
  }
  if (invoices.length > 0 && invoiceIssues === 0) add("invoices", "All invoices paid", true);

  /* ----- Job costs ----- */
  const costs = data.costs.filter((c) => c.event_id === e.id);
  const cs = costSummary(costs);
  if (costs.length === 0) {
    warn("costs", "No job costs recorded");
  } else if (!cs.actualComplete) {
    const missing = costs.filter((c) => c.actual_amount === null || c.actual_amount === "").length;
    warn("costs", `${missing} job ${missing === 1 ? "cost has" : "costs have"} no actual amount`);
  } else {
    add("costs", "Actual job costs recorded", true);
  }

  /* ----- Food costing ----- */
  if (d.menuCount > 0) {
    if (d.ingredientsMissingCost > 0) {
      warn(
        "food",
        `Food costing incomplete — ${d.ingredientsMissingCost} ${
          d.ingredientsMissingCost === 1 ? "ingredient has" : "ingredients have"
        } no cost`,
      );
    } else {
      add("food", "Food costing complete", true);
    }
  }

  return {
    completed,
    closed: isClosed(e),
    checks,
    warnings,
    ready: warnings.length === 0,
  };
}
