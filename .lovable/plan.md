# Event Production display refinement

## Scope
Update only the Event Production screen’s presentation. Preserve all calculation inputs, full-precision values, recipe scaling, consolidation, costs, persistence, navigation, and other screens.

## Changes
- Replace the always-visible consolidated ingredient list with a compact summary row showing the ingredient count and a **View all** action.
- Keep the section collapsed on initial load; expand it in place and provide a clear **Collapse** action.
- Remove “usable” from consolidated quantity rows and add the explanatory line: “Quantities shown are usable production requirements.”
- Retain: “Theoretical requirements only — not a shopping list.”
- Apply one Event Production display formatter consistently to service targets, component quantities, direct ingredients, raw requirements, and consolidated totals:
  - `each`: round upward to a whole item.
  - below 100g/ml: nearest 1g/ml.
  - 100g/ml to below 1kg/L: nearest 5g/ml.
  - 1kg/L and above: nearest 0.05kg/L, with unnecessary trailing zeros removed.
- Keep calculation traces unchanged so they continue to expose the original deterministic precision.

## Verification
- Type-check the project.
- Test the Production screen at an iPhone-sized viewport.
- Confirm the totals start collapsed, expand/collapse correctly, explanatory copy appears, and representative gram/kilogram/count quantities use the requested display rounding without changing calculated values.
