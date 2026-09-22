-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== Organisations =====
CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- ===== Profiles =====
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  email text,
  role public.app_role NOT NULL DEFAULT 'owner',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer: which organisation does the current user belong to?
CREATE OR REPLACE FUNCTION public.current_organisation_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organisation_id FROM public.profiles
  WHERE user_id = auth.uid() AND active = true
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.current_organisation_id() TO authenticated;

CREATE POLICY "org members read organisation" ON public.organisations
  FOR SELECT TO authenticated USING (id = public.current_organisation_id());
CREATE POLICY "org members update organisation" ON public.organisations
  FOR UPDATE TO authenticated USING (id = public.current_organisation_id());

CREATE POLICY "org members read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id() OR user_id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER organisations_updated_at BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Onboarding: create organisation + owner profile for the signed-in user
CREATE OR REPLACE FUNCTION public.setup_organisation(_org_name text, _user_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;
  IF _org_name IS NULL OR length(trim(_org_name)) = 0 THEN
    RAISE EXCEPTION 'Organisation name is required';
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.organisations (name) VALUES (trim(_org_name)) RETURNING id INTO _org_id;
  INSERT INTO public.profiles (organisation_id, user_id, name, email, role)
  VALUES (_org_id, auth.uid(), coalesce(nullif(trim(_user_name), ''), split_part(_email, '@', 1)), _email, 'owner');
  RETURN _org_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.setup_organisation(text, text) TO authenticated;

-- ===== Clients =====
CREATE TYPE public.client_type AS ENUM ('individual', 'corporate', 'agency', 'venue', 'other');

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_type public.client_type NOT NULL DEFAULT 'individual',
  company_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  billing_address text,
  default_event_address text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_org_idx ON public.clients(organisation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org clients select" ON public.clients FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org clients insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org clients update" ON public.clients FOR UPDATE TO authenticated
  USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org clients delete" ON public.clients FOR DELETE TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Events =====
CREATE TYPE public.event_status AS ENUM (
  'enquiry','quoting','awaiting_client','confirmed','in_progress','completed','lost','cancelled'
);
CREATE TYPE public.event_source AS ENUM (
  'togather','poptop','direct','email','website','referral','repeat_client','instagram','whatsapp','other'
);
CREATE TYPE public.guest_count_status AS ENUM ('estimated','booked','confirmed','final');

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  source public.event_source NOT NULL DEFAULT 'direct',
  source_reference text,
  status public.event_status NOT NULL DEFAULT 'enquiry',
  event_type text,
  cuisine text,
  service_style text,
  event_date date,
  arrival_time time,
  service_time time,
  end_time time,
  guest_count integer CHECK (guest_count IS NULL OR guest_count >= 0),
  guest_count_status public.guest_count_status NOT NULL DEFAULT 'estimated',
  venue_name text,
  venue_address text,
  venue_contact_name text,
  venue_contact_phone text,
  budget numeric(12,2) CHECK (budget IS NULL OR budget >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  internal_notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_org_date_idx ON public.events(organisation_id, event_date);
CREATE INDEX events_client_idx ON public.events(client_id);
GRANT SELECT, INSERT, UPDATE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org events select" ON public.events FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org events insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org events update" ON public.events FOR UPDATE TO authenticated
  USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Event dietaries =====
CREATE TABLE public.event_dietaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  type text NOT NULL,
  guest_count integer CHECK (guest_count IS NULL OR guest_count >= 0),
  notes text,
  severity text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_dietaries_event_idx ON public.event_dietaries(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_dietaries TO authenticated;
GRANT ALL ON public.event_dietaries TO service_role;
ALTER TABLE public.event_dietaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org dietaries select" ON public.event_dietaries FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org dietaries insert" ON public.event_dietaries FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org dietaries update" ON public.event_dietaries FOR UPDATE TO authenticated
  USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org dietaries delete" ON public.event_dietaries FOR DELETE TO authenticated
  USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER event_dietaries_updated_at BEFORE UPDATE ON public.event_dietaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Demo data loader (per organisation, clearly labelled) =====
CREATE OR REPLACE FUNCTION public.load_demo_data()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org uuid := public.current_organisation_id();
  _c1 uuid; _c2 uuid; _c3 uuid; _e1 uuid; _e2 uuid; _e3 uuid;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'No organisation'; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE organisation_id = _org AND is_demo) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.clients (organisation_id, client_type, company_name, first_name, last_name, email, phone, is_demo, notes)
  VALUES (_org, 'corporate', '[Demo] Northwind Studios', 'Amara', 'Okafor', 'amara@demo.example', '+44 7700 900101', true, 'Sample client for testing.')
  RETURNING id INTO _c1;
  INSERT INTO public.clients (organisation_id, client_type, company_name, first_name, last_name, email, phone, is_demo, notes)
  VALUES (_org, 'corporate', '[Demo] Meridian Finance', 'Tom', 'Reid', 'tom@demo.example', '+44 7700 900102', true, 'Sample client for testing.')
  RETURNING id INTO _c2;
  INSERT INTO public.clients (organisation_id, client_type, first_name, last_name, email, phone, is_demo, notes)
  VALUES (_org, 'individual', '[Demo] Priya', 'Shah', 'priya@demo.example', '+44 7700 900103', true, 'Sample client for testing.')
  RETURNING id INTO _c3;

  INSERT INTO public.events (organisation_id, client_id, title, source, source_reference, status, event_type, cuisine, service_style,
    event_date, service_time, guest_count, guest_count_status, venue_name, venue_address, budget, is_demo, internal_notes)
  VALUES (_org, _c1, '[Demo] Corporate Summer Party', 'togather', 'TG-48213', 'enquiry', 'Corporate Catering', 'Korean', 'Buffet',
    current_date + 32, NULL, 80, 'estimated', 'The Foundry', 'Shoreditch, London', 2500, true, 'Sample enquiry via Togather.')
  RETURNING id INTO _e1;
  INSERT INTO public.events (organisation_id, client_id, title, source, status, event_type, cuisine, service_style,
    event_date, arrival_time, service_time, end_time, guest_count, guest_count_status, venue_name, venue_address, budget, is_demo)
  VALUES (_org, _c2, '[Demo] Corporate Lunch', 'direct', 'confirmed', 'Office Lunch', 'Mediterranean', 'Family Style',
    current_date + 5, '10:30', '12:30', '14:30', 110, 'confirmed', 'Meridian House', 'City of London', 4100, true)
  RETURNING id INTO _e2;
  INSERT INTO public.events (organisation_id, client_id, title, source, status, event_type, cuisine, service_style,
    event_date, arrival_time, service_time, guest_count, guest_count_status, venue_name, venue_address, budget, is_demo)
  VALUES (_org, _c3, '[Demo] Private Dinner', 'referral', 'quoting', 'Private Dinner', 'Modern British', 'Plated',
    current_date + 12, '16:00', '19:30', 14, 'booked', 'Client home', 'Richmond', 1800, true)
  RETURNING id INTO _e3;

  INSERT INTO public.event_dietaries (event_id, organisation_id, type, guest_count, severity, confirmed)
  VALUES (_e1, _org, 'Vegetarian', 12, NULL, false),
         (_e1, _org, 'Nut Allergy', 1, 'severe', false),
         (_e2, _org, 'Vegan', 8, NULL, true),
         (_e2, _org, 'Gluten Free', 4, NULL, true),
         (_e3, _org, 'Shellfish Allergy', 1, 'severe', true);
  RETURN 3;
END;
$$;
GRANT EXECUTE ON FUNCTION public.load_demo_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_demo_data()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org uuid := public.current_organisation_id();
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'No organisation'; END IF;
  DELETE FROM public.events WHERE organisation_id = _org AND is_demo;
  DELETE FROM public.clients WHERE organisation_id = _org AND is_demo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_demo_data() TO authenticated;