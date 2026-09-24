
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  delivery_available boolean NOT NULL DEFAULT false,
  preference_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ingredient_purchase_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  pack_quantity numeric NOT NULL CHECK (pack_quantity > 0),
  pack_unit text NOT NULL CHECK (pack_unit IN ('g','kg','ml','L','each')),
  is_preferred boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ingredient_one_preferred_option ON public.ingredient_purchase_options(ingredient_id) WHERE is_preferred AND active;
CREATE INDEX ingredient_purchase_options_ing ON public.ingredient_purchase_options(ingredient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredient_purchase_options TO authenticated;
GRANT ALL ON public.ingredient_purchase_options TO service_role;
ALTER TABLE public.ingredient_purchase_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read purchase options" ON public.ingredient_purchase_options FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert purchase options" ON public.ingredient_purchase_options FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update purchase options" ON public.ingredient_purchase_options FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete purchase options" ON public.ingredient_purchase_options FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER trg_purchase_options_updated BEFORE UPDATE ON public.ingredient_purchase_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ingredient_purchase_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  option_id uuid NOT NULL REFERENCES public.ingredient_purchase_options(id) ON DELETE CASCADE,
  pack_price numeric NOT NULL CHECK (pack_price >= 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingredient_purchase_prices_opt ON public.ingredient_purchase_prices(option_id, effective_date DESC);
GRANT SELECT, INSERT, DELETE ON public.ingredient_purchase_prices TO authenticated;
GRANT ALL ON public.ingredient_purchase_prices TO service_role;
ALTER TABLE public.ingredient_purchase_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read prices" ON public.ingredient_purchase_prices FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert prices" ON public.ingredient_purchase_prices FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete prices" ON public.ingredient_purchase_prices FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE TABLE public.event_food_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_food_purchases_event ON public.event_food_purchases(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_food_purchases TO authenticated;
GRANT ALL ON public.event_food_purchases TO service_role;
ALTER TABLE public.event_food_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read food purchases" ON public.event_food_purchases FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert food purchases" ON public.event_food_purchases FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update food purchases" ON public.event_food_purchases FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete food purchases" ON public.event_food_purchases FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER trg_food_purchases_updated BEFORE UPDATE ON public.event_food_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

/* Ingredient cost state, kept in sync from purchase options */
ALTER TABLE public.ingredients
  ADD COLUMN cost_status text,
  ADD COLUMN cost_source text,
  ADD COLUMN cost_option_id uuid;

CREATE OR REPLACE FUNCTION public.resolve_ingredient_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  n_active int; n_priced int; opt record; price numeric; factor numeric; pbase text;
BEGIN
  SELECT count(*) INTO n_active FROM ingredient_purchase_options WHERE ingredient_id = NEW.id AND active;
  IF (SELECT count(*) FROM ingredient_purchase_options WHERE ingredient_id = NEW.id) = 0 THEN
    -- No purchase options: keep any legacy manual cost.
    NEW.cost_source := CASE WHEN NEW.current_unit_cost IS NULL THEN NULL ELSE 'manual' END;
    NEW.cost_status := CASE WHEN NEW.current_unit_cost IS NULL THEN 'no_price' ELSE 'ok' END;
    NEW.cost_option_id := NULL;
    IF NEW.yield_percentage IS NULL OR NEW.yield_percentage <= 0 OR NEW.yield_percentage > 100 THEN
      NEW.cost_status := 'invalid_yield';
    END IF;
    RETURN NEW;
  END IF;

  NEW.cost_source := 'purchase_option';
  NEW.cost_option_id := NULL;
  NEW.current_unit_cost := NULL;

  IF n_active = 0 THEN NEW.cost_status := 'no_valid_option'; RETURN NEW; END IF;

  SELECT count(*) INTO n_priced FROM ingredient_purchase_options o
   WHERE o.ingredient_id = NEW.id AND o.active AND EXISTS (SELECT 1 FROM ingredient_purchase_prices p WHERE p.option_id = o.id);

  SELECT * INTO opt FROM ingredient_purchase_options WHERE ingredient_id = NEW.id AND active AND is_preferred LIMIT 1;
  IF NOT FOUND THEN
    IF n_priced = 1 THEN
      SELECT o.* INTO opt FROM ingredient_purchase_options o
       WHERE o.ingredient_id = NEW.id AND o.active AND EXISTS (SELECT 1 FROM ingredient_purchase_prices p WHERE p.option_id = o.id) LIMIT 1;
    ELSIF n_priced = 0 THEN
      NEW.cost_status := 'no_price'; RETURN NEW;
    ELSE
      NEW.cost_status := 'no_preferred'; RETURN NEW;
    END IF;
  END IF;

  SELECT p.pack_price INTO price FROM ingredient_purchase_prices p
   WHERE p.option_id = opt.id
   ORDER BY (p.effective_date <= CURRENT_DATE) DESC,
            CASE WHEN p.effective_date <= CURRENT_DATE THEN p.effective_date END DESC NULLS LAST,
            p.effective_date ASC, p.created_at DESC
   LIMIT 1;
  NEW.cost_option_id := opt.id;
  IF price IS NULL THEN NEW.cost_status := 'no_price'; RETURN NEW; END IF;

  pbase := CASE opt.pack_unit WHEN 'kg' THEN 'g' WHEN 'L' THEN 'ml' ELSE opt.pack_unit END;
  factor := CASE opt.pack_unit WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END;
  IF pbase <> NEW.base_unit::text THEN NEW.cost_status := 'unit_mismatch'; RETURN NEW; END IF;
  IF NEW.yield_percentage IS NULL OR NEW.yield_percentage <= 0 OR NEW.yield_percentage > 100 THEN
    NEW.cost_status := 'invalid_yield'; RETURN NEW;
  END IF;

  NEW.current_unit_cost := price / (opt.pack_quantity * factor);
  NEW.cost_status := 'ok';
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ingredient_resolve_cost BEFORE INSERT OR UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.resolve_ingredient_cost();

CREATE OR REPLACE FUNCTION public.touch_ingredient_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ing uuid;
BEGIN
  IF TG_TABLE_NAME = 'ingredient_purchase_prices' THEN
    SELECT ingredient_id INTO ing FROM ingredient_purchase_options WHERE id = COALESCE(NEW.option_id, OLD.option_id);
  ELSE
    ing := COALESCE(NEW.ingredient_id, OLD.ingredient_id);
  END IF;
  IF ing IS NOT NULL THEN UPDATE ingredients SET updated_at = now() WHERE id = ing; END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'ingredient_purchase_options' AND OLD.ingredient_id <> NEW.ingredient_id THEN
    UPDATE ingredients SET updated_at = now() WHERE id = OLD.ingredient_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_options_touch_ingredient AFTER INSERT OR UPDATE OR DELETE ON public.ingredient_purchase_options
FOR EACH ROW EXECUTE FUNCTION public.touch_ingredient_cost();
CREATE TRIGGER trg_prices_touch_ingredient AFTER INSERT OR DELETE ON public.ingredient_purchase_prices
FOR EACH ROW EXECUTE FUNCTION public.touch_ingredient_cost();

/* Seed suppliers (names only, no prices) for existing and future organisations */
INSERT INTO public.suppliers (organisation_id, name, delivery_available)
SELECT o.id, s.name, s.delivery FROM public.organisations o
CROSS JOIN (VALUES ('JJ Foodservice', false), ('Costco', false), ('Aldi', false), ('Sainsbury''s', true), ('Ocado', true), ('Hoo Hing', false)) AS s(name, delivery);

CREATE OR REPLACE FUNCTION public.seed_org_suppliers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO suppliers (organisation_id, name, delivery_available) VALUES
    (NEW.id, 'JJ Foodservice', false), (NEW.id, 'Costco', false), (NEW.id, 'Aldi', false),
    (NEW.id, 'Sainsbury''s', true), (NEW.id, 'Ocado', true), (NEW.id, 'Hoo Hing', false);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_org_suppliers() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_org_seed_suppliers AFTER INSERT ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.seed_org_suppliers();

/* Backfill ingredient cost status */
UPDATE public.ingredients SET updated_at = updated_at;

/* Ask conversations */
CREATE TABLE public.ask_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ask_threads_one_active ON public.ask_threads(user_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE ON public.ask_threads TO authenticated;
GRANT ALL ON public.ask_threads TO service_role;
ALTER TABLE public.ask_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own threads read" ON public.ask_threads FOR SELECT TO authenticated USING (user_id = auth.uid() AND organisation_id = public.current_organisation_id());
CREATE POLICY "Own threads insert" ON public.ask_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND organisation_id = public.current_organisation_id());
CREATE POLICY "Own threads update" ON public.ask_threads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_ask_threads_updated BEFORE UPDATE ON public.ask_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ask_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ask_threads(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ask_messages_thread ON public.ask_messages(thread_id, created_at);
GRANT SELECT, INSERT ON public.ask_messages TO authenticated;
GRANT ALL ON public.ask_messages TO service_role;
ALTER TABLE public.ask_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages read" ON public.ask_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own messages insert" ON public.ask_messages FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.ask_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
);
