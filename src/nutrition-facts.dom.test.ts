// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import './nutrition-facts';
import type { NutritionFacts } from './nutrition-facts';
import type { NutritionData } from './types';

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

async function mount(facts: NutritionData): Promise<NutritionFacts> {
  const el = document.createElement('nutrition-facts');
  el.facts = facts;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function rowMap(el: NutritionFacts): Record<string, { amount: string; dv: string }> {
  const root = el.shadowRoot!;
  const out: Record<string, { amount: string; dv: string }> = {};
  for (const tr of root.querySelectorAll('tbody tr')) {
    const name = tr.querySelector('th[scope="row"]')?.textContent?.trim() ?? '';
    const amount = tr.querySelector('td.amount')?.textContent?.trim() ?? '';
    const dv = tr.querySelector('td.dv')?.textContent?.trim() ?? '';
    out[name] = { amount, dv };
  }
  return out;
}

describe('<nutrition-facts> render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders exactly one table, scoped to the nutrient grid', async () => {
    const el = await mount(cola);
    const tables = el.shadowRoot!.querySelectorAll('table');
    expect(tables).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(el.shadowRoot!.querySelector('caption')).not.toBeNull();
  });

  it('gives the region an accessible name from the item', async () => {
    const el = await mount(cola);
    const region = el.shadowRoot!.querySelector('[role="region"]');
    expect(region?.getAttribute('aria-label')).toBe('Nutrition Facts for Cola, Cherry');
  });

  it('omits rows for null nutrients but keeps a real 0', async () => {
    const el = await mount(cola);
    const rows = rowMap(el);

    // null -> omitted
    expect(rows['Saturated Fat']).toBeUndefined();
    expect(rows['Cholesterol']).toBeUndefined();
    expect(rows['Dietary Fiber']).toBeUndefined();

    // real 0 -> kept and shown with its unit
    expect(rows['Total Fat']).toEqual({ amount: '0g', dv: '0%' });
    expect(rows['Protein'].amount).toBe('0g');
    expect(rows['Sodium'].amount).toBe('25mg');
  });

  it('renders vitamins as a non-table list, omitting null entries', async () => {
    const el = await mount(cola);
    const items = [...el.shadowRoot!.querySelectorAll('.vitamins li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toContain('Vitamin A 0%');
    expect(items).toHaveLength(4);
  });

  it('escapes user-ish strings rather than injecting markup', async () => {
    const el = await mount({ ...cola, item_name: '<img src=x onerror=alert(1)>' });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.item-name')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
  });
});
