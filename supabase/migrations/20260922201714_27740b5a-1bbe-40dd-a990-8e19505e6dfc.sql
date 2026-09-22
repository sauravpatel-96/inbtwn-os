ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_min numeric,
  ADD COLUMN IF NOT EXISTS budget_max numeric,
  ADD COLUMN IF NOT EXISTS budget_flexible boolean,
  ADD COLUMN IF NOT EXISTS power_access text,
  ADD COLUMN IF NOT EXISTS water_access text,
  ADD COLUMN IF NOT EXISTS venue_setup_notes text,
  ADD COLUMN IF NOT EXISTS logistics_notes text;

CREATE TABLE public.event_proposal_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_proposal_sections TO authenticated;
GRANT ALL ON public.event_proposal_sections TO service_role;
ALTER TABLE public.event_proposal_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select proposal sections" ON public.event_proposal_sections FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert proposal sections" ON public.event_proposal_sections FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update proposal sections" ON public.event_proposal_sections FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete proposal sections" ON public.event_proposal_sections FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_proposal_sections_event_idx ON public.event_proposal_sections(event_id);
CREATE TRIGGER event_proposal_sections_updated_at BEFORE UPDATE ON public.event_proposal_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.event_proposal_sections(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  name text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_proposal_items TO authenticated;
GRANT ALL ON public.event_proposal_items TO service_role;
ALTER TABLE public.event_proposal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select proposal items" ON public.event_proposal_items FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert proposal items" ON public.event_proposal_items FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update proposal items" ON public.event_proposal_items FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete proposal items" ON public.event_proposal_items FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_proposal_items_section_idx ON public.event_proposal_items(section_id);
CREATE INDEX event_proposal_items_event_idx ON public.event_proposal_items(event_id);
CREATE TRIGGER event_proposal_items_updated_at BEFORE UPDATE ON public.event_proposal_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_pricing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_per_head numeric,
  guest_count_override integer,
  is_selected boolean NOT NULL DEFAULT false,
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_rate numeric NOT NULL DEFAULT 0,
  payment_fee_percentage numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_pricing_options TO authenticated;
GRANT ALL ON public.event_pricing_options TO service_role;
ALTER TABLE public.event_pricing_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select pricing options" ON public.event_pricing_options FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert pricing options" ON public.event_pricing_options FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update pricing options" ON public.event_pricing_options FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete pricing options" ON public.event_pricing_options FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_pricing_options_event_idx ON public.event_pricing_options(event_id);
CREATE TRIGGER event_pricing_options_updated_at BEFORE UPDATE ON public.event_pricing_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_pricing_option_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.event_pricing_options(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.event_proposal_sections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_id, section_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_pricing_option_sections TO authenticated;
GRANT ALL ON public.event_pricing_option_sections TO service_role;
ALTER TABLE public.event_pricing_option_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select option sections" ON public.event_pricing_option_sections FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert option sections" ON public.event_pricing_option_sections FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete option sections" ON public.event_pricing_option_sections FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_pricing_option_sections_option_idx ON public.event_pricing_option_sections(option_id);

CREATE TABLE public.event_pricing_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.event_pricing_options(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_pricing_charges TO authenticated;
GRANT ALL ON public.event_pricing_charges TO service_role;
ALTER TABLE public.event_pricing_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select pricing charges" ON public.event_pricing_charges FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert pricing charges" ON public.event_pricing_charges FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update pricing charges" ON public.event_pricing_charges FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete pricing charges" ON public.event_pricing_charges FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_pricing_charges_option_idx ON public.event_pricing_charges(option_id);
CREATE TRIGGER event_pricing_charges_updated_at BEFORE UPDATE ON public.event_pricing_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_commercial_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  body text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_commercial_notes TO authenticated;
GRANT ALL ON public.event_commercial_notes TO service_role;
ALTER TABLE public.event_commercial_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org select commercial notes" ON public.event_commercial_notes FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org insert commercial notes" ON public.event_commercial_notes FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org update commercial notes" ON public.event_commercial_notes FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org delete commercial notes" ON public.event_commercial_notes FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX event_commercial_notes_event_idx ON public.event_commercial_notes(event_id);
CREATE TRIGGER event_commercial_notes_updated_at BEFORE UPDATE ON public.event_commercial_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();