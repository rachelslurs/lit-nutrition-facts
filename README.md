# nutrition-facts

A small, framework-agnostic nutrition label web component. Built with Lit. Drops into anything.

## Twelve years later

I first built this component in 2014, at a Google DevFest, in Polymer. ([The original writeup is still up.](https://rachel.fyi/posts/building-a-nutrition-facts-web-component-with-polymer)) Back then web components were a bet, not a baseline. Shadow DOM barely worked outside Chrome, "custom elements" meant a polyfill and a prayer, and the cleanest way to ship an encapsulated UI unit was to reach for Polymer and hope the platform caught up.

It did. So I rebuilt the same component, same sample data (a cherry cola, because continuity), in Lit, to see what twelve years of platform maturity actually buys you. The answer turned out to be more interesting than "the syntax got nicer."

## What changed under the hood

Three things from the 2014 version aged in instructive ways.

**The data layer left the DOM.** The original had a `<nutrition-facts-service>` custom element sitting in the markup whose entire job was to fetch JSON and hand it to the display element. It worked, but a service has no business being a DOM node. In the rebuild it's a Lit reactive controller: a plain class that owns the fetch, the loading state, and the errors, and tells the component to re-render when any of that changes. Same responsibility, no fake element.

**The data source stopped being the component's problem.** The 2014 demo wired a text input and an "Update Facts" button straight into the component. The rebuild takes data declaratively, through a `src` attribute or a `facts` property, and nothing else. Want different data? Set the attribute. The "pick a dataset" affordance lives in the demo page where it belongs, not baked into a reusable element. Drawing that boundary correctly is most of what I learned about components in the years between.

**The platform grew a feature I needed.** The label now has a serving-size stepper, and the chosen serving count submits with a native HTML form, no glue code, because the element is form-associated through `ElementInternals`. That API did not exist in 2014. A custom element that participates in forms like a built-in input is the kind of thing you used to fake badly, or not at all.

## The accessibility part nobody asks about

A nutrition label looks like a table, so the lazy move is to wrap the whole thing in one `<table>` and walk away. Don't. A screen reader then reads the serving header, the calorie count, and the nutrient rows as one undifferentiated grid, which is nonsense.

Only part of the label is actually tabular: the nutrient rows, where each row pairs a nutrient with an amount and a percent daily value. That part gets a real table, with a caption and proper row and column headers. The rest (serving size, calories, the heavy rules) is content, and it's structured as content. The serving stepper is a native number input with a real label, and that label lives inside the shadow root with the input, because label association does not cross the shadow boundary.

It's a small component. It still has opinions.

## Using it in React (and why it needs a ref)

The demo includes a React consumer, and it surfaces a gotcha worth knowing. React doesn't bind arbitrary custom events through JSX props, so you can't just write `onNfServingsChange` and call it done. You grab the element with a ref and `addEventListener` the old-fashioned way. That isn't a Lit problem or a React problem exactly. It's the seam between a framework's event system and the platform's, and knowing where that seam sits matters more than pretending it isn't there.

## TL;DR

Same component, twelve years apart. The interesting part isn't that I rewrote it. It's that the platform finally lets the component be what it always should have been: a self-contained, form-aware, accessible unit you can drop into a plain HTML page or a React app without it caring which.

---

## Install and use

This repo is a portfolio piece rather than a published package, so use it from source:

```sh
git clone https://github.com/rachelslurs/lit-nutrition-facts.git
cd lit-nutrition-facts
npm install
```

Import the element module once (which registers the `<nutrition-facts>` custom element), then use it like any built-in tag. Give it data either declaratively through `src` or imperatively through the `facts` property:

```html
<script type="module" src="/src/nutrition-facts.ts"></script>

<!-- Fetch from a URL -->
<nutrition-facts src="/data/cola-cherry.json" name="servings"></nutrition-facts>
```

```js
// Or hand it a data object directly
import './src/nutrition-facts';

const label = document.querySelector('nutrition-facts');
label.facts = {
  item_name: 'Cola, Cherry',
  calories: 100,
  /* ...the rest of the NutritionData fields... */
};
```

Wrap it in a native `<form>` and the chosen serving count submits as `name=servings` with no extra wiring, because the element is form-associated.

## API reference

### Properties and attributes

| Name | Attribute | Type | Default | Reflects | Notes |
| --- | --- | --- | --- | --- | --- |
| `facts` | (none) | `NutritionData \| undefined` | `undefined` | n/a | Data object, property only. Never reflected. Takes precedence over `src`. |
| `src` | `src` | `string \| undefined` | `undefined` | yes | JSON URL, fetched by the data controller. |
| `servings` | `servings` | `number` | `1` | yes | Serving multiplier and submitted form value. |
| `name` | `name` | `string \| undefined` | `undefined` | no | Form field name for the submitted value. |
| `min` | `min` | `number` | `0.25` | no | Stepper lower bound. |
| `max` | `max` | `number` | `99` | no | Stepper upper bound. |
| `step` | `step` | `number` | `0.25` | no | Stepper increment. |
| `disabled` | `disabled` | `boolean` | `false` | yes | Disables the stepper. A disabled control submits nothing. |
| `hideStepper` | `hide-stepper` | `boolean` | `false` | yes | Pure display mode: render the label with no stepper. |

### CSS custom properties

| Property | Default | Purpose |
| --- | --- | --- |
| `--nf-font-family` | system Helvetica stack | Label typeface. |
| `--nf-text-color` | `#111` | Text color. |
| `--nf-background` | `#fff` | Label background. |
| `--nf-border-color` | `#111` | Border and rule color. |
| `--nf-thick-rule` | `8px` | Heavy separator thickness. |
| `--nf-thin-rule` | `1px` | Light separator thickness. |
| `--nf-accent` | `#111` | Focus outline and error rule. |
| `--nf-max-width` | `320px` | Maximum label width. |

### Parts

`label`, `title`, `serving-size`, `calories`, `nutrient-table`, `stepper`. Structural hooks for external styling, not every row.

### Slots

`footer`: consumer-supplied content such as an allergen note, brand line, or ingredients string.

### Events

`nf-servings-change`: `CustomEvent<{ servings: number; scaledFacts: NutritionData }>`, with `bubbles` and `composed` set. Fired on each committed servings change (on commit, not on every keystroke).

### Data precedence

Precedence is temporal, not a fixed winner. If `facts` is set, it wins, the controller does not fetch, and any request in flight is aborted. If only `src` is set, the controller fetches and populates the label. If `facts` is later cleared while `src` is still set, the label re-fetches from `src`. Last write wins.

### Null versus zero

A nutrient value of `null` means "not provided" and its row is omitted. A real `0` is a measured value and renders as "0g". The two are never conflated, including after scaling, where `null` stays `null` and never becomes `0` or `NaN`.

### Disabled and form submission

A disabled element is non-interactive and submits nothing, matching native form controls, which the browser excludes from the form entry list. Form reset restores the serving count that was authored on the element (its initial value), not a hardcoded default.

## Local development

```sh
npm run dev       # Vite dev server for both demos
npm test          # Vitest unit and DOM suites
npm run typecheck # tsc with no emit
npm run build     # type-check then production build into dist
npm run preview   # serve the production build locally
```

Because the Pages base path is set, the dev and preview servers serve under `/lit-nutrition-facts/`:

- Vanilla showcase: `http://localhost:5173/lit-nutrition-facts/`
- React consumer: `http://localhost:5173/lit-nutrition-facts/react/`

## Build and deploy

`npm run build` emits a multi-page build (the vanilla showcase and the React consumer) into `dist` with base-prefixed asset paths. A GitHub Actions workflow at `.github/workflows/deploy.yml` builds on push to `main` and deploys `dist` with the official Pages actions.

Two things to confirm before the first deploy:

1. The GitHub repository is named `lit-nutrition-facts`, so the Vite `base` of `/lit-nutrition-facts/` matches. If you fork under a different name, update `base` in `vite.config.ts`.
2. In the repository settings, set Pages "Source" to "GitHub Actions".

## Accessibility and testing notes

What is verified automatically (run `npm test`):

- The label uses a single real table scoped to the nutrient grid, with a caption and column and row headers; the serving and calorie header is content, not table markup.
- The region carries an accessible name ("Nutrition Facts for [item name]").
- Null nutrient rows are omitted while a real `0` is kept, and user-ish strings (`item_name`, `ingredients`) are escaped rather than injected.
- The serving stepper scales values, clamps to range, ignores empty or non-numeric input, and fires `nf-servings-change` with the scaled data.
- The form-association mechanism (form value tracking, reset to the authored value, no submission while disabled). happy-dom does not implement `attachInternals` or form-associated submission, so a small test polyfill records the form value; the real native-form round-trip is verified in the browser via the vanilla demo.

Manual checks to run in a real browser (these need a human and were not executed in the headless build environment, so the structure is built to pass them rather than claimed as passed):

- Keyboard only: tab to the stepper and the dataset picker, confirm a visible focus outline and that the stepper steps by `0.25`.
- Screen reader (VoiceOver or NVDA): confirm the live region announces updated totals when servings change, the nutrient table reads with its row and column headers, the region announces as "Nutrition Facts for [item name]", and the error and loading states are announced. Note the live region is scoped to stay quiet on servings changes; switching datasets tears down and re-inserts the region, so check that a dataset switch does not announce the whole label.
- Native form round-trip: submit the form in the vanilla demo, confirm it posts `servings=N`, then reset and confirm the authored value returns.
- Windows High Contrast (forced-colors): confirm the heavy label rules stay visible.
- Print preview: confirm the stepper is dropped and the label prints clean black on white.

The data layer is a reactive controller class (`NutritionDataController`), not a DOM element, which is the modern replacement for the 2014 `<nutrition-facts-service>`. See the narrative above for why that boundary matters.
