# Polish Ask INBTWN V1

## Goal
Make Ask answers safer, shorter, and easier to scan on iPhone while preserving all existing read-only data access, business rules, calculations, context, and deep links.

## Changes

1. **Safe answer rendering**
   - Replace the current plain-text renderer with a small allowlisted Markdown renderer.
   - Support paragraphs, line breaks, bullet lists, bold text, and existing internal links.
   - Keep internal links routed through the app and render all other model content as escaped text; do not allow raw HTML.

2. **Cleaner Ask screen**
   - Remove tool-source labels from assistant messages while keeping the existing server-side tool-use log in the response for internal debugging.
   - Tighten assistant answer spacing and hierarchy without changing INBTWN colours, typography, rectangular styling, user-message treatment, or the input pattern.
   - Keep the composer sticky and keyboard-friendly, show a clear loading state, prevent duplicate submissions, and maintain latest-message scrolling.

3. **Concise response style**
   - Refine the server-side response instructions to prefer event-first wording, compact operational answers, one-decimal percentage display, business-friendly currency, and relevant deep links only.
   - Add explicit guidance for staff-cost answers, incomplete food costing, unknown platform payouts, Today summaries, and short read-only refusals.
   - Preserve full numerical precision in tools and calculations; rounding applies only to model-facing display instructions.

## Verification
- Type-check and build the app.
- In an authenticated iPhone-sized session, test:
  - outstanding money for NUSU without duplication;
  - NUSU profitability with £1,400 revenue, £180 costs, £1,220 profit, 87.1% margin, and incomplete food-cost warning;
  - staff actual cost and the follow-up estimate;
  - Y11 Togather payout as unknown with Sat 10 Jul 2027, never £990 revenue;
  - read-only refusal for marking NUSU paid, with Finance link and no data change;
  - Today answer matching current Today data and excluding past operational warnings.
- Confirm rendered bold/lists contain no literal Markdown markers, no tool labels appear, links navigate correctly, and relevant business records remain unchanged.
