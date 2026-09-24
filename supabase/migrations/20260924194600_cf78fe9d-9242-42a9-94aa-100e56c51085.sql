CREATE OR REPLACE FUNCTION public.touch_ingredient_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ing uuid; old_ing uuid;
BEGIN
  IF TG_TABLE_NAME = 'ingredient_purchase_prices' THEN
    SELECT ingredient_id INTO ing FROM ingredient_purchase_options
     WHERE id = COALESCE((to_jsonb(NEW)->>'option_id')::uuid, (to_jsonb(OLD)->>'option_id')::uuid);
  ELSE
    ing := COALESCE((to_jsonb(NEW)->>'ingredient_id')::uuid, (to_jsonb(OLD)->>'ingredient_id')::uuid);
    IF TG_OP = 'UPDATE' THEN
      old_ing := (to_jsonb(OLD)->>'ingredient_id')::uuid;
      IF old_ing IS DISTINCT FROM ing THEN
        UPDATE ingredients SET updated_at = now() WHERE id = old_ing;
      END IF;
    END IF;
  END IF;
  IF ing IS NOT NULL THEN UPDATE ingredients SET updated_at = now() WHERE id = ing; END IF;
  RETURN NULL;
END $function$;