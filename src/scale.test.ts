import { describe, it, expect } from 'vitest';
import { scaleFacts, dailyValuePercent } from './scale';
import type { NutritionData } from './types';

// The 2014 cherry cola, inlined so the suite is self-contained and the null vs
// zero distinction is explicit in the fixture.
const cola: NutritionData = {
  item_name: 'Cola, Cherry',
  brand_name: 'Coke',
  ingredients: 'Carbonated Water, High Fructose Corn Syrup, Caffeine.',
  calories: 100,
  calories_from_fat: 0,
  total_fat: 0,
  saturated_fat: null,
  cholesterol: null,
  sodium: 25,
  total_carbohydrate: 28,
  dietary_fiber: null,
  sugars: 28,
  protein: 0,
  vitamin_a_dv: 0,
  vitamin_c_dv: 0,
  calcium_dv: 0,
  iron_dv: 0,
  servings_per_container: 6,
  serving_size_qty: 8,
  serving_size_unit: 'fl oz',
};

describe('scaleFacts', () => {
  // The single most important correctness property: null is "not provided" and
  // must never become 0 or NaN, while a real 0 must survive as 0.
  it('keeps null as null and 0 as a real zero through scaling', () => {
    const s = scaleFacts(cola, 3);

    expect(s.saturated_fat).toBeNull();
    expect(s.cholesterol).toBeNull();
    expect(s.dietary_fiber).toBeNull();

    expect(s.total_fat).toBe(0);
    expect(s.protein).toBe(0);
    expect(Number.isNaN(s.total_fat)).toBe(false);
  });

  it('multiplies per-serving amounts but leaves metadata untouched', () => {
    const s = scaleFacts(cola, 2);

    expect(s.calories).toBe(200);
    expect(s.sodium).toBe(50);
    expect(s.total_carbohydrate).toBe(56);
    expect(s.sugars).toBe(56);

    expect(s.servings_per_container).toBe(6);
    expect(s.serving_size_qty).toBe(8);
    expect(s.serving_size_unit).toBe('fl oz');
    expect(s.item_name).toBe('Cola, Cherry');
  });

  it('rounds away floating-point artifacts', () => {
    const s = scaleFacts({ ...cola, total_fat: 0.1 }, 3);
    expect(s.total_fat).toBe(0.3); // not 0.30000000000000004
  });

  it('handles fractional serving steps', () => {
    const s = scaleFacts(cola, 0.25);
    expect(s.calories).toBe(25);
    expect(s.sodium).toBe(6.3); // 25 * 0.25 = 6.25, rounded to one decimal
  });

  it('scales directly-supplied percent-DV vitamin fields linearly', () => {
    const s = scaleFacts({ ...cola, calcium_dv: 10 }, 3);
    expect(s.calcium_dv).toBe(30);
  });

  it('does not break on very large serving counts', () => {
    const s = scaleFacts(cola, 99);
    expect(s.calories).toBe(9900);
    expect(Number.isFinite(s.sodium as number)).toBe(true);
  });
});

describe('dailyValuePercent', () => {
  it('recomputes percent daily value from the scaled amount', () => {
    const s = scaleFacts(cola, 2); // 28 * 2 = 56 g carbohydrate
    expect(dailyValuePercent('total_carbohydrate', s.total_carbohydrate)).toBe(19);
  });

  it('allows percent daily value to exceed 100% at high servings', () => {
    const s = scaleFacts(cola, 12); // 28 * 12 = 336 g carbohydrate
    expect(s.total_carbohydrate).toBe(336);
    expect(dailyValuePercent('total_carbohydrate', s.total_carbohydrate)).toBe(112);
  });

  it('returns null for a not-provided nutrient instead of 0%', () => {
    expect(dailyValuePercent('cholesterol', null)).toBeNull();
  });
});
