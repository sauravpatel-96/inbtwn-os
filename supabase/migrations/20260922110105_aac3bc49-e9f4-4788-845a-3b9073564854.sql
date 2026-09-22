-- ===== enums =====
CREATE TYPE public.base_unit AS ENUM ('g','ml','each');

-- ===== allergens (shared reference) =====
CREATE TABLE public.allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allergens TO authenticated;
GRANT ALL ON public.allergens TO service_role;
ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allergens readable" ON public.allergens FOR SELECT TO authenticated USING (true);

INSERT INTO public.allergens (code, name, sort_order) VALUES
 ('celery','Celery',1),
 ('gluten','Cereals containing gluten',2),
 ('crustaceans','Crustaceans',3),
 ('eggs','Eggs',4),
 ('fish','Fish',5),
 ('lupin','Lupin',6),
 ('milk','Milk',7),
 ('molluscs','Molluscs',8),
 ('mustard','Mustard',9),
 ('tree_nuts','Tree nuts',10),
 ('peanuts','Peanuts',11),
 ('sesame','Sesame',12),
 ('soya','Soya',13),
 ('sulphites','Sulphur dioxide / sulphites',14);

-- ===== ingredients =====
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  base_unit public.base_unit NOT NULL DEFAULT 'g',
  yield_percentage numeric NOT NULL DEFAULT 100 CHECK (yield_percentage > 0 AND yield_percentage <= 100),
  current_unit_cost numeric CHECK (current_unit_cost IS NULL OR current_unit_cost >= 0),
  cost_price numeric CHECK (cost_price IS NULL OR cost_price >= 0),
  cost_quantity numeric CHECK (cost_quantity IS NULL OR cost_quantity > 0),
  cost_unit text,
  default_supplier_id uuid,
  track_inventory boolean NOT NULL DEFAULT false,
  notes text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org ingredients select" ON public.ingredients FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org ingredients insert" ON public.ingredients FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org ingredients update" ON public.ingredients FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org ingredients delete" ON public.ingredients FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX idx_ingredients_org ON public.ingredients(organisation_id);
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ingredient allergens =====
CREATE TABLE public.ingredient_allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES public.allergens(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingredient_id, allergen_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredient_allergens TO authenticated;
GRANT ALL ON public.ingredient_allergens TO service_role;
ALTER TABLE public.ingredient_allergens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org ing allergens select" ON public.ingredient_allergens FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org ing allergens insert" ON public.ingredient_allergens FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org ing allergens delete" ON public.ingredient_allergens FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

-- ===== recipes =====
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  cuisine text,
  description text,
  active_version_id uuid,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org recipes select" ON public.recipes FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipes insert" ON public.recipes FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipes update" ON public.recipes FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipes delete" ON public.recipes FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== recipe versions =====
CREATE TABLE public.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  base_yield_quantity numeric NOT NULL CHECK (base_yield_quantity > 0),
  base_yield_unit public.base_unit NOT NULL DEFAULT 'g',
  default_portion_quantity numeric CHECK (default_portion_quantity IS NULL OR default_portion_quantity > 0),
  default_portion_unit public.base_unit,
  default_buffer_percentage numeric NOT NULL DEFAULT 5 CHECK (default_buffer_percentage >= 0),
  method text,
  change_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_versions TO authenticated;
GRANT ALL ON public.recipe_versions TO service_role;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org recipe versions select" ON public.recipe_versions FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe versions insert" ON public.recipe_versions FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe versions update" ON public.recipe_versions FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe versions delete" ON public.recipe_versions FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
ALTER TABLE public.recipes ADD CONSTRAINT recipes_active_version_fkey FOREIGN KEY (active_version_id) REFERENCES public.recipe_versions(id) ON DELETE SET NULL;

-- ===== recipe ingredients =====
CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  recipe_version_id uuid NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit public.base_unit NOT NULL,
  prep_note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org recipe ingredients select" ON public.recipe_ingredients FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe ingredients insert" ON public.recipe_ingredients FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe ingredients update" ON public.recipe_ingredients FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe ingredients delete" ON public.recipe_ingredients FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX idx_recipe_ingredients_version ON public.recipe_ingredients(recipe_version_id);

-- ===== recipe components =====
CREATE TABLE public.recipe_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  parent_recipe_version_id uuid NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  child_recipe_version_id uuid NOT NULL REFERENCES public.recipe_versions(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit public.base_unit NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_components TO authenticated;
GRANT ALL ON public.recipe_components TO service_role;
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org recipe components select" ON public.recipe_components FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe components insert" ON public.recipe_components FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe components update" ON public.recipe_components FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org recipe components delete" ON public.recipe_components FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE INDEX idx_recipe_components_parent ON public.recipe_components(parent_recipe_version_id);

-- circular dependency guard (recipe-level, across versions)
CREATE OR REPLACE FUNCTION public.check_recipe_component_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _parent_recipe uuid;
  _child_recipe uuid;
  _found boolean;
BEGIN
  SELECT recipe_id INTO _parent_recipe FROM public.recipe_versions WHERE id = NEW.parent_recipe_version_id;
  SELECT recipe_id INTO _child_recipe FROM public.recipe_versions WHERE id = NEW.child_recipe_version_id;
  IF _parent_recipe = _child_recipe THEN
    RAISE EXCEPTION 'A recipe cannot contain itself as a component';
  END IF;
  WITH RECURSIVE descendants AS (
    SELECT rv.recipe_id AS recipe_id
    FROM public.recipe_components rc
    JOIN public.recipe_versions rv ON rv.id = rc.child_recipe_version_id
    JOIN public.recipe_versions pv ON pv.id = rc.parent_recipe_version_id
    WHERE pv.recipe_id = _child_recipe
    UNION
    SELECT rv.recipe_id
    FROM public.recipe_components rc
    JOIN public.recipe_versions rv ON rv.id = rc.child_recipe_version_id
    JOIN public.recipe_versions pv ON pv.id = rc.parent_recipe_version_id
    JOIN descendants d ON d.recipe_id = pv.recipe_id
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE recipe_id = _parent_recipe) INTO _found;
  IF _found THEN
    RAISE EXCEPTION 'Circular recipe dependency: that component already contains this recipe';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recipe_components_cycle_check BEFORE INSERT OR UPDATE ON public.recipe_components FOR EACH ROW EXECUTE FUNCTION public.check_recipe_component_cycle();

-- ===== production profiles =====
CREATE TABLE public.recipe_production_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_style text,
  quantity_per_guest numeric NOT NULL CHECK (quantity_per_guest > 0),
  unit public.base_unit NOT NULL,
  expected_uptake_percentage numeric NOT NULL DEFAULT 100 CHECK (expected_uptake_percentage > 0 AND expected_uptake_percentage <= 100),
  buffer_percentage numeric NOT NULL DEFAULT 5 CHECK (buffer_percentage >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_production_profiles TO authenticated;
GRANT ALL ON public.recipe_production_profiles TO service_role;
ALTER TABLE public.recipe_production_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org profiles select" ON public.recipe_production_profiles FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "org profiles insert" ON public.recipe_production_profiles FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org profiles update" ON public.recipe_production_profiles FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "org profiles delete" ON public.recipe_production_profiles FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER recipe_profiles_updated_at BEFORE UPDATE ON public.recipe_production_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();