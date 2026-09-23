ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts
  ALTER COLUMN organisation_id SET DEFAULT public.current_organisation_id();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read contacts" ON public.client_contacts
  FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org members create contacts" ON public.client_contacts
  FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org members update contacts" ON public.client_contacts
  FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org members delete contacts" ON public.client_contacts
  FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON public.client_contacts(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS client_contacts_one_primary
  ON public.client_contacts(client_id) WHERE is_primary AND active;

CREATE TRIGGER client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.client_contacts(id);
