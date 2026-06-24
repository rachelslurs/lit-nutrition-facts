// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    const name = tr.querySelector('th[scope="row"] .nutrient-name')?.textContent?.trim() ?? '';
    const amount = tr.querySelector('th[scope="row"] .nutrient-amount')?.textContent?.trim() ?? '';
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
    expect(el.shadowRoot!.querySelector('.dv-head')?.textContent).toContain('% Daily Value');
    expect(el.shadowRoot!.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(el.shadowRoot!.querySelector('caption')).not.toBeNull();
  });

  it('places each nutrient amount beside its name with % daily value flush right', async () => {
    const el = await mount(cola);
    const rows = rowMap(el);
    expect(rows['Sodium']).toEqual({ amount: '25mg', dv: '1%' });
    const sodiumRow = [...el.shadowRoot!.querySelectorAll('tbody tr')].find((tr) =>
      tr.querySelector('.nutrient-name')?.textContent?.includes('Sodium'),
    );
    expect(sodiumRow?.querySelector('.nutrient-amount')?.textContent).toBe('25mg');
    expect(sodiumRow?.querySelector('td.dv')?.textContent).toBe('1%');
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
    const items = [...el.shadowRoot!.querySelectorAll('.vitamins li .vitamin-dv')].map((span) =>
      span.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toContain('Vitamin A 0%');
    expect(items).toHaveLength(4);
  });

  it('scopes a polite, atomic live region to the changing values, not the controls', async () => {
    const el = await mount(cola);
    const live = el.shadowRoot!.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live!.getAttribute('aria-atomic')).toBe('true');
    expect(live!.querySelector('table')).not.toBeNull();
    expect(live!.querySelector('.calories')).not.toBeNull();
    // The stepper control stays outside the live region so it is not chatty.
    expect(live!.querySelector('.stepper')).toBeNull();
  });

  it('pairs serving metadata with definition lists', async () => {
    const el = await mount(cola);
    const dl = el.shadowRoot!.querySelector('dl.serving-meta');
    expect(dl).not.toBeNull();
    const pairs = [...dl!.querySelectorAll('.serving-row')].map((row) => ({
      term: row.querySelector('dt')?.textContent?.trim(),
      def: row.querySelector('dd')?.textContent?.trim(),
    }));
    expect(pairs).toEqual([
      { term: 'Serving Size', def: '8 fl oz' },
      { term: 'Servings Per Container', def: '6' },
    ]);
  });

  it('pairs calories label and value for assistive text', async () => {
    const el = await mount(cola);
    const value = el.shadowRoot!.querySelector('.calories-value');
    expect(value?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Calories 100');
    expect(value?.querySelector('.visually-hidden')?.textContent).toBe('Calories ');
  });

  it('pairs each vitamin line for assistive text', async () => {
    const el = await mount(cola);
    const first = el.shadowRoot!.querySelector('.vitamins li .vitamin-dv');
    expect(first?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Vitamin A 0%');
  });

  it('renders the product name above the bordered label', async () => {
    const el = await mount(cola);
    const name = el.shadowRoot!.querySelector('.item-name');
    expect(name?.textContent).toContain('Cola, Cherry');
    expect(el.shadowRoot!.querySelector('.label')?.contains(name ?? null)).toBe(false);
  });

  it('escapes user-ish strings rather than injecting markup', async () => {
    const el = await mount({ ...cola, item_name: '<img src=x onerror=alert(1)>' });
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.item-name')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
  });
});

describe('<nutrition-facts> theming, parts, slot, and hide-stepper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes every documented part for external styling', async () => {
    const el = await mount(cola);
    const parts = [...el.shadowRoot!.querySelectorAll('[part]')].map((n) =>
      n.getAttribute('part'),
    );
    for (const p of [
      'item-name',
      'label',
      'title',
      'serving-size',
      'calories',
      'nutrient-table',
      'stepper',
    ]) {
      expect(parts).toContain(p);
    }
  });

  it('hides the stepper in hide-stepper mode while keeping the label', async () => {
    const el = document.createElement('nutrition-facts');
    el.setAttribute('hide-stepper', '');
    el.facts = cola;
    document.body.append(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.stepper')).toBeNull();
    expect(el.shadowRoot!.querySelector('table')).not.toBeNull();
  });

  it('projects consumer content into the footer slot', async () => {
    const el = document.createElement('nutrition-facts');
    el.facts = cola;
    const note = document.createElement('p');
    note.setAttribute('slot', 'footer');
    note.textContent = 'Contains caffeine.';
    el.append(note);
    document.body.append(el);
    await el.updateComplete;

    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="footer"]')!;
    const assigned = slot.assignedNodes().map((n) => n.textContent);
    expect(assigned.join('')).toContain('Contains caffeine.');
  });
});

describe('<nutrition-facts> serving stepper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const stepperInput = (el: NutritionFacts) =>
    el.shadowRoot!.querySelector<HTMLInputElement>('#servings-input')!;

  async function commit(el: NutritionFacts, value: string): Promise<void> {
    const input = stepperInput(el);
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
  }

  it('scales displayed values live on a committed change', async () => {
    const el = await mount(cola);
    await commit(el, '2');

    expect(el.servings).toBe(2);
    const rows = rowMap(el);
    expect(rows['Sodium'].amount).toBe('50mg');
    expect(rows['Total Carbohydrate'].amount).toBe('56g');
  });

  it('fires nf-servings-change (bubbling, composed) with scaled detail', async () => {
    const el = await mount(cola);
    const events: CustomEvent[] = [];
    document.addEventListener('nf-servings-change', (e) => events.push(e as CustomEvent));

    await commit(el, '3');

    expect(events).toHaveLength(1);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(events[0].detail.servings).toBe(3);
    expect(events[0].detail.scaledFacts.sodium).toBe(75);
  });

  it('clamps above max and below min', async () => {
    const el = await mount(cola);

    await commit(el, '500');
    expect(el.servings).toBe(99);
    expect(stepperInput(el).value).toBe('99');

    await commit(el, '0');
    expect(el.servings).toBe(0.25);
  });

  it('keeps the current value on empty or non-numeric input', async () => {
    const el = await mount(cola);
    await commit(el, '2');
    expect(el.servings).toBe(2);

    await commit(el, '');
    expect(el.servings).toBe(2);
    expect(stepperInput(el).value).toBe('2');

    await commit(el, 'abc');
    expect(el.servings).toBe(2);
  });
});

// happy-dom lacks real form-associated-element submission, so these assert the
// mechanism through the recorded form value (see test/setup.ts). The native
// <form> round-trip is verified in the browser via the vanilla demo.
describe('<nutrition-facts> robustness', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('omits a nutrient missing from the data instead of rendering NaN', async () => {
    const withoutSodium: NutritionData = { ...cola };
    delete (withoutSodium as Partial<NutritionData>).sodium;
    const el = await mount(withoutSodium);

    expect(rowMap(el)['Sodium']).toBeUndefined();
    expect(el.shadowRoot!.textContent).not.toContain('NaN');
  });

  it('clamps servings set directly via the property', async () => {
    const el = await mount(cola);

    el.servings = 1000;
    await el.updateComplete;
    await el.updateComplete;
    expect(el.servings).toBe(99);

    el.servings = 0;
    await el.updateComplete;
    await el.updateComplete;
    expect(el.servings).toBe(0.25);
  });

  it('falls back to the default serving count when set non-finite', async () => {
    const el = await mount(cola);

    el.servings = Number.NaN;
    await el.updateComplete;
    await el.updateComplete;
    expect(el.servings).toBe(1);
  });

  it('fires nf-servings-change on form reset so consumers stay in sync', async () => {
    const el = document.createElement('nutrition-facts');
    el.setAttribute('servings', '2');
    el.facts = cola;
    document.body.append(el);
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#servings-input')!;
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.servings).toBe(5);

    const events: CustomEvent[] = [];
    document.addEventListener('nf-servings-change', (e) => events.push(e as CustomEvent));
    el.formResetCallback();
    await el.updateComplete;

    expect(el.servings).toBe(2);
    expect(events).toHaveLength(1);
    expect(events[0].detail.servings).toBe(2);
  });
});

describe('<nutrition-facts> form association', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const formValue = (el: NutritionFacts) => el.__internals?.formValue ?? null;

  const setServings = async (el: NutritionFacts, value: string) => {
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('#servings-input')!;
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
  };

  it('sets the default serving count as the form value without interaction', async () => {
    const el = await mount(cola);
    expect(formValue(el)).toBe('1');
  });

  it('updates the form value on a committed change', async () => {
    const el = await mount(cola);
    await setServings(el, '3');
    expect(formValue(el)).toBe('3');
  });

  it('reflects the name property to the attribute so the field submits', async () => {
    const el = await mount(cola);

    // Submission keys off the name content attribute, so the property must
    // reflect for an imperatively-set name to participate.
    el.name = 'servings';
    await el.updateComplete;
    expect(el.getAttribute('name')).toBe('servings');

    el.name = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('name')).toBe(false);
  });

  it('restores the authored default on form reset', async () => {
    const el = document.createElement('nutrition-facts');
    el.setAttribute('servings', '2');
    el.facts = cola;
    document.body.append(el);
    await el.updateComplete;
    expect(el.servings).toBe(2);

    await setServings(el, '5');
    expect(el.servings).toBe(5);

    el.formResetCallback();
    await el.updateComplete;
    expect(el.servings).toBe(2);
    expect(formValue(el)).toBe('2');
  });

  it('submits nothing while disabled, matching native controls', async () => {
    const el = document.createElement('nutrition-facts');
    el.setAttribute('disabled', '');
    el.facts = cola;
    document.body.append(el);
    await el.updateComplete;

    expect(el.disabled).toBe(true);
    expect(formValue(el)).toBeNull();
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('#servings-input')!.disabled).toBe(true);
  });

  it('mirrors a form-level disable through formDisabledCallback', async () => {
    const el = await mount(cola);
    expect(formValue(el)).toBe('1');

    el.formDisabledCallback(true);
    await el.updateComplete;
    expect(el.disabled).toBe(true);
    expect(formValue(el)).toBeNull();
  });
});

describe('<nutrition-facts> src and facts precedence', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('fetches and renders from src when no inline facts are set', async () => {
    globalThis.fetch = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => cola }) as Response,
    ) as typeof fetch;

    const el = document.createElement('nutrition-facts');
    el.src = '/data/cola-cherry.json';
    document.body.append(el);
    await el.updateComplete;
    await flush();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[role="region"]')?.getAttribute('aria-label')).toContain(
      'Cola, Cherry',
    );
  });

  it('lets inline facts win over src and skips fetching entirely', async () => {
    const fetchSpy = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => cola }) as Response,
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const el = document.createElement('nutrition-facts');
    el.src = '/data/cola-cherry.json';
    el.facts = { ...cola, item_name: 'Inline Wins' };
    document.body.append(el);
    await el.updateComplete;
    await flush();

    expect(el.shadowRoot!.querySelector('.item-name')?.textContent).toContain('Inline Wins');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces a fetch error through an alert role', async () => {
    globalThis.fetch = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response,
    ) as typeof fetch;

    const el = document.createElement('nutrition-facts');
    el.src = '/data/broken.json';
    document.body.append(el);
    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const alert = el.shadowRoot!.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toMatch(/500/);
  });

  it('re-fetches from src when inline facts are later cleared', async () => {
    const fetchSpy = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => cola }) as Response,
    );
    globalThis.fetch = fetchSpy as typeof fetch;

    const el = document.createElement('nutrition-facts');
    el.src = '/data/cola-cherry.json';
    el.facts = { ...cola, item_name: 'Inline Wins' };
    document.body.append(el);
    await el.updateComplete;
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Clear inline facts: the controller should now drive from src.
    el.facts = undefined;
    await el.updateComplete;
    await flush();
    await el.updateComplete;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(el.shadowRoot!.querySelector('.item-name')?.textContent).toContain('Cola, Cherry');
  });
});
