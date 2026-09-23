ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS can_make_ahead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_freeze boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_storage text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approximate_active_minutes integer,
  ADD COLUMN IF NOT EXISTS operational_notes text;

CREATE TABLE public.recipe_prep_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  target text NOT NULL DEFAULT 'whole',
  component_recipe_id uuid REFERENCES public.recipes(id),
  recommended_days_before integer NOT NULL DEFAULT 0,
  approximate_minutes integer,
  default_assignment text NOT NULL DEFAULT 'me',
  can_do_earlier boolean NOT NULL DEFAULT false,
  can_freeze boolean NOT NULL DEFAULT false,
  defrost_lead_days integer,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_prep_steps TO authenticated;
GRANT ALL ON public.recipe_prep_steps TO service_role;
ALTER TABLE public.recipe_prep_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org prep steps select" ON public.recipe_prep_steps FOR SELECT TO authenticated
  USING (organisation_id = current_organisation_id());
CREATE POLICY "org prep steps insert" ON public.recipe_prep_steps FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org prep steps update" ON public.recipe_prep_steps FOR UPDATE TO authenticated
  USING (organisation_id = current_organisation_id())
  WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org prep steps delete" ON public.recipe_prep_steps FOR DELETE TO authenticated
  USING (organisation_id = current_organisation_id());

CREATE INDEX recipe_prep_steps_recipe_idx ON public.recipe_prep_steps (recipe_id, sort_order);

CREATE TRIGGER recipe_prep_steps_updated_at BEFORE UPDATE ON public.recipe_prep_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  prep_step_id uuid REFERENCES public.recipe_prep_steps(id) ON DELETE SET NULL,
  component_recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  name text NOT NULL,
  scheduled_date date,
  approximate_minutes integer,
  assignment text NOT NULL DEFAULT 'unassigned',
  status text NOT NULL DEFAULT 'todo',
  source text NOT NULL DEFAULT 'manual',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_tasks TO authenticated;
GRANT ALL ON public.event_tasks TO service_role;
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org event tasks select" ON public.event_tasks FOR SELECT TO authenticated
  USING (organisation_id = current_organisation_id());
CREATE POLICY "org event tasks insert" ON public.event_tasks FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org event tasks update" ON public.event_tasks FOR UPDATE TO authenticated
  USING (organisation_id = current_organisation_id())
  WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org event tasks delete" ON public.event_tasks FOR DELETE TO authenticated
  USING (organisation_id = current_organisation_id());

CREATE INDEX event_tasks_event_idx ON public.event_tasks (event_id, scheduled_date);
CREATE UNIQUE INDEX event_tasks_step_unique ON public.event_tasks (event_id, prep_step_id) WHERE prep_step_id IS NOT NULL;

CREATE TRIGGER event_tasks_updated_at BEFORE UPDATE ON public.event_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();