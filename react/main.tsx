import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/demo/demo.css';
// Side-effect import registers the element; the type import stays separate.
import '../src/nutrition-facts';
import type { NutritionFacts, NfServingsChangeDetail } from '../src/nutrition-facts';

// Teach JSX about the custom element and the attributes this demo sets.
type NutritionFactsProps = React.DetailedHTMLProps<
  React.HTMLAttributes<NutritionFacts>,
  NutritionFacts
> & {
  src?: string;
  name?: string;
  'hide-stepper'?: boolean;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'nutrition-facts': NutritionFactsProps;
    }
  }
}

const DATA_URL = `${import.meta.env.BASE_URL}data/granola-honey-almond.json`;

function App(): React.JSX.Element {
  const ref = useRef<NutritionFacts>(null);
  const [servings, setServings] = useState(1);
  const [calories, setCalories] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // React does not bind arbitrary custom events through JSX props (there is no
    // onNfServingsChange), so wire it the platform way: grab the element with a
    // ref and addEventListener. This seam between a framework's synthetic events
    // and the platform's real ones is the interop friction worth knowing.
    const onServingsChange = (event: Event) => {
      const { detail } = event as CustomEvent<NfServingsChangeDetail>;
      setServings(detail.servings);
      setCalories(detail.scaledFacts.calories);
    };

    el.addEventListener('nf-servings-change', onServingsChange);
    return () => el.removeEventListener('nf-servings-change', onServingsChange);
  }, []);

  return (
    <main>
      <h1>nutrition-facts in React</h1>
      <p className="tagline">
        Same component, consumed from React. The serving stepper fires a{' '}
        <code>nf-servings-change</code> event, wired here through a ref and addEventListener.
      </p>

      <nutrition-facts ref={ref} src={DATA_URL} name="servings"></nutrition-facts>

      <p className="output" aria-live="polite">
        Servings: <strong>{servings}</strong> &middot; Scaled calories:{' '}
        <strong>{calories ?? 'n/a'}</strong>
      </p>

      <p className="links">
        <a href="../">Back to the vanilla demo</a>
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
