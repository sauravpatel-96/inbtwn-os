ALTER TABLE public.event_menu_items ALTER COLUMN recipe_id DROP NOT NULL;
ALTER TABLE public.event_menu_items ADD COLUMN IF NOT EXISTS dish_name text;
ALTER TABLE public.event_menu_items ADD COLUMN IF NOT EXISTS source_quote_item_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS event_menu_items_event_source_quote_item_uidx
  ON public.event_menu_items (event_id, source_quote_item_id) WHERE source_quote_item_id IS NOT NULL;