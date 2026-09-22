import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/inbtwn/bits";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask INBTWN — INBTWN OS" },
      { name: "description", content: "Ask questions about your events, recipes, shopping, production and business." },
      { property: "og:title", content: "Ask INBTWN — INBTWN OS" },
      { property: "og:description", content: "Ask questions about your catering business." },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  return (
    <div>
      <PageTitle title="Ask INBTWN" aside="assistant" />
      <div className="torn bg-cream px-5 py-7">
        <div className="font-display text-[22px] leading-tight">
          Ask questions about your events, recipes, shopping, production and business.
        </div>
        <p className="mt-3 font-mono text-[12px] text-ink-soft">
          "How many portions of kimchi do I need on Saturday?" · "Which enquiries have gone quiet?"
        </p>
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-2 rounded-sm border border-dashed border-ink/25 bg-cream/60 px-3 py-3 opacity-70">
          <span className="flex-1 font-mono text-[12px] text-ink-soft">Ask INBTWN anything…</span>
          <span className="label-mono rounded-sm bg-ink px-2 py-1 text-cream">Coming in a later build</span>
        </div>
      </div>
    </div>
  );
}
