CREATE TABLE public.event_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  recipe_version_id uuid REFERENCES public.recipe_versions(id) ON DELETE RESTRICT,
  portion_size text NOT NULL DEFAULT 'medium' CHECK (portion_size IN ('small','medium','large')),
  quantity_per_guest numeric CHECK (quantity_per_guest IS NULL OR quantity_per_guest >= 0),
  quantity_unit public.base_unit NOT NULL DEFAULT 'g',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_menu_items_event_idx ON public.event_menu_items(event_id);
CREATE INDEX event_menu_items_recipe_idx ON public.event_menu_items(recipe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menu_items TO authenticated;
GRANT ALL ON public.event_menu_items TO service_role;
ALTER TABLE public.event_menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org menu items select" ON public.event_menu_items FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org menu items insert" ON public.event_menu_items FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org menu items update" ON public.event_menu_items FOR UPDATE TO authenticated
  USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org menu items delete" ON public.event_menu_items FOR DELETE TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER event_menu_items_updated_at BEFORE UPDATE ON public.event_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();