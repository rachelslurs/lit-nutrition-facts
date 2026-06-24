import './demo.css';
// Side-effect import registers the custom element. The type-only import below
// must stay separate: if NutritionFacts were imported as a value but used only
// in type position, the registration side effect would be tree-shaken away.
import '../nutrition-facts';
import type { NutritionFacts } from '../nutrition-facts';

/**
 * Vanilla showcase. The element takes data declaratively; the "pick a dataset"
 * affordance lives here in the demo, not in the component. Changing the select
 * swaps the element's `src`, which the data controller re-fetches reactively.
 */
const DATASETS = [
  { label: 'Cherry Cola', file: 'cola-cherry.json' },
  { label: 'Honey Almond Granola', file: 'granola-honey-almond.json' },
  { label: 'Plain Whole Milk Yogurt', file: 'yogurt-plain-whole-milk.json' },
];

// Base-prefixed so the same code works in dev and under the Pages subpath.
const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

const label = document.querySelector<NutritionFacts>('#label')!;
const select = document.querySelector<HTMLSelectElement>('#dataset')!;
const form = document.querySelector<HTMLFormElement>('#serving-form')!;
const output = document.querySelector<HTMLOutputElement>('#form-output')!;
const markup = document.querySelector<HTMLElement>('#markup-preview')!;

for (const dataset of DATASETS) {
  const option = document.createElement('option');
  option.value = dataset.file;
  option.textContent = dataset.label;
  select.append(option);
}

// The authoring markup a consumer would write for the selected dataset. Set via
// textContent so the angle brackets render as literal text, not parsed HTML.
const markupFor = (file: string) =>
  `<nutrition-facts\n  src="data/${file}"\n  name="servings"\n></nutrition-facts>`;

function applyDataset(file: string): void {
  label.src = dataUrl(file);
  markup.textContent = markupFor(file);
}

applyDataset(DATASETS[0].file);
select.addEventListener('change', () => applyDataset(select.value));

// The element is form-associated, so the surrounding native form posts its
// serving count with no extra wiring. Log the resulting FormData.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const entries = [...new FormData(form).entries()];
  output.textContent = entries.length
    ? entries.map(([name, value]) => `${name} = ${value}`).join('\n')
    : '(no named fields submitted)';
});
