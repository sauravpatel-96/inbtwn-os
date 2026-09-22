CREATE TABLE public.event_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  pricing_option_id uuid REFERENCES public.event_pricing_options(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  title text,
  client_name text,
  event_name text,
  event_date date,
  venue text,
  guest_count integer,
  event_type text,
  cuisine text,
  service_style text,
  introduction text,
  whats_included text,
  client_notes text,
  terms text,
  price_per_head numeric,
  catering_label text NOT NULL DEFAULT 'Catering',
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_rate numeric NOT NULL DEFAULT 0,
  card_fee_enabled boolean NOT NULL DEFAULT false,
  card_fee_percentage numeric,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);
ALTER TABLE public.event_quotes ADD CONSTRAINT event_quotes_status_check CHECK (status IN ('draft','ready','sent'));
ALTER TABLE public.event_quotes ALTER COLUMN organisation_id SET DEFAULT public.current_organisation_id();

CREATE TABLE public.event_quote_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  quote_id uuid NOT NULL REFERENCES public.event_quotes(id) ON DELETE CASCADE,
  name text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.event_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  quote_id uuid NOT NULL REFERENCES public.event_quotes(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.event_quote_sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.event_quote_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  quote_id uuid NOT NULL REFERENCES public.event_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  show_on_quote boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_quotes TO authenticated;
GRANT ALL ON public.event_quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_quote_sections TO authenticated;
GRANT ALL ON public.event_quote_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_quote_items TO authenticated;
GRANT ALL ON public.event_quote_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_quote_charges TO authenticated;
GRANT ALL ON public.event_quote_charges TO service_role;

ALTER TABLE public.event_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_quote_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_quote_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read quotes" ON public.event_quotes FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert quotes" ON public.event_quotes FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update quotes" ON public.event_quotes FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete quotes" ON public.event_quotes FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE POLICY "org read quote sections" ON public.event_quote_sections FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert quote sections" ON public.event_quote_sections FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update quote sections" ON public.event_quote_sections FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete quote sections" ON public.event_quote_sections FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE POLICY "org read quote items" ON public.event_quote_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert quote items" ON public.event_quote_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update quote items" ON public.event_quote_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete quote items" ON public.event_quote_items FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE POLICY "org read quote charges" ON public.event_quote_charges FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert quote charges" ON public.event_quote_charges FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update quote charges" ON public.event_quote_charges FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete quote charges" ON public.event_quote_charges FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE TRIGGER update_event_quotes_updated_at BEFORE UPDATE ON public.event_quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_event_quote_sections_updated_at BEFORE UPDATE ON public.event_quote_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_event_quote_items_updated_at BEFORE UPDATE ON public.event_quote_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_event_quote_charges_updated_at BEFORE UPDATE ON public.event_quote_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();