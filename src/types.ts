/**
 * Shape of one nutrition label's data, matching the 2014 sample schema (the
 * pre-2016 FDA label, which is why `calories_from_fat` exists here).
 *
 * Nutrient amounts are `number | null`: `null` means "not provided" and the row
 * is omitted, while `0` is a real measured zero rendered as "0g". The two must
 * never be conflated, including after scaling.
 *
 * Metadata fields (names, serving size, servings per container) describe the
 * package and are never multiplied by the serving stepper.
 */
export interface NutritionData {
  item_name: string;
  brand_name?: string;
  ingredients?: string;

  calories: number;
  calories_from_fat: number | null;

  total_fat: number | null;
  saturated_fat: number | null;
  cholesterol: number | null;
  sodium: number | null;
  total_carbohydrate: number | null;
  dietary_fiber: number | null;
  sugars: number | null;
  protein: number | null;

  /** Vitamins and minerals are supplied directly as percent Daily Value. */
  vitamin_a_dv: number | null;
  vitamin_c_dv: number | null;
  calcium_dv: number | null;
  iron_dv: number | null;

  /** Static label metadata. Not affected by the serving multiplier. */
  servings_per_container: number;
  serving_size_qty: number;
  serving_size_unit: string;
}

/**
 * Minimal runtime guard for data arriving over the wire. It checks the required
 * scalar fields a usable label cannot do without; missing optional nutrients are
 * allowed (they simply render as "not provided"). Used by the data controller to
 * turn schema-mismatched JSON into an accessible error rather than a broken
 * render.
 */
export function isNutritionData(value: unknown): value is NutritionData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.item_name === 'string' &&
    typeof v.calories === 'number' &&
    Number.isFinite(v.calories) &&
    typeof v.servings_per_container === 'number' &&
    typeof v.serving_size_qty === 'number' &&
    typeof v.serving_size_unit === 'string'
  );
}
