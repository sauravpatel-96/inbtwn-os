/**
 * Ask INBTWN — server-side assistant boundary.
 *
 * The model runs only here: the provider, the key and the tools never reach the
 * browser. Every tool is read-only and executes through the caller's own
 * authenticated Supabase client, so organisation RLS applies. The model can
 * never write, delete or run SQL, because no such tool exists.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Turn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const AskInput = z.object({
  messages: z.array(Turn).min(1).max(24),
});

export type AskTurn = z.infer<typeof Turn>;

export type AskResult = {
  ok: boolean;
  answer: string;
  used: string[];
  error: string | null;
};

const SYSTEM = (dates: Record<string, string>) => `
You are Ask INBTWN, the in-app assistant for INBTWN OS, an internal catering operations app.
You answer questions about this organisation's real events, clients, recipes, production, shopping, packing and finances.

TODAY'S DATES (use these, never guess):
${Object.entries(dates)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

HOW YOU WORK
- Always call tools to get facts. Never invent a number, name, date or status.
- Tools are strictly read-only. You cannot create, change, delete or send anything.
- If asked to change something (add a payment, confirm an event, mark an item bought, email a client),
  refuse briefly and tell the user which screen to do it on, with a link. Never pretend you did it.
- If the data does not answer the question, say plainly what is missing.

BUSINESS RULES YOU MUST RESPECT
- Budget is what a client might spend. It is never revenue and never an agreed value.
- An agreed value comes from an accepted quote or a manually set value. Without one, say the value is not agreed yet.
- Togather and Poptop bookings settle by payout. The client-facing quote is not INBTWN revenue.
  If no payout amount is recorded, the payout is unknown — say so.
- A quote is an offer; an invoice is a request; only a payment is money received.
- Outstanding and overdue figures from the tools are already deduplicated between schedule and invoices. Never add them together.
- Only the operational Menu drives production. Proposal dishes may be free text and do not.
- Prep tasks live on an event's Plan tab. They are scheduled work, not quantities: completing one never changes production,
  shopping, packing, event status or finance. For prep questions give the date, the task names and the approximate time
  when recorded, and say when something is overdue. If asked to move, rename, assign or complete a task, refuse briefly
  and point to that event's Plan tab.
- Run sheet: use get_run_sheet for leave/arrive/service times, event-day timelines and 'what's next'. Give clock times first (e.g. 'Leave at 11:45'). Before leaving = items before departure; after arriving = items at/after arrival. For run-sheet or prep questions, do not add unrelated finance/costing warnings. Requests to move or change run-sheet items or timings must be refused briefly and pointed to Event → Plan → Event day with the link.
- If costs are incomplete or ingredients have no cost, say the profit picture is incomplete.
- Completed and closed are different. Completed means the catering has taken place. Closed means the user has decided the
  financial and admin record for that job is finished. A completed job can still be open with money outstanding, overdue
  invoices, an awaited platform payout or incomplete costing. Never say a job is finished or closed unless the close-out
  state says closed, and always name what is still outstanding when it is open.

STYLE
- Direct and practical, like a good operations manager. Short sentences, UK English.
- Lead operational and financial answers with the event name, not the client. Do not say a person or company legally owes money unless the data explicitly establishes that.
- Money as £1,120 or £27.50: use commas, omit .00 for whole pounds, and keep meaningful pence. Dates as "Sat 24 Oct". Times as 18:30.
- Display percentages to one decimal place unless extra precision is essential. For example, write 87.1%, not 87.14%. This is display rounding only.
- Lead with the answer. Prefer one short sentence for simple questions. For several figures, use a short heading followed by compact lines or bullets. No preamble and no restating the question.
- Avoid repeating the same conclusion in a paragraph and a list. Usually keep answers below 90 words.
- For profitability, name revenue, recorded actual costs, profit on recorded costs and margin once, then give one concise warning when food or cost data is incomplete.
- For staff-spend questions, answer with the actual staff cost first and compare it with the estimate when useful.
- For platform bookings, say the payout amount is unknown when it is not recorded; never substitute the client-facing quote.
- For Today questions, report only the returned Today attention, money and next-seven-day operations. Never revive past shopping, packing or production issues.
- For write requests, briefly state the current fact when known, say "Ask INBTWN is read-only, so I can't [action] here", and offer the relevant returned link. Never imply the action happened.
- When a tool returns a link, offer it at the end as a markdown link, e.g. [View Finance](/events/abc?s=finance).
  Only use links returned by tools. Never invent a URL.
- Markdown is allowed only for **bold emphasis**, short bullet lists and returned in-app links. Do not output headings with #, tables, code blocks or HTML.
`;

export const askInbtwn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<AskResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return { ok: false, answer: "", used: [], error: "The assistant is not configured yet." };
    }

    const { loadAskContext, buildAskTools, dateContext } = await import("./ask-tools.server");
    const { streamText, stepCountIs } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");

    const today = new Date();
    const client = context.supabase as unknown as { from: (t: string) => any };

    try {
      const ctx = await loadAskContext(client, today);
      const { tools, log } = buildAskTools(ctx, today, client);

      const lovable = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey: key,
        headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });

      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM(dateContext(today)),
        messages: data.messages,
        tools,
        stopWhen: stepCountIs(24),
        onError: (e) => console.error("[ask] stream error", JSON.stringify(e).slice(0, 600)),
        providerOptions: {
          openai: {
            store: false,
            include: ["reasoning.encrypted_content"],
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
          },
        },
      });

      const answer = (await result.text).trim();
      return {
        ok: true,
        answer: answer || "I couldn't find anything to answer that.",
        used: [...new Set(log)],
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ask] failed", message);
      const rateLimited = /429|rate limit/i.test(message);
      const credits = /402|credit/i.test(message);
      return {
        ok: false,
        answer: "",
        used: [],
        error: credits
          ? "The assistant is out of AI credits. Add credits in workspace settings to keep using it."
          : rateLimited
            ? "Too many questions at once — try again in a moment."
            : "The assistant is unavailable right now. Everything else in INBTWN still works.",
      };
    }
  });
