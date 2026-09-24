import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CalcGraph, CalcIngredient, CalcVersion } from "./recipe-calc";
import type { BaseUnit } from "./units";

export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];
export type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeVersionRow = Database["public"]["Tables"]["recipe_versions"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["recipe_production_profiles"]["Row"];
export type AllergenRow = Database["public"]["Tables"]["allergens"]["Row"];

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const allergensQuery = queryOptions({
  queryKey: ["allergens"],
  queryFn: async () =>
    unwrap(await supabase.from("allergens").select("*").order("sort_order")) as AllergenRow[],
});

export type IngredientWithAllergens = IngredientRow & {
  ingredient_allergens: { allergen_id: string; allergen: { id: string; name: string } | null }[];
};

export const ingredientsQuery = queryOptions({
  queryKey: ["ingredients"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("ingredients")
        .select("*, ingredient_allergens(allergen_id, allergen:allergens(id, name))")
        .order("name"),
    ) as IngredientWithAllergens[],
});

export const ingredientQuery = (id: string) =>
  queryOptions({
    queryKey: ["ingredients", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("ingredients")
          .select("*, ingredient_allergens(allergen_id, allergen:allergens(id, name))")
          .eq("id", id)
          .maybeSingle(),
      ) as IngredientWithAllergens | null,
  });

export type RecipeWithVersion = RecipeRow & {
  active_version: RecipeVersionRow | null;
};

export const recipesQuery = queryOptions({
  queryKey: ["recipes"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("recipes")
        .select("*, active_version:recipe_versions!recipes_active_version_fkey(*)")
        .order("name"),
    ) as RecipeWithVersion[],
});

export const recipeQuery = (id: string) =>
  queryOptions({
    queryKey: ["recipes", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("recipes")
          .select("*, active_version:recipe_versions!recipes_active_version_fkey(*)")
          .eq("id", id)
          .maybeSingle(),
      ) as RecipeWithVersion | null,
  });

export const recipeVersionsQuery = (recipeId: string) =>
  queryOptions({
    queryKey: ["recipe-versions", recipeId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("recipe_versions")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("version_number", { ascending: false }),
      ) as RecipeVersionRow[],
  });

export const profilesQuery = (recipeId: string) =>
  queryOptions({
    queryKey: ["recipe-profiles", recipeId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("recipe_production_profiles")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("created_at"),
      ) as ProfileRow[],
  });

/** Whole-library graph used for deterministic scaling, costing and allergens. */
export const graphQuery = queryOptions({
  queryKey: ["recipe-graph"],
  queryFn: () => loadCalcGraph(supabase),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCalcGraph(client: { from: (t: string) => any }): Promise<CalcGraph> {
  {
    const [ings, versions] = await Promise.all([
      client
        .from("ingredients")
        .select(
          "id, name, base_unit, yield_percentage, current_unit_cost, ingredient_allergens(allergen:allergens(name))",
        ),
      client
        .from("recipe_versions")
        .select(
          "id, recipe_id, version_number, base_yield_quantity, base_yield_unit, default_portion_quantity, recipe:recipes!recipe_versions_recipe_id_fkey(name), recipe_ingredients(id, ingredient_id, quantity, prep_note, sort_order), recipe_components!recipe_components_parent_recipe_version_id_fkey(id, child_recipe_version_id, quantity, sort_order)",
        ),
    ]);
    if (ings.error) throw new Error(ings.error.message);
    if (versions.error) throw new Error(versions.error.message);

    const ingredients: Record<string, CalcIngredient> = {};
    for (const i of ings.data as unknown as Array<Record<string, unknown>>) {
      ingredients[i["id"] as string] = {
        id: i["id"] as string,
        name: i["name"] as string,
        base_unit: i["base_unit"] as BaseUnit,
        yield_percentage: Number(i["yield_percentage"]),
        current_unit_cost:
          i["current_unit_cost"] === null || i["current_unit_cost"] === undefined
            ? null
            : Number(i["current_unit_cost"]),
        allergens: (
          (i["ingredient_allergens"] as { allergen: { name: string } | null }[] | null) ?? []
        )
          .map((a) => a.allergen?.name)
          .filter((n): n is string => !!n),
      };
    }

    const vmap: Record<string, CalcVersion> = {};
    for (const v of versions.data as unknown as Array<Record<string, unknown>>) {
      vmap[v["id"] as string] = {
        id: v["id"] as string,
        recipe_id: v["recipe_id"] as string,
        recipe_name: ((v["recipe"] as { name: string } | null)?.name ?? "Recipe") as string,
        version_number: Number(v["version_number"]),
        base_yield_quantity: Number(v["base_yield_quantity"]),
        base_yield_unit: v["base_yield_unit"] as BaseUnit,
        default_portion_quantity:
          v["default_portion_quantity"] === null ? null : Number(v["default_portion_quantity"]),
        ingredients: (
          (v["recipe_ingredients"] as Array<Record<string, unknown>> | null) ?? []
        ).map((ri) => ({
          id: ri["id"] as string,
          ingredient_id: ri["ingredient_id"] as string,
          quantity: Number(ri["quantity"]),
          prep_note: (ri["prep_note"] as string | null) ?? null,
          sort_order: Number(ri["sort_order"] ?? 0),
        })),
        components: ((v["recipe_components"] as Array<Record<string, unknown>> | null) ?? []).map(
          (rc) => ({
            id: rc["id"] as string,
            child_recipe_version_id: rc["child_recipe_version_id"] as string,
            quantity: Number(rc["quantity"]),
            sort_order: Number(rc["sort_order"] ?? 0),
          }),
        ),
      };
    }
    return { ingredients, versions: vmap };
  }
}
