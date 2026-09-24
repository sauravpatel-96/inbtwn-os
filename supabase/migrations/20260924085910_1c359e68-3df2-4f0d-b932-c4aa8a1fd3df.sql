ALTER TABLE public.events
  ADD COLUMN arrival_lead_minutes integer,
  ADD COLUMN travel_minutes integer,
  ADD COLUMN travel_buffer_minutes integer;

CREATE TABLE public.run_sheet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.run_sheet_templates TO authenticated;
GRANT ALL ON public.run_sheet_templates TO service_role;
ALTER TABLE public.run_sheet_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read system or own templates" ON public.run_sheet_templates FOR SELECT TO authenticated
  USING (organisation_id IS NULL OR organisation_id = public.current_organisation_id());

CREATE TABLE public.run_sheet_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.run_sheet_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  anchor_type text NOT NULL CHECK (anchor_type IN ('service','arrival','departure','fixed')),
  offset_minutes integer NOT NULL DEFAULT 0,
  fixed_time time,
  duration_minutes integer,
  assignment text NOT NULL DEFAULT 'unassigned',
  is_milestone boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.run_sheet_template_items TO authenticated;
GRANT ALL ON public.run_sheet_template_items TO service_role;
ALTER TABLE public.run_sheet_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read items of visible templates" ON public.run_sheet_template_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.run_sheet_templates t WHERE t.id = template_id
    AND (t.organisation_id IS NULL OR t.organisation_id = public.current_organisation_id())));

CREATE TABLE public.event_run_sheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  anchor_type text NOT NULL CHECK (anchor_type IN ('service','arrival','departure','fixed')),
  offset_minutes integer NOT NULL DEFAULT 0,
  fixed_time time,
  duration_minutes integer,
  assignment text NOT NULL DEFAULT 'unassigned' CHECK (assignment IN ('me','helper','everyone','unassigned')),
  notes text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('template','manual')),
  template_item_id uuid REFERENCES public.run_sheet_template_items(id) ON DELETE SET NULL,
  is_milestone boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_run_sheet_items_template_uniq ON public.event_run_sheet_items (event_id, template_item_id) WHERE template_item_id IS NOT NULL;
CREATE INDEX event_run_sheet_items_event_idx ON public.event_run_sheet_items (event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_run_sheet_items TO authenticated;
GRANT ALL ON public.event_run_sheet_items TO service_role;
ALTER TABLE public.event_run_sheet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read run sheet" ON public.event_run_sheet_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert run sheet" ON public.event_run_sheet_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update run sheet" ON public.event_run_sheet_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete run sheet" ON public.event_run_sheet_items FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER event_run_sheet_items_updated_at BEFORE UPDATE ON public.event_run_sheet_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

WITH t AS (
  INSERT INTO public.run_sheet_templates (key, name, sort_order) VALUES ('standard_catering', 'Standard Catering', 0) RETURNING id
)
INSERT INTO public.run_sheet_template_items (template_id, name, anchor_type, offset_minutes, duration_minutes, is_milestone, sort_order)
SELECT t.id, v.name, v.anchor, v.off, v.dur, v.ms, v.ord FROM t, (VALUES
  ('Final kitchen checks','departure',-60,NULL::int,false,1),
  ('Load van','departure',-30,NULL,false,2),
  ('Depart','departure',0,NULL,true,3),
  ('Arrive venue','arrival',0,NULL,true,4),
  ('Setup','arrival',15,30,false,5),
  ('Start reheating / finishing','service',-60,NULL,false,6),
  ('Final food setup','service',-30,NULL,false,7),
  ('Final check','service',-10,NULL,false,8),
  ('Service','service',0,NULL,true,9),
  ('Clear down','service',90,NULL,false,10),
  ('Depart venue','service',120,NULL,true,11)
) AS v(name, anchor, off, dur, ms, ord);