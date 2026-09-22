import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, TextArea, PrimaryButton, GhostButton } from "@/components/inbtwn/bits";
import { fmtMoney, fmtDateLong } from "@/lib/format";
import { pricingQuery, proposalQuery } from "@/lib/commercial";
import {
  quoteQuery,
  quoteTotals,
  buildQuoteSnapshot,
  QUOTE_STATUSES,
  type Quote,
  type QuoteStatus,
} from "@/lib/quote";
import type { EventRow, ClientRow } from "@/lib/queries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mode = "edit" | "preview";

const MODE_KEY = "inbtwn.quote.mode";

export function EventQuote({ event }: { event: EventRow & { client: ClientRow | null } }) {
  const eventId = event.id;
  const qc = useQueryClient();
  const quoteQ = useQuery(quoteQuery(eventId));
  const pricing = useQuery(pricingQuery(eventId));
  const proposal = useQuery(proposalQuery(eventId));

  const [mode, setMode] = useState<Mode>("edit");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const quote = quoteQ.data ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MODE_KEY);
    if (saved === "preview" || saved === "edit") setMode(saved);
  }, []);

  const setModeAndRemember = (m: Mode) => {
    setMode(m);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, m);
  };

  const selected = (pricing.data ?? []).find((o) => o.is_selected) ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quote", eventId] });

  if (quoteQ.isLoading || pricing.isLoading) {
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  }

  if (!selected && !quote) {
    return (
      <div className="pb-8">
        <Header status={null} />
        <div className="mt-3 border border-ink/15 bg-cream px-4 py-6 text-center">
          <div className="font-display text-[20px] leading-none">No pricing option selected</div>
          <p className="mt-2 font-mono text-[11px] text-ink-soft">
            Pick the option the client is being quoted before preparing a quote.
          </p>
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            search={{ s: "pricing" }}
            replace
            className="tap mt-4 inline-flex border border-ink bg-ink px-4 py-2.5 font-mono text-[12px] text-cream"
          >
            Go to Pricing
          </Link>
        </div>
      </div>
    );
  }

  const create = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await buildQuoteSnapshot({ event, option: selected, proposal: proposal.data ?? [], existing: null });
      await invalidate();
      toast.success("Quote prepared");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  };

  const refresh = async () => {
    if (!selected || !quote) return;
    setBusy(true);
    try {
      await buildQuoteSnapshot({ event, option: selected, proposal: proposal.data ?? [], existing: quote });
      await invalidate();
      toast.success("Quote refreshed from proposal & pricing");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
    setRefreshing(false);
  };

  if (!quote) {
    return (
      <div className="pb-8">
        <Header status={null} />
        <div className="mt-3 border border-ink/15 bg-cream px-4 py-6 text-center">
          <div className="font-display text-[20px] leading-none">No quote prepared yet</div>
          <p className="mt-2 font-mono text-[11px] text-ink-soft">
            Build it from the event details, proposal and the selected pricing option.
          </p>
          <div className="mt-4">
            <PrimaryButton type="button" disabled={busy} onClick={create}>
              Prepare quote
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const patch = async (values: Partial<Quote>) => {
    const { error } = await supabase.from("event_quotes").update(values as never).eq("id", quote.id);
    if (error) return void toast.error(error.message);
    await invalidate();
  };

  const setStatus = async (status: QuoteStatus) => {
    const values: Record<string, unknown> = { status };
    if (status === "sent") values["sent_at"] = new Date().toISOString();
    if (status === "accepted") {
      values["accepted_at"] = new Date().toISOString();
      // Snapshot the agreed figure so later pricing changes never rewrite the agreement.
      values["agreed_total"] = quoteTotals(quote).total;
    }
    const { error } = await supabase.from("event_quotes").update(values as never).eq("id", quote.id);
    if (error) return void toast.error(error.message);
    if (status === "sent" && event.status === "enquiry") {
      const res = await supabase.from("events").update({ status: "quoting" }).eq("id", eventId);
      if (!res.error) {
        qc.invalidateQueries({ queryKey: ["events"] });
        toast.success("Quote sent — event moved to Quoted");
      }
    } else if (status === "accepted") {
      toast.success("Quote accepted — the agreed total is now locked");
    } else {
      toast.success(`Quote marked ${status}`);
    }
    qc.invalidateQueries({ queryKey: ["finance-terms", eventId] });
    await invalidate();
  };

  const totals = quoteTotals(quote);
  const money = (n: number) => fmtMoney(n, event.currency) ?? "—";
  const sent = quote.status === "sent" || quote.status === "accepted";

  return (
    <div className="pb-10">
      <Header status={quote.status as QuoteStatus} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModeAndRemember("edit")}
          className={`tap border px-3 py-2 font-mono text-[11px] ${mode === "edit" ? "border-ink bg-ink text-cream" : "border-ink/25 bg-cream"}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setModeAndRemember("preview")}
          className={`tap border px-3 py-2 font-mono text-[11px] ${mode === "preview" ? "border-ink bg-ink text-cream" : "border-ink/25 bg-cream"}`}
        >
          Preview
        </button>
      </div>

      {mode === "preview" ? (
        <QuotePreview quote={quote} money={money} />
      ) : (
        <QuoteEditor
          quote={quote}
          money={money}
          totals={totals}
          patch={patch}
          invalidate={invalidate}
          onRefresh={() => setRefreshing(true)}
          canRefresh={Boolean(selected) && !sent}
          sent={sent}
        />
      )}

      <div className="mt-6 border border-ink/15 bg-cream px-4 py-3">
        <div className="label-mono text-ink-soft">Quote status</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {QUOTE_STATUSES.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => setStatus(st.value)}
              className={`tap border px-3 py-2 font-mono text-[11px] ${
                quote.status === st.value ? "border-ink bg-ink text-cream" : "border-ink/25 bg-paper"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-ink-soft">
          Sending a quote does not confirm the event.
        </p>
      </div>

      <AlertDialog open={refreshing} onOpenChange={(o) => !o && setRefreshing(false)}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] font-normal">
              Refresh from proposal & pricing?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The quote menu, charges and pricing will be rebuilt from the current proposal and selected pricing option.
              Any quote-specific menu edits, hidden dishes and hidden charges will be replaced. Your introduction,
              what's included, notes and terms are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction className="bg-ink text-cream" onClick={refresh}>
              Refresh quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Header({ status }: { status: QuoteStatus | null }) {
  return (
    <div className="border border-ink/15 bg-cream px-4 py-4">
      <div className="font-display text-[26px] leading-none">QUOTE</div>
      <div className="mt-1.5 font-mono text-[12px] text-ink-soft">
        {status ? `Status: ${QUOTE_STATUSES.find((s) => s.value === status)?.label}` : "Client-facing quotation"}
      </div>
    </div>
  );
}

/* ---------- Edit mode ---------- */

function QuoteEditor({
  quote,
  money,
  totals,
  patch,
  invalidate,
  onRefresh,
  canRefresh,
  sent,
}: {
  quote: Quote;
  money: (n: number) => string;
  totals: ReturnType<typeof quoteTotals>;
  patch: (values: Partial<Quote>) => Promise<void>;
  invalidate: () => Promise<void> | void;
  onRefresh: () => void;
  canRefresh: boolean;
  sent: boolean;
}) {
  const [form, setForm] = useState({
    title: quote.title ?? "",
    client_name: quote.client_name ?? "",
    event_name: quote.event_name ?? "",
    event_date: quote.event_date ?? "",
    venue: quote.venue ?? "",
    guest_count: quote.guest_count != null ? String(quote.guest_count) : "",
    event_type: quote.event_type ?? "",
    cuisine: quote.cuisine ?? "",
    service_style: quote.service_style ?? "",
    introduction: quote.introduction ?? "",
    whats_included: quote.whats_included ?? "",
    client_notes: quote.client_notes ?? "",
    terms: quote.terms ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await patch({
      title: form.title.trim() || null,
      client_name: form.client_name.trim() || null,
      event_name: form.event_name.trim() || null,
      event_date: form.event_date || null,
      venue: form.venue.trim() || null,
      guest_count: form.guest_count.trim() ? Number(form.guest_count) : null,
      event_type: form.event_type.trim() || null,
      cuisine: form.cuisine.trim() || null,
      service_style: form.service_style.trim() || null,
      introduction: form.introduction.trim() || null,
      whats_included: form.whats_included.trim() || null,
      client_notes: form.client_notes.trim() || null,
      terms: form.terms.trim() || null,
    } as Partial<Quote>);
    setSaving(false);
    toast.success("Quote saved");
  };

  const toggleSection = async (id: string, included: boolean) => {
    const { error } = await supabase.from("event_quote_sections").update({ included }).eq("id", id);
    if (error) return void toast.error(error.message);
    await invalidate();
  };
  const toggleItem = async (id: string, visible: boolean) => {
    const { error } = await supabase.from("event_quote_items").update({ visible }).eq("id", id);
    if (error) return void toast.error(error.message);
    await invalidate();
  };
  const toggleCharge = async (id: string, show_on_quote: boolean) => {
    const { error } = await supabase.from("event_quote_charges").update({ show_on_quote }).eq("id", id);
    if (error) return void toast.error(error.message);
    await invalidate();
  };

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <div className="label-mono text-ink-soft">Quote details</div>
        <Field label="Quote title">
          <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Summer BBQ & Indian Buffet" />
        </Field>
        <Field label="Client">
          <TextInput value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
        </Field>
        <Field label="Event name">
          <TextInput value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          </Field>
          <Field label="Guests">
            <TextInput inputMode="numeric" value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: e.target.value })} />
          </Field>
        </div>
        <Field label="Location">
          <TextInput value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Event type">
            <TextInput value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
          </Field>
          <Field label="Cuisine">
            <TextInput value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} />
          </Field>
        </div>
        <Field label="Service style">
          <TextInput value={form.service_style} onChange={(e) => setForm({ ...form, service_style: e.target.value })} />
        </Field>
        <p className="font-mono text-[10px] text-ink-soft">
          These are client-facing only — the operational event record is unchanged.
        </p>
      </div>

      <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <div className="label-mono text-ink-soft">Introduction</div>
        <TextArea
          value={form.introduction}
          onChange={(e) => setForm({ ...form, introduction: e.target.value })}
          placeholder="Thank you for considering INBTWN Catering for your event."
        />
      </div>

      <div className="border border-ink/15 bg-cream">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <span className="label-mono text-ink-soft">Menu</span>
          {canRefresh ? (
            <button type="button" onClick={onRefresh} className="font-mono text-[11px] text-flame underline">
              Refresh from proposal & pricing
            </button>
          ) : null}
        </div>
        {quote.sections.length === 0 ? (
          <div className="px-4 py-4 font-mono text-[11px] text-ink-soft">No proposal sections on this quote.</div>
        ) : (
          quote.sections.map((s) => (
            <div key={s.id} className="border-b border-ink/10 px-4 py-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className={`font-display text-[18px] leading-none ${s.included ? "" : "text-ink-soft line-through"}`}>
                  {s.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleSection(s.id, !s.included)}
                  className={`tap shrink-0 border px-3 py-1.5 font-mono text-[10px] ${
                    s.included ? "border-ink bg-ink text-cream" : "border-ink/25 bg-paper text-ink-soft"
                  }`}
                >
                  {s.included ? "On quote" : "Excluded"}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {s.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleItem(it.id, !it.visible)}
                    className="flex w-full items-center justify-between gap-3 border-b border-ink/5 py-1.5 text-left"
                  >
                    <span className={`text-sm ${it.visible ? "" : "text-ink-soft line-through"}`}>{it.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-soft">{it.visible ? "Shown" : "Hidden"}</span>
                  </button>
                ))}
                {s.items.length === 0 ? <div className="font-mono text-[10px] text-ink-soft">No dishes</div> : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <div className="label-mono text-ink-soft">What's included</div>
        <TextArea
          value={form.whats_included}
          onChange={(e) => setForm({ ...form, whats_included: e.target.value })}
          placeholder={"All food listed above\nHeated buffet setup\nSetup and breakdown"}
        />
        <p className="font-mono text-[10px] text-ink-soft">One line per item.</p>
      </div>

      <div className="border border-ink/15 bg-cream">
        <div className="border-b border-ink/10 px-4 py-3 label-mono text-ink-soft">Pricing</div>
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5">
            <span className="font-mono text-[11px] text-ink-soft">
              {totals.guests} guests × {money(totals.perHead)} per person
            </span>
            <span className="font-medium">{money(totals.cateringTotal)}</span>
          </div>
          {quote.charges.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border-b border-ink/10 py-1.5">
              <span className="min-w-0 break-words font-mono text-[11px] text-ink-soft">{c.description}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-medium">{money(Number(c.amount))}</span>
                <button
                  type="button"
                  onClick={() => toggleCharge(c.id, !c.show_on_quote)}
                  className={`tap border px-2 py-1 font-mono text-[10px] ${
                    c.show_on_quote ? "border-ink bg-ink text-cream" : "border-ink/25 bg-paper text-ink-soft"
                  }`}
                >
                  {c.show_on_quote ? "Shown" : "Hidden"}
                </button>
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="label-mono text-ink-soft">Total</span>
            <span className="font-display text-[22px] leading-none">{money(totals.total)}</span>
          </div>
          <p className="font-mono text-[10px] text-ink-soft">
            Hidden lines still count towards the total.
            {quote.vat_enabled ? ` VAT at ${Number(quote.vat_rate)}% applied.` : " VAT is not applied."}
          </p>
        </div>
      </div>

      <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <div className="label-mono text-ink-soft">Notes for the client</div>
        <TextArea value={form.client_notes} onChange={(e) => setForm({ ...form, client_notes: e.target.value })} />
        <p className="font-mono text-[10px] text-ink-soft">Internal event notes are never shown on the quote.</p>
      </div>

      <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
        <div className="label-mono text-ink-soft">Terms</div>
        <TextArea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
      </div>

      {sent ? (
        <p className="font-mono text-[10px] text-ink-soft">
          This quote is marked Sent — later proposal or pricing changes will not alter it.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <GhostButton type="button" onClick={() => window.scrollTo({ top: 0 })}>
          Back to top
        </GhostButton>
        <PrimaryButton type="button" disabled={saving} onClick={save}>
          Save quote
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- Preview mode ---------- */

function lines(text: string | null | undefined) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="border-b border-ink/25 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function QuotePreview({ quote, money }: { quote: Quote; money: (n: number) => string }) {
  const t = quoteTotals(quote);
  const included = quote.sections.filter((s) => s.included);
  const includes = lines(quote.whats_included);
  const shownCharges = quote.charges.filter((c) => c.show_on_quote);

  return (
    <article className="mx-auto mt-4 w-full max-w-[720px] border border-ink/20 bg-cream px-5 py-8 text-ink sm:px-10 sm:py-12">
      <header className="border-b border-ink pb-5">
        <div className="font-display text-[28px] leading-none tracking-wide">INBTWN</div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-soft">Catering Quotation</div>
        {quote.title ? <h1 className="mt-5 font-display text-[26px] leading-tight">{quote.title}</h1> : null}
      </header>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {[
          ["Prepared for", quote.client_name],
          ["Event", quote.event_name],
          ["Date", quote.event_date ? fmtDateLong(quote.event_date) : null],
          ["Location", quote.venue],
          ["Guests", quote.guest_count != null ? String(quote.guest_count) : null],
          ["Service", [quote.event_type, quote.cuisine, quote.service_style].filter(Boolean).join(" · ") || null],
        ]
          .filter(([, v]) => Boolean(v))
          .map(([label, value]) => (
            <div key={label as string} className="flex justify-between gap-4 border-b border-ink/10 py-1.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
              <dd className="text-right text-sm font-medium">{value}</dd>
            </div>
          ))}
      </dl>

      {quote.introduction ? (
        <PreviewBlock title="Introduction">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{quote.introduction}</p>
        </PreviewBlock>
      ) : null}

      {included.length ? (
        <PreviewBlock title="Proposed menu">
          <div className="space-y-5">
            {included.map((s) => (
              <div key={s.id}>
                <h3 className="font-display text-[19px] leading-none">{s.name}</h3>
                <ul className="mt-2 space-y-1">
                  {s.items
                    .filter((i) => i.visible)
                    .map((i) => (
                      <li key={i.id} className="text-[15px] leading-relaxed">
                        {i.name}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </PreviewBlock>
      ) : null}

      {includes.length ? (
        <PreviewBlock title="What's included">
          <ul className="space-y-1">
            {includes.map((l, i) => (
              <li key={i} className="text-[15px] leading-relaxed">
                {l}
              </li>
            ))}
          </ul>
        </PreviewBlock>
      ) : null}

      <PreviewBlock title="Pricing">
        <div className="text-[15px]">
          <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 py-2">
            <span>
              {quote.catering_label} — {t.guests} guests × {money(t.perHead)} per person
            </span>
            <span className="shrink-0 font-medium">{money(t.cateringTotal)}</span>
          </div>
          {shownCharges.map((c) => (
            <div key={c.id} className="flex items-baseline justify-between gap-4 border-b border-ink/10 py-2">
              <span>{c.description}</span>
              <span className="shrink-0 font-medium">{money(Number(c.amount))}</span>
            </div>
          ))}
          {quote.vat_enabled ? (
            <>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 py-2">
                <span>Subtotal</span>
                <span className="shrink-0 font-medium">{money(t.subtotal)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 py-2">
                <span>VAT at {Number(quote.vat_rate)}%</span>
                <span className="shrink-0 font-medium">{money(t.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ink pt-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.18em]">Total</span>
            <span className="font-display text-[26px] leading-none">{money(t.total)}</span>
          </div>
        </div>
      </PreviewBlock>

      {quote.client_notes ? (
        <PreviewBlock title="Notes">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{quote.client_notes}</p>
        </PreviewBlock>
      ) : null}

      {quote.card_fee_enabled && quote.card_fee_percentage != null ? (
        <PreviewBlock title="Payment">
          <p className="text-[15px] leading-relaxed">
            Payment by bank transfer carries no processing fee. Card payments are subject to a{" "}
            {Number(quote.card_fee_percentage)}% processing fee.
          </p>
        </PreviewBlock>
      ) : null}

      {quote.terms ? (
        <PreviewBlock title="Terms">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{quote.terms}</p>
        </PreviewBlock>
      ) : null}
    </article>
  );
}
