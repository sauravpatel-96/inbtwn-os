CREATE TABLE public.event_shopping_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, ingredient_id)
);

CREATE INDEX event_shopping_checks_event_idx ON public.event_shopping_checks (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_checks TO authenticated;
GRANT ALL ON public.event_shopping_checks TO service_role;

ALTER TABLE public.event_shopping_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org shopping checks select" ON public.event_shopping_checks
  FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org shopping checks insert" ON public.event_shopping_checks
  FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org shopping checks delete" ON public.event_shopping_checks
  FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());