import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnyDoc, QuoteDoc, InvoiceDoc } from "./documents";
import { docMoney } from "./documents";

/* A4 at 72dpi, generous print margins. Clean standalone stationery — no app UI. */
const W = 595.28;
const H = 841.89;
const M = 48;
const CONTENT = W - M * 2;

const INK = rgb(0.09, 0.09, 0.09);
const SOFT = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.82, 0.82, 0.82);
const FLAME = rgb(0.84, 0.29, 0.08);

/** pdf-lib standard fonts are WinAnsi; keep text inside that range. */
function safe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF\n]/g, "");
}

class Doc {
  pdf!: PDFDocument;
  page!: PDFPage;
  regular!: PDFFont;
  bold!: PDFFont;
  y = H - M;

  async init() {
    this.pdf = await PDFDocument.create();
    this.regular = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.bold = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([W, H]);
    this.y = H - M;
  }

  space(amount: number) {
    if (this.y - amount < M + 28) this.newPage();
    else this.y -= amount;
  }

  need(amount: number) {
    if (this.y - amount < M + 28) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of safe(text).split("\n")) {
      if (!paragraph.trim()) {
        out.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const attempt = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(attempt, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = attempt;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  text(
    value: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      lineGap?: number;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const x = opts.x ?? M;
    const width = opts.width ?? CONTENT;
    const gap = opts.lineGap ?? 3.5;
    for (const line of this.wrap(value, font, size, width)) {
      this.need(size + gap);
      this.y -= size;
      if (line) {
        this.page.drawText(line, { x, y: this.y, size, font, color: opts.color ?? INK });
      }
      this.y -= gap;
    }
  }

  right(value: string, opts: { size?: number; bold?: boolean; y?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const t = safe(value);
    const x = W - M - font.widthOfTextAtSize(t, size);
    this.page.drawText(t, { x, y: opts.y ?? this.y, size, font, color: opts.color ?? INK });
  }

  rule(color = RULE) {
    this.need(10);
    this.y -= 6;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.7, color });
    this.y -= 6;
  }

  heading(label: string) {
    this.need(34);
    this.space(10);
    this.text(label.toUpperCase(), { size: 8.5, bold: true, color: INK, lineGap: 4 });
    this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: W - M, y: this.y + 2 }, thickness: 0.8, color: FLAME });
    this.y -= 6;
  }

  /** Label left, amount right, on one baseline. */
  amountRow(label: string, amount: string, opts: { bold?: boolean; detail?: string | null } = {}) {
    const size = opts.bold ? 11 : 10;
    const font = opts.bold ? this.bold : this.regular;
    const amountWidth = this.bold.widthOfTextAtSize(safe(amount), size) + 12;
    const lines = this.wrap(label, font, size, CONTENT - amountWidth);
    this.need(lines.length * (size + 4) + (opts.detail ? 12 : 0));
    lines.forEach((line, i) => {
      this.y -= size;
      this.page.drawText(line, { x: M, y: this.y, size, font, color: INK });
      if (i === 0) this.right(amount, { size, bold: true });
      this.y -= 4;
    });
    if (opts.detail) this.text(opts.detail, { size: 8.5, color: SOFT, lineGap: 3 });
  }

  finish(doc: AnyDoc) {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      const label = safe(`${doc.number}   ·   Page ${i + 1} of ${pages.length}`);
      const size = 7.5;
      p.drawText(label, {
        x: W - M - this.regular.widthOfTextAtSize(label, size),
        y: M - 18,
        size,
        font: this.regular,
        color: SOFT,
      });
    });
  }
}

function header(d: Doc, doc: AnyDoc) {
  const b = doc.business;
  d.page.drawText(safe(b.name), { x: M, y: H - M - 21, size: 23, font: d.bold, color: INK });
  d.right(doc.documentTitle, { size: 13, bold: true, y: H - M - 19, color: INK });
  d.y = H - M - 34;

  const infoY = d.y;
  const info = [b.lines.join(", "), b.email, b.phone, b.companyNumber ? `Company no. ${b.companyNumber}` : null]
    .filter(Boolean)
    .join("  ·  ");
  d.text(info, { size: 8.5, color: SOFT, width: CONTENT * 0.62, lineGap: 3 });

  // Document meta block, right column
  let metaY = infoY - 2;
  for (const row of doc.meta) {
    const value = safe(`${row.label}: ${row.value}`);
    const size = 8.5;
    d.page.drawText(value, {
      x: W - M - d.regular.widthOfTextAtSize(value, size),
      y: metaY - size,
      size,
      font: d.regular,
      color: SOFT,
    });
    metaY -= size + 3.5;
  }
  d.y = Math.min(d.y, metaY);
  d.rule(INK);
}

function partyBlock(d: Doc, doc: AnyDoc) {
  d.space(6);
  d.text(doc.kind === "invoice" ? "BILL TO" : "PREPARED FOR", { size: 8.5, bold: true, color: SOFT });
  d.text(doc.clientName, { size: 12, bold: true });
  for (const line of doc.billingLines) d.text(line, { size: 9.5, color: SOFT, lineGap: 2.5 });
}

function totalsBlock(
  d: Doc,
  doc: { currency: string; subtotal: number; vatEnabled: boolean; vatRate: number; vat: number; total: number },
  extra: { label: string; amount: number }[] = [],
) {
  d.space(4);
  d.rule();
  d.amountRow("Subtotal", docMoney(doc.subtotal, doc.currency));
  if (doc.vatEnabled) d.amountRow(`VAT ${doc.vatRate}%`, docMoney(doc.vat, doc.currency));
  d.amountRow("Total", docMoney(doc.total, doc.currency), { bold: true });
  for (const e of extra) d.amountRow(e.label, docMoney(e.amount, doc.currency), { bold: e.label === "Amount due" });
}

function bankBlock(d: Doc, doc: AnyDoc) {
  if (!doc.bank) return;
  d.heading("Payment details");
  d.text(`Account name: ${doc.bank.accountName}`, { size: 9.5, lineGap: 2.5 });
  d.text(`Sort code: ${doc.bank.sortCode}`, { size: 9.5, lineGap: 2.5 });
  d.text(`Account number: ${doc.bank.accountNumber}`, { size: 9.5, lineGap: 2.5 });
  d.text(`Reference: ${doc.number}`, { size: 9.5, lineGap: 2.5 });
}

export async function renderDocumentPdf(doc: AnyDoc): Promise<Uint8Array> {
  const d = new Doc();
  await d.init();
  header(d, doc);
  partyBlock(d, doc);

  if (doc.kind === "quote") {
    const q = doc as QuoteDoc;
    if (q.eventDetails.length) {
      d.heading("Event");
      for (const row of q.eventDetails) {
        d.need(14);
        d.y -= 10;
        d.page.drawText(safe(row.label), { x: M, y: d.y, size: 9, font: d.regular, color: SOFT });
        d.page.drawText(safe(row.value), { x: M + 110, y: d.y, size: 10, font: d.regular, color: INK });
        d.y -= 4;
      }
    }
    if (q.introduction) {
      d.heading("Introduction");
      d.text(q.introduction, { size: 10, lineGap: 4 });
    }
    if (q.menu.length) d.heading("Proposed menu");
    for (const section of q.menu) {
      d.space(5);
      d.text(section.name, { size: 10.5, bold: true, lineGap: 4 });
      for (const item of section.items) {
        d.text(`·  ${item}`, { size: 10, lineGap: 4, width: CONTENT - 12 });
      }
    }
    d.heading("Pricing");
    for (const line of q.lines) d.amountRow(line.label, docMoney(line.amount, q.currency), { detail: line.detail ?? null });
    totalsBlock(d, q);
    if (q.whatsIncluded.length) {
      d.heading("What's included");
      for (const item of q.whatsIncluded) d.text(`·  ${item}`, { size: 10, lineGap: 4 });
    }
    if (q.notes) {
      d.heading("Notes");
      d.text(q.notes, { size: 10, lineGap: 4 });
    }
    if (q.terms.length) {
      d.heading("Terms");
      for (const item of q.terms) d.text(`·  ${item}`, { size: 9.5, lineGap: 3.5, color: SOFT });
    }
    bankBlock(d, q);
  } else {
    const inv = doc as InvoiceDoc;
    d.heading("Details");
    if (inv.paymentState && inv.paymentState !== "unpaid") {
      const state = inv.paymentState === "part_paid" ? "PART PAID" : inv.paymentState.toUpperCase();
      d.text(state, { size: 9, bold: true, color: FLAME, lineGap: 5 });
    }
    for (const line of inv.lines) d.amountRow(line.label, docMoney(line.amount, inv.currency), { detail: line.detail ?? null });
    totalsBlock(d, inv, [
      { label: "Paid", amount: inv.paid },
      { label: "Amount due", amount: inv.outstanding },
    ]);
    if (inv.paymentInstructions.length) {
      d.heading("Payment");
      for (const line of inv.paymentInstructions) d.text(line, { size: 9.5, lineGap: 3.5 });
    }
    bankBlock(d, inv);
    if (inv.notes) {
      d.heading("Notes");
      d.text(inv.notes, { size: 10, lineGap: 4 });
    }
  }

  if (doc.footerNote) {
    d.space(10);
    d.text(doc.footerNote, { size: 8.5, color: SOFT });
  }
  d.space(8);
  d.text(
    [doc.business.legalName || doc.business.name, doc.business.email, doc.business.phone].filter(Boolean).join("  ·  "),
    { size: 8, color: SOFT },
  );

  d.finish(doc);
  return d.pdf.save();
}

export async function documentBlob(doc: AnyDoc): Promise<Blob> {
  const bytes = await renderDocumentPdf(doc);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Native share where available (iPhone), download everywhere else. */
export async function sharePdf(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
