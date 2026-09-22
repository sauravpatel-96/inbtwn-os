ALTER TABLE public.event_shopping_checks
  ALTER COLUMN organisation_id SET DEFAULT current_organisation_id();