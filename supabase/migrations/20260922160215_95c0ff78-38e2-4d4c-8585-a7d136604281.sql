CREATE TABLE public.event_packing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  category text NOT NULL CHECK (category IN ('equipment','disposables','other')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_packing_items TO authenticated;
GRANT ALL ON public.event_packing_items TO service_role;
ALTER TABLE public.event_packing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members select packing items" ON public.event_packing_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org members insert packing items" ON public.event_packing_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org members update packing items" ON public.event_packing_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org members delete packing items" ON public.event_packing_items FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_packing_items_event_idx ON public.event_packing_items(event_id);
CREATE TRIGGER update_event_packing_items_updated_at BEFORE UPDATE ON public.event_packing_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_packing_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.event_packing_checks TO authenticated;
GRANT ALL ON public.event_packing_checks TO service_role;
ALTER TABLE public.event_packing_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members select packing checks" ON public.event_packing_checks FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org members insert packing checks" ON public.event_packing_checks FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org members delete packing checks" ON public.event_packing_checks FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_packing_checks_event_idx ON public.event_packing_checks(event_id);