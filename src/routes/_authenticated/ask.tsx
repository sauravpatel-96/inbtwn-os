import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageTitle } from "@/components/inbtwn/bits";
import { askInbtwn, getAskConversation, newAskConversation, type AskTurn } from "@/lib/ask.functions";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask INBTWN — INBTWN OS" },
      { name: "description", content: "Ask questions about your events, recipes, shopping, production and business." },
      { property: "og:title", content: "Ask INBTWN — INBTWN OS" },
      { property: "og:description", content: "Ask questions about your catering business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

const SUGGESTIONS = [
  "What needs my attention today?",
  "What's on this week?",
  "Who owes me money?",
  "Which enquiries have gone quiet?",
];

type Msg = AskTurn & { used?: string[]; failed?: boolean };

function InlineMarkdown({ text }: { text: string }) {
  const navigate = useNavigate();
  const parts: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((\/[^\s)]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) {
      parts.push(<strong key={`b${i++}`} className="font-semibold text-ink">{m[2]}</strong>);
    } else {
      const label = m[4] as string;
      const href = m[5] as string;
      parts.push(
        <button
          key={`l${i++}`}
          type="button"
          onClick={() => void navigate({ to: href } as never)}
          className="font-medium text-flame underline underline-offset-2"
        >
          {label}
        </button>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Allowlisted Markdown: paragraphs, line breaks, bullets, bold and safe in-app links. */
function AnswerText({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const blocks: Array<{ type: "paragraph" | "list"; lines: string[] }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const type = /^[-*]\s+/.test(trimmed) ? "list" : "paragraph";
    const previous = blocks.at(-1);
    if (previous?.type === type) previous.lines.push(trimmed);
    else blocks.push({ type, lines: [trimmed] });
  }

  return (
    <div className="space-y-2.5 text-[14px] leading-[1.55]">
      {blocks.map((block, blockIndex) => {
        if (block.type === "list") {
          return (
            <ul key={blockIndex} className="space-y-1 pl-4">
              {block.lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-disc pl-0.5 marker:text-flame">
                  <InlineMarkdown text={line.replace(/^[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <InlineMarkdown text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function AskPage() {
  const send = useServerFn(askInbtwn);
  const load = useServerFn(getAskConversation);
  const reset = useServerFn(newAskConversation);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    load()
      .then((r) => live && setMessages(r.messages))
      .catch(() => live && setError("Couldn't load your conversation."))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [load]);

  async function startNew() {
    if (sendingRef.current) return;
    try {
      await reset();
      setMessages([]);
      setError(null);
    } catch {
      setError("Couldn't start a new conversation.");
    }
  }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await send({ data: { question: q } });
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.answer, used: res.used }]);
      } else {
        setError(res.error ?? "The assistant is unavailable right now.");
      }
    } catch {
      setError("The assistant is unavailable right now. Everything else in INBTWN still works.");
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-190px)] flex-col">
      <PageTitle title="Ask INBTWN" aside="read only" />
      {messages.length > 0 && (
        <div className="-mt-2 mb-2 flex justify-end">
          <button type="button" onClick={() => void startNew()} disabled={busy} className="label-mono text-flame disabled:opacity-40">
            + New conversation
          </button>
        </div>
      )}

      {loaded && messages.length === 0 && (
        <div className="bg-cream px-5 py-6">
          <div className="font-display text-[22px] leading-tight">
            Ask about your events, money, recipes and prep.
          </div>
          <p className="mt-2 font-mono text-[12px] text-ink-soft">
            Answers come from your own data. Ask can read, never change anything.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="border border-ink/15 bg-paper px-3 py-2.5 text-left text-[13px]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 py-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] bg-ink px-3 py-2 text-[14px] text-cream">{m.content}</div>
            ) : (
              <div className="border-l-2 border-flame bg-cream px-3.5 py-3">
                <AnswerText text={m.content} />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="label-mono border-l-2 border-flame bg-cream/60 px-3 py-3 text-ink-soft" role="status">
            Reading your data<span className="motion-safe:animate-pulse">…</span>
          </div>
        )}
        {error && (
          <div className="border border-flame/40 bg-flame/5 px-3 py-3 text-[13px] text-ink">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 border-t border-ink/12 bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask INBTWN anything…"
            className="h-11 flex-1 border border-ink/20 bg-cream px-3 text-[14px] outline-none focus:border-ink"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="label-mono h-11 bg-ink px-4 text-cream disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
