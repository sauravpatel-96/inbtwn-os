# Recipe entry bottom sheets

## Goal
Improve ingredient and sub-recipe entry on both New Recipe and Edit Recipe without changing stored data, calculations, navigation, or the INBTWN visual language.

## Changes
- Replace the current ingredient picker flow with a focused mobile bottom sheet.
- Let users search and select an existing ingredient, enter quantity, use only compatible units, and optionally enter the existing prep-note field.
- Add two clear actions: **Add ingredient** closes the sheet; **Add & add another** appends the line and resets the sheet for the next entry.
- Keep inline ingredient creation available from the ingredient sheet, returning to the entry flow with the new ingredient selected.
- Replace the current component picker with the same staged flow: search/select an eligible recipe, enter quantity, and choose a compatible unit before adding.
- Preserve cycle prevention, existing line editing/removal/reordering, and all current save/version behavior.
- Reset draft sheet fields on cancel so cancelled entries never alter the recipe.
- Preserve the recipe page's scroll position while sheets open and close, including iPhone keyboard and safe-area handling.

## Technical details
- Keep all changes inside the recipe editor and existing presentation primitives; no database migration or query/calculation changes.
- Use local draft state for each sheet and append to `ingLines` / `compLines` only after validation.
- Derive allowed units with the existing canonical-unit helpers, ensuring weight, volume, and each remain incompatible.
- Reuse the existing INBTWN buttons, fields, paper/ink/flame tokens, typography, and drawer behavior.

## Verification
- Type-check the updated code.
- Test a new recipe on an iPhone-sized viewport: add ingredient, add-and-add-another, cancel, component entry, line editing, and scroll restoration.
- Test editing an existing recipe without saving or mutating existing records: open both sheets, add draft lines, cancel/leave the page, and confirm existing recipe data remains unchanged.
