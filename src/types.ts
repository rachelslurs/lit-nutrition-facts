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
/**
 * Optional numeric nutrient fields. Each may be omitted or null ("not
 * provided"); when present it must be a finite number. A string or non-finite
 * value is treated as a schema mismatch rather than silently coerced.
 */
const OPTIONAL_NUTRIENT_KEYS = [
  'calories_from_fat',
  'total_fat',
  'saturated_fat',
  'cholesterol',
  'sodium',
  'total_carbohydrate',
  'dietary_fiber',
  'sugars',
  'protein',
  'vitamin_a_dv',
  'vitamin_c_dv',
  'calcium_dv',
  'iron_dv',
] as const;

const isFiniteNumber = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);

const isOptionalNutrient = (x: unknown): boolean =>
  x === null || x === undefined || isFiniteNumber(x);

export function isNutritionData(value: unknown): value is NutritionData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.item_name === 'string' &&
    isFiniteNumber(v.calories) &&
    isFiniteNumber(v.servings_per_container) &&
    isFiniteNumber(v.serving_size_qty) &&
    typeof v.serving_size_unit === 'string' &&
    OPTIONAL_NUTRIENT_KEYS.every((key) => isOptionalNutrient(v[key]))
  );
}
