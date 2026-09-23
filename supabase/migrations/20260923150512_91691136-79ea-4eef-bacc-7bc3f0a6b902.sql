ALTER TABLE public.business_settings
  ALTER COLUMN organisation_id SET DEFAULT public.current_organisation_id();