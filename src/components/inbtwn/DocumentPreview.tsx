import { useState } from "react";
import { toast } from "sonner";
import { GhostButton } from "@/components/inbtwn/bits";
import { documentBlob, downloadBlob, sharePdf } from "@/lib/pdf";
import { docMoney, documentFileName, type AnyDoc } from "@/lib/documents";

/* Clean standalone document preview — paper only, no app chrome inside it. */

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={bold ? "text-[13px] font-semibold" : "text-[13px]"}>{label}</span>
      <span className={`shrink-0 font-mono text-[13px] ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function Head({ children }: { children: string }) {
  return (
    <div className="mb-2 mt-6 border-b border-flame/60 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
      {children}
    </div>
  );
}

export function DocumentPreview({ doc }: { doc: AnyDoc }) {
  const m = (n: number) => docMoney(n, doc.currency);
  return (
    <div className="border border-ink/15 bg-white px-5 py-6 text-ink shadow-[0_1px_0_rgb(0_0_0/0.08)] sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="min-w-0">
          <div className="font-display text-[28px] leading-none">{doc.business.name}</div>
          <div className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
            {doc.business.lines.join(", ")}
            {doc.business.email ? <div>{doc.business.email}</div> : null}
            {doc.business.phone ? <div>{doc.business.phone}</div> : null}
            {doc.business.companyNumber ? <div>Company no. {doc.business.companyNumber}</div> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[17px] uppercase leading-none text-ink">
            {doc.documentTitle}
          </div>
          <div className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
            {doc.meta.map((r) => (
              <div key={r.label}>
                {r.label}: {r.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {doc.kind === "invoice" ? "Bill to" : "Prepared for"}
        </div>
        <div className="text-[15px] font-semibold">{doc.clientName}</div>
        {doc.billingLines.map((l, i) => (
          <div key={i} className="font-mono text-[11px] text-ink-soft">
            {l}
          </div>
        ))}
      </div>

      {doc.kind === "quote" ? (
        <>
          {doc.eventDetails.length ? (
            <>
              <Head>Event</Head>
              {doc.eventDetails.map((r) => (
                <div key={r.label} className="flex gap-3 py-0.5 text-[13px]">
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {r.label}
                  </span>
                  <span>{r.value}</span>
                </div>
              ))}
            </>
          ) : null}
          {doc.introduction ? (
            <>
              <Head>Introduction</Head>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{doc.introduction}</p>
            </>
          ) : null}
           {doc.menu.length ? <Head>Proposed menu</Head> : null}
           {doc.menu.map((s) => (
             <div key={s.name} className="mt-4 first:mt-2">
               <div className="mb-2 text-[14px] font-semibold">{s.name}</div>
              <ul className="space-y-1">
                {s.items.map((i) => (
                  <li key={i} className="text-[13px] leading-snug">
                    • {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Head>Pricing</Head>
          {doc.lines.map((l, i) => (
            <div key={i}>
              <Row label={l.label} value={m(l.amount)} />
              {l.detail ? <div className="-mt-1 font-mono text-[10px] text-ink-soft">{l.detail}</div> : null}
            </div>
          ))}
          <div className="mt-2 border-t border-ink/20 pt-1.5">
            <Row label="Subtotal" value={m(doc.subtotal)} />
            {doc.vatEnabled ? <Row label={`VAT ${doc.vatRate}%`} value={m(doc.vat)} /> : null}
            <Row label="Total" value={m(doc.total)} bold />
          </div>
          {doc.whatsIncluded.length ? (
            <>
              <Head>What&apos;s included</Head>
              <ul className="space-y-1">
                {doc.whatsIncluded.map((i) => (
                  <li key={i} className="text-[13px]">
                    • {i}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {doc.notes ? (
            <>
              <Head>Notes</Head>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{doc.notes}</p>
            </>
          ) : null}
          {doc.terms.length ? (
            <>
              <Head>Terms</Head>
              <ul className="space-y-1">
                {doc.terms.map((i) => (
                  <li key={i} className="font-mono text-[11px] leading-relaxed text-ink-soft">
                    • {i}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Head>Details</Head>
           {doc.paymentState && doc.paymentState !== "unpaid" ? (
             <div className="mb-3 inline-flex border-l-2 border-flame px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
               {doc.paymentState === "part_paid" ? "Part paid" : doc.paymentState}
             </div>
           ) : null}
          {doc.lines.map((l, i) => (
            <div key={i}>
              <Row label={l.label} value={m(l.amount)} />
              {l.detail ? <div className="-mt-1 font-mono text-[10px] text-ink-soft">{l.detail}</div> : null}
            </div>
          ))}
          <div className="mt-2 border-t border-ink/20 pt-1.5">
            <Row label="Subtotal" value={m(doc.subtotal)} />
            {doc.vatEnabled ? <Row label={`VAT ${doc.vatRate}%`} value={m(doc.vat)} /> : null}
            <Row label="Total" value={m(doc.total)} bold />
            <Row label="Paid" value={m(doc.paid)} />
            <Row label="Amount due" value={m(doc.outstanding)} bold />
          </div>
          {doc.paymentInstructions.length ? (
            <>
              <Head>Payment</Head>
              {doc.paymentInstructions.map((l, i) => (
                <p key={i} className="text-[12px] leading-relaxed">
                  {l}
                </p>
              ))}
            </>
          ) : null}
          {doc.notes ? (
            <>
              <Head>Notes</Head>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{doc.notes}</p>
            </>
          ) : null}
        </>
      )}

      {doc.bank ? (
        <>
          <Head>Payment details</Head>
          <div className="font-mono text-[11px] leading-relaxed">
            <div>Account name: {doc.bank.accountName}</div>
            <div>Sort code: {doc.bank.sortCode}</div>
            <div>Account number: {doc.bank.accountNumber}</div>
            <div>Reference: {doc.number}</div>
          </div>
        </>
      ) : null}

      {doc.footerNote ? (
        <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-soft">{doc.footerNote}</p>
      ) : null}
      <p className="mt-3 border-t border-ink/10 pt-2 font-mono text-[9px] text-ink-soft">
        {[doc.business.legalName || doc.business.name, doc.business.email, doc.business.phone]
          .filter(Boolean)
          .join("  ·  ")}
      </p>
    </div>
  );
}

export function DocumentActions({ doc }: { doc: AnyDoc }) {
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const fileName = documentFileName(doc, doc.clientName);

  const run = async (mode: "pdf" | "share") => {
    setBusy(mode);
    try {
      const blob = await documentBlob(doc);
      if (mode === "pdf") {
        downloadBlob(blob, fileName);
        toast.success("PDF ready");
      } else {
        const how = await sharePdf(blob, fileName, `${doc.documentTitle} ${doc.number}`);
        if (how === "downloaded") toast.success("Saved as a PDF");
      }
    } catch (e) {
      toast.error((e as Error).message || "Could not create the PDF");
    }
    setBusy(null);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <GhostButton type="button" disabled={busy !== null} onClick={() => run("pdf")}>
        {busy === "pdf" ? "Creating…" : "Download PDF"}
      </GhostButton>
      <GhostButton type="button" disabled={busy !== null} onClick={() => run("share")}>
        {busy === "share" ? "Preparing…" : "Share"}
      </GhostButton>
    </div>
  );
}
