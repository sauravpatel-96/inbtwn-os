# Quote and Invoice Document Polish

## Scope
Refine only the client-facing quote and invoice preview/PDF presentation. Preserve calculations, payment allocation, platform logic, numbering, snapshots, data, settings, and PDF/share behavior.

## Changes
- Add a document-only formal date formatter without weekday names.
- Remove all non-VAT-registered explanatory copy while retaining VAT rows when VAT is enabled.
- Add a single **PROPOSED MENU** section above all proposal sections and retain multiple-section support.
- Replace client-facing “per head” with “per person.”
- Keep one concise platform Terms block and remove duplicate platform footer messaging.
- Use **BILL TO** on invoices.
- Add a restrained invoice payment-state label derived from existing paid, outstanding, due-date, and payment-state values—not invoice document status.
- Polish typography, spacing, hierarchy, totals, accent details, and concise footer across preview and A4 PDF without changing the overall document structure.

## Verification
- Verify Y11 Banquet 2027 preview and generated A4 PDF against the supplied quote copy and exclusions.
- Verify INV-2026-003 totals, zero paid, £1,120 due, overdue state, and no VAT wording in preview and A4 PDF.
- Confirm existing business records are unchanged.
