<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Event archive is `events.archived_at` (null = active), independent of status/close-out/money; Today and Ask current-work use `activeOnly()` from src/lib/today.ts. Why: archive must hide workload without erasing records.
- Menu dishes may be unlinked (`recipe_id` null, `dish_name` set, `source_quote_item_id` from the accepted quote); unlinked dishes never produce quantities. Why: accepted proposals seed the operational menu without inventing recipes or touching the quote.
