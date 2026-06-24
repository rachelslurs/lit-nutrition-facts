import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { NutritionData } from './types';
import { scaleFacts, dailyValuePercent, type DailyValueKey } from './scale';
import { NutritionDataController } from './nutrition-data-controller';

/** Numeric nutrient fields that carry a measured amount. */
type NumericNutrientKey =
  | 'total_fat'
  | 'saturated_fat'
  | 'cholesterol'
  | 'sodium'
  | 'total_carbohydrate'
  | 'dietary_fiber'
  | 'sugars'
  | 'protein';

interface MacroRow {
  key: NumericNutrientKey;
  label: string;
  unit: string;
  /** Daily Value reference key, or null when the old label shows no %DV. */
  dv: DailyValueKey | null;
  /** Sub-nutrient rendered indented under its parent. */
  sub: boolean;
}

/** Macro rows in FDA label order; sub-nutrients are indented under their parent. */
const MACRO_ROWS: readonly MacroRow[] = [
  { key: 'total_fat', label: 'Total Fat', unit: 'g', dv: 'total_fat', sub: false },
  { key: 'saturated_fat', label: 'Saturated Fat', unit: 'g', dv: 'saturated_fat', sub: true },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 'cholesterol', sub: false },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 'sodium', sub: false },
  { key: 'total_carbohydrate', label: 'Total Carbohydrate', unit: 'g', dv: 'total_carbohydrate', sub: false },
  { key: 'dietary_fiber', label: 'Dietary Fiber', unit: 'g', dv: 'dietary_fiber', sub: true },
  { key: 'sugars', label: 'Sugars', unit: 'g', dv: null, sub: true },
  { key: 'protein', label: 'Protein', unit: 'g', dv: null, sub: false },
];

type VitaminKey = 'vitamin_a_dv' | 'vitamin_c_dv' | 'calcium_dv' | 'iron_dv';

const VITAMIN_ROWS: readonly { key: VitaminKey; label: string }[] = [
  { key: 'vitamin_a_dv', label: 'Vitamin A' },
  { key: 'vitamin_c_dv', label: 'Vitamin C' },
  { key: 'calcium_dv', label: 'Calcium' },
  { key: 'iron_dv', label: 'Iron' },
];

/** Detail payload for the `nf-servings-change` event. */
export interface NfServingsChangeDetail {
  servings: number;
  scaledFacts: NutritionData;
}

/**
 * `<nutrition-facts>` renders an FDA-style nutrition label from declarative data.
 *
 * Data comes in declaratively, never via a picker baked into the element: set the
 * `facts` property directly, or point `src` at a JSON URL (fetched by the data
 * controller, wired in a later step). The label is structured semantically: the
 * serving and calorie header is content, and only the nutrient grid is a real
 * `<table>` with a caption and row/column headers.
 */
@customElement('nutrition-facts')
export class NutritionFacts extends LitElement {
  /** Nutrition data supplied directly. Property-only; never reflected. */
  @property({ attribute: false }) facts?: NutritionData;

  /** JSON URL to fetch. Watched by the data controller. */
  @property({ type: String, reflect: true }) src?: string;

  /** Serving multiplier and form value driver. */
  @property({ type: Number, reflect: true }) servings = 1;

  /** Form field name used when the element participates in a form. */
  @property({ type: String }) name?: string;

  /** Stepper bounds and increment. */
  @property({ type: Number }) min = 0.25;
  @property({ type: Number }) max = 99;
  @property({ type: Number }) step = 0.25;

  /** Disables the stepper. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Pure-display mode: render the label without the serving stepper. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-stepper' })
  hideStepper = false;

  /** Owns fetching, loading, and error state when driven by `src`. */
  private readonly data = new NutritionDataController(this);

  static override styles = css`
    :host {
      /* Public theming contract, each with an FDA-label default. */
      --_font: var(--nf-font-family, 'Helvetica Neue', Helvetica, Arial, sans-serif);
      --_text: var(--nf-text-color, #111);
      --_bg: var(--nf-background, #fff);
      --_border: var(--nf-border-color, #111);
      --_thick: var(--nf-thick-rule, 8px);
      --_thin: var(--nf-thin-rule, 1px);
      --_accent: var(--nf-accent, #111);
      --_max: var(--nf-max-width, 320px);

      display: block;
      box-sizing: border-box;
      max-width: var(--_max);
      color: var(--_text);
      background: var(--_bg);
      font-family: var(--_font);
      line-height: 1.3;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .label {
      border: var(--_thin) solid var(--_border);
      background: var(--_bg);
      padding: 0.5rem 0.625rem;
    }

    .title {
      margin: 0;
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .item-name {
      margin: 0.15rem 0 0;
      font-size: 0.95rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .brand {
      font-weight: 400;
      opacity: 0.8;
    }

    .serving {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .serving:first-of-type {
      margin-top: 0.35rem;
    }

    .rule {
      border: 0;
      border-top: var(--_thin) solid var(--_border);
      margin: 0.35rem 0;
    }
    .rule.thick {
      border-top-width: var(--_thick);
    }
    .rule.medium {
      border-top-width: 4px;
    }

    .stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin: 0.4rem 0;
      font-size: 0.85rem;
    }
    .stepper label {
      font-weight: 700;
    }
    .stepper input {
      inline-size: 5rem;
      font: inherit;
      padding: 0.2rem 0.35rem;
      color: var(--_text);
      background: var(--_bg);
      border: var(--_thin) solid var(--_border);
      border-radius: 2px;
    }
    .stepper input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .calories {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      column-gap: 0.5rem;
    }
    .calories-label {
      font-size: 1.05rem;
      font-weight: 800;
    }
    .calories-value {
      margin-left: auto;
      font-size: 2rem;
      font-weight: 800;
    }
    .calories-fat {
      flex-basis: 100%;
      text-align: right;
      font-size: 0.8rem;
    }

    table.nutrients {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .nutrients th,
    .nutrients td {
      padding: 0.15rem 0;
      text-align: left;
      vertical-align: baseline;
      border-top: var(--_thin) solid var(--_border);
    }
    .nutrients thead th {
      border-top: 0;
    }
    .nutrients .dv-head {
      text-align: right;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .nutrients th[scope='row'] {
      font-weight: 700;
    }
    .nutrients tr.sub th[scope='row'] {
      font-weight: 400;
      padding-left: 1.25rem;
    }
    .nutrients td.amount {
      width: 1%;
      white-space: nowrap;
      padding-left: 0.35rem;
    }
    .nutrients td.dv {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }

    .vitamins {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 0.8rem;
    }
    .vitamins li {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.15rem 0;
      border-top: var(--_thin) solid var(--_border);
    }
    .vitamins li:first-child {
      border-top: 0;
    }

    .footnote {
      margin: 0.4rem 0 0;
      font-size: 0.7rem;
    }

    .ingredients {
      margin: 0.5rem 0 0;
      font-size: 0.72rem;
      overflow-wrap: anywhere;
    }
    .ingredients-label {
      font-weight: 700;
    }

    .empty {
      font-size: 0.85rem;
      color: var(--_text);
    }

    .status {
      margin: 0;
      padding: 1rem 0.25rem;
      font-size: 0.9rem;
      text-align: center;
    }
    .status.error {
      font-weight: 700;
      /* A left rule, not color alone, signals the error state. */
      border-left: 4px solid var(--_accent);
      padding-left: 0.75rem;
      text-align: left;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  `;

  /*
   * Precedence is a temporal state machine, not a fixed "facts beats src":
   *  - inline `facts` wins, suppresses fetching, and aborts any in-flight request
   *  - a `src` change with no inline facts (re)fetches
   *  - clearing `facts` while `src` is still set re-fetches from src
   * Last write wins.
   */
  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('facts') && !changed.has('src')) return;

    if (this.facts !== undefined) {
      // Inline data takes over: stop the controller so a later facts-clear
      // re-fetches cleanly (reset clears currentSrc).
      if (changed.has('facts')) this.data.reset();
    } else {
      // No inline facts: the controller drives display from src.
      void this.data.setSrc(this.src);
    }
  }

  /** Inline facts win; otherwise fall back to whatever the controller fetched. */
  private resolveFacts(): NutritionData | undefined {
    return this.facts ?? this.data.facts;
  }

  /**
   * Coerce raw input into a valid serving count. Empty or non-numeric input
   * keeps the current value; out-of-range values clamp to [min, max].
   */
  private clampServings(raw: string): number {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return this.servings;
    return Math.min(this.max, Math.max(this.min, parsed));
  }

  /** Handle a committed (not per-keystroke) change from the stepper input. */
  private onServingsCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const next = this.clampServings(input.value);
    // Reflect the clamped value back so empty/garbage/out-of-range input snaps.
    input.value = String(next);
    if (next === this.servings) return;
    this.servings = next;
    this.commitServings();
  }

  /** Fire nf-servings-change with the freshly scaled data. */
  private commitServings(): void {
    const base = this.resolveFacts();
    if (!base) return;
    const detail: NfServingsChangeDetail = {
      servings: this.servings,
      scaledFacts: scaleFacts(base, this.servings),
    };
    this.dispatchEvent(
      new CustomEvent<NfServingsChangeDetail>('nf-servings-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderStepper() {
    // The <label> lives inside the shadow root with its <input>: native label
    // association does not cross the shadow boundary, so an outside <label for>
    // would never connect to this control.
    return html`
      <div class="stepper" part="stepper">
        <label for="servings-input">Servings</label>
        <input
          id="servings-input"
          type="number"
          inputmode="decimal"
          .value=${String(this.servings)}
          min=${this.min}
          max=${this.max}
          step=${this.step}
          ?disabled=${this.disabled}
          aria-label="Number of servings"
          @change=${this.onServingsCommit}
        />
      </div>
    `;
  }

  private formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }

  private renderNutrientRow(facts: NutritionData, row: MacroRow) {
    const amount = facts[row.key];
    // null means "not provided": omit the row entirely. A real 0 still renders.
    if (amount === null) return nothing;

    const dv = row.dv !== null ? dailyValuePercent(row.dv, amount) : null;
    return html`
      <tr class=${row.sub ? 'sub' : ''}>
        <th scope="row">${row.label}</th>
        <td class="amount">${this.formatAmount(amount)}${row.unit}</td>
        <td class="dv">${dv !== null ? `${dv}%` : ''}</td>
      </tr>
    `;
  }

  private renderVitamins(facts: NutritionData) {
    const items = VITAMIN_ROWS.map((v) => ({ label: v.label, value: facts[v.key] })).filter(
      (v): v is { label: string; value: number } => v.value !== null,
    );
    if (items.length === 0) return nothing;
    return html`
      <ul class="vitamins">
        ${items.map(
          (v) => html`
            <li>
              <span class="vitamin-name">${v.label}</span>
              <span class="vitamin-dv">${v.value}%</span>
            </li>
          `,
        )}
      </ul>
    `;
  }

  override render() {
    const base = this.resolveFacts();

    // Controller status only matters when src is driving and there is nothing
    // better to show; inline facts always win above.
    if (!base && this.data.error) {
      return html`<section class="label" part="label">
        <p class="status error" role="alert">${this.data.error}</p>
      </section>`;
    }
    if (!base && this.data.loading) {
      return html`<section class="label" part="label" aria-busy="true">
        <p class="status" role="status">Loading nutrition data…</p>
      </section>`;
    }
    if (!base) {
      return html`<section class="label empty" part="label">
        <p>No nutrition data provided.</p>
      </section>`;
    }

    // Display values are the per-serving data scaled by the stepper. Metadata
    // (names, serving size, servings per container) is left untouched.
    const facts = scaleFacts(base, this.servings);

    return html`
      <section
        class="label"
        part="label"
        role="region"
        aria-label="Nutrition Facts for ${facts.item_name}"
      >
        <header class="header">
          <h2 class="title" part="title">Nutrition Facts</h2>
          <p class="item-name">
            ${facts.item_name}${facts.brand_name
              ? html` <span class="brand">${facts.brand_name}</span>`
              : nothing}
          </p>
          <div class="serving" part="serving-size">
            <span>Serving Size</span>
            <span>${facts.serving_size_qty} ${facts.serving_size_unit}</span>
          </div>
          <div class="serving">
            <span>Servings Per Container</span>
            <span>${facts.servings_per_container}</span>
          </div>
        </header>

        ${this.hideStepper ? nothing : this.renderStepper()}

        <hr class="rule thick" />

        <div class="calories" part="calories">
          <span class="calories-label">Calories</span>
          <span class="calories-value">${this.formatAmount(facts.calories)}</span>
          ${facts.calories_from_fat !== null
            ? html`<span class="calories-fat"
                >Calories from Fat ${this.formatAmount(facts.calories_from_fat)}</span
              >`
            : nothing}
        </div>

        <hr class="rule medium" />

        <table class="nutrients" part="nutrient-table">
          <caption class="visually-hidden">
            Nutrition facts per serving
          </caption>
          <thead>
            <tr>
              <th scope="col" class="visually-hidden">Nutrient</th>
              <th scope="col" class="visually-hidden">Amount per serving</th>
              <th scope="col" class="dv-head">% Daily Value*</th>
            </tr>
          </thead>
          <tbody>
            ${MACRO_ROWS.map((row) => this.renderNutrientRow(facts, row))}
          </tbody>
        </table>

        <hr class="rule thick" />

        ${this.renderVitamins(facts)}

        <p class="footnote">* Percent Daily Values are based on a 2,000 calorie diet.</p>

        ${facts.ingredients
          ? html`<p class="ingredients">
              <span class="ingredients-label">Ingredients:</span> ${facts.ingredients}
            </p>`
          : nothing}

        <slot name="footer"></slot>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nutrition-facts': NutritionFacts;
  }
}
