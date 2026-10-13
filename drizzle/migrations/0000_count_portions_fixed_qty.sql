ALTER TABLE public.recipe_versions
  ADD COLUMN portion_small numeric NULL CHECK (portion_small IS NULL OR portion_small > 0),
  ADD COLUMN portion_medium numeric NULL CHECK (portion_medium IS NULL OR portion_medium > 0),
  ADD COLUMN portion_large numeric NULL CHECK (portion_large IS NULL OR portion_large > 0);
ALTER TABLE public.event_menu_items
  ADD COLUMN quantity_mode text NOT NULL DEFAULT 'per_guest' CHECK (quantity_mode IN ('per_guest','fixed')),
  ADD COLUMN fixed_quantity numeric NULL CHECK (fixed_quantity IS NULL OR fixed_quantity > 0);