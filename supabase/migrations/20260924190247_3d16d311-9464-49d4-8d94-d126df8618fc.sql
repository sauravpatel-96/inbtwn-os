CREATE TABLE public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('equipment','serveware','consumable')),
  unit text NOT NULL DEFAULT 'each',
  notes text,
  active boolean NOT NULL DEFAULT true,
  owned_quantity integer CHECK (owned_quantity IS NULL OR owned_quantity >= 0),
  per_guest numeric CHECK (per_guest IS NULL OR per_guest >= 0),
  template_buffet integer CHECK (template_buffet IS NULL OR template_buffet >= 0),
  template_drop_off integer CHECK (template_drop_off IS NULL OR template_drop_off >= 0),
  template_table integer CHECK (template_table IS NULL OR template_table >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.kit_items.template_buffet IS 'NULL = not in template; 0 = in template using per-guest rule; >0 = fixed quantity';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kit_items TO authenticated;
GRANT ALL ON public.kit_items TO service_role;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read kit" ON public.kit_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert kit" ON public.kit_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update kit" ON public.kit_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE TRIGGER kit_items_updated_at BEFORE UPDATE ON public.kit_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kit_item_id uuid NOT NULL REFERENCES public.kit_items(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('template','manual')),
  base_quantity integer CHECK (base_quantity IS NULL OR base_quantity >= 0),
  quantity_override integer CHECK (quantity_override IS NULL OR quantity_override >= 0),
  notes text,
  purchase_status text NOT NULL DEFAULT 'need_to_buy' CHECK (purchase_status IN ('need_to_buy','have_enough','bought')),
  packed_quantity integer NOT NULL DEFAULT 0 CHECK (packed_quantity >= 0),
  returned_quantity integer CHECK (returned_quantity IS NULL OR returned_quantity >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, kit_item_id)
);
COMMENT ON COLUMN public.event_kit_items.base_quantity IS 'NULL = use library per-guest rule x event guests';
CREATE INDEX event_kit_items_event_idx ON public.event_kit_items (event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_kit_items TO authenticated;
GRANT ALL ON public.event_kit_items TO service_role;
ALTER TABLE public.event_kit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read event kit" ON public.event_kit_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert event kit" ON public.event_kit_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update event kit" ON public.event_kit_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete event kit" ON public.event_kit_items FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER event_kit_items_updated_at BEFORE UPDATE ON public.event_kit_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();