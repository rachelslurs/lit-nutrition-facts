import type { NutritionData } from './types';

/**
 * Pre-2016 FDA Daily Values for a 2,000 calorie diet, in the units used by the
 * sample schema (grams except sodium and cholesterol in milligrams). These back
 * the macro-nutrient percent Daily Value column.
 *
 * NOTE: real FDA %DV math has nuances this POC does not model (rounding to
 * specific increments, "less than" thresholds, added-sugars handling). Simple
 * proportional rounding is sufficient here and is called out so a reader knows
 * it is a deliberate simplification, not an oversight.
 */
export const DAILY_VALUES = {
  total_fat: 65, // g
  saturated_fat: 20, // g
  cholesterol: 300, // mg
  sodium: 2400, // mg
  total_carbohydrate: 300, // g
  dietary_fiber: 25, // g
} as const;

export type DailyValueKey = keyof typeof DAILY_VALUES;

/** Per-serving amounts scaled by the stepper, rounded to one decimal place. */
const PER_SERVING_AMOUNT_KEYS = [
  'total_fat',
  'saturated_fat',
  'cholesterol',
  'sodium',
  'total_carbohydrate',
  'dietary_fiber',
  'sugars',
  'protein',
] as const;

/** Fields supplied directly as percent Daily Value; they scale linearly too. */
const PER_SERVING_DV_KEYS = [
  'vitamin_a_dv',
  'vitamin_c_dv',
  'calcium_dv',
  'iron_dv',
] as const;

const round1 = (n: number): number => Math.round(n * 10) / 10;
const roundInt = (n: number): number => Math.round(n);

/** Scale a nullable amount while preserving null ("not provided") exactly. */
function scaleNullable(
  value: number | null,
  servings: number,
  round: (n: number) => number,
): number | null {
  return value === null ? null : round(value * servings);
}

/**
 * Pure scaling of a label by a serving multiplier. Multiplies every per-serving
 * amount (and the directly-supplied vitamin %DVs) by `servings`, rounding to
 * kill floating-point artifacts, and leaves package metadata (names, serving
 * size, servings per container) untouched.
 *
 * `null` stays `null` and a real `0` stays `0`: the two are never conflated.
 */
export function scaleFacts(facts: NutritionData, servings: number): NutritionData {
  const scaled: NutritionData = { ...facts };

  scaled.calories = roundInt(facts.calories * servings);
  scaled.calories_from_fat = scaleNullable(facts.calories_from_fat, servings, roundInt);

  for (const key of PER_SERVING_AMOUNT_KEYS) {
    scaled[key] = scaleNullable(facts[key], servings, round1);
  }
  for (const key of PER_SERVING_DV_KEYS) {
    scaled[key] = scaleNullable(facts[key], servings, roundInt);
  }

  return scaled;
}

/**
 * Percent Daily Value for a macro nutrient, computed from the (already scaled)
 * amount and the reference Daily Value. Returns `null` for not-provided amounts
 * so the caller can omit the cell, and is allowed to exceed 100% at high serving
 * counts.
 */
export function dailyValuePercent(
  key: DailyValueKey,
  amount: number | null,
): number | null {
  if (amount === null) return null;
  return Math.round((amount / DAILY_VALUES[key]) * 100);
}
