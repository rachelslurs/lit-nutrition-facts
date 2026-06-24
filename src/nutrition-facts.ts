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

  /**
   * Form field name. Reflected so setting it via the property also writes the
   * `name` content attribute that form submission keys off, matching native
   * form controls. The original API table listed this as non-reflecting, but
   * native-like form participation requires reflection, so this corrects it.
   */
  @property({ type: String, reflect: true }) name?: string;

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

  /** Participate in forms like a native control. */
  static formAssociated = true;
  readonly #internals = this.attachInternals();

  /** The serving count to restore on form reset (the authored initial value). */
  #defaultServings = 1;

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
      background: transparent;
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
      margin: 0 0 0.35rem;
      font-size: 0.95rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .brand {
      font-weight: 400;
      opacity: 0.8;
    }

    .serving-meta {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
    }
    .serving-row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      margin: 0;
    }
    .serving-row + .serving-row {
      margin-top: 0;
    }
    .serving-meta dt,
    .serving-meta dd {
      margin: 0;
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
      table-layout: auto;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .nutrients col.col-dv {
      width: 1%;
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
      padding-bottom: 0.1rem;
    }
    .nutrients .dv-head {
      text-align: right;
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1.15;
      white-space: nowrap;
    }
    .nutrients th[scope='row'] {
      font-weight: 400;
    }
    .nutrients th[scope='row'] .nutrient-name {
      font-weight: 700;
    }
    .nutrients tr.sub th[scope='row'] {
      padding-left: 1.25rem;
    }
    .nutrients tr.sub th[scope='row'] .nutrient-name {
      font-weight: 400;
    }
    .nutrients .nutrient-amount {
      font-weight: 400;
      white-space: nowrap;
    }
    .nutrients .nutrient-name + .nutrient-amount::before {
      content: ' ';
      white-space: pre;
    }
    .nutrients td.dv {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
      padding-left: 0.5rem;
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
    .vitamins .vitamin-dv {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
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

    .footer {
      margin-top: 0.5rem;
    }
    .footer ::slotted(*) {
      font-size: 0.72rem;
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

    .stepper input:focus-visible {
      outline: 2px solid var(--_accent);
      outline-offset: 2px;
    }

    /* Windows High Contrast: borders are drawn with real border properties (not
       backgrounds), so the heavy label rules survive. Pin their color to a
       system color so they stay visible. */
    @media (forced-colors: active) {
      .label,
      .rule,
      .nutrients th,
      .nutrients td,
      .vitamins li,
      .stepper input {
        border-color: CanvasText;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }

    /* Nutrition labels get printed. Drop the interactive control and force a
       clean black-on-white label regardless of the active theme. */
    @media print {
      :host {
        max-width: none;
        color: #000;
        background: transparent;
      }
      .label {
        background: #fff;
        border-color: #000;
      }
      .stepper {
        display: none;
      }
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
    // Enforce the [min, max] bounds for `servings` on every path, not only the
    // stepper input: a direct property or attribute assignment is clamped here,
    // and a non-finite value falls back to the authored default.
    if (changed.has('servings') || changed.has('min') || changed.has('max')) {
      const safe = Number.isFinite(this.servings)
        ? this.#clampToRange(this.servings)
        : this.#defaultServings;
      if (safe !== this.servings) this.servings = safe;
    }

    if (changed.has('facts') || changed.has('src')) {
      if (this.facts !== undefined) {
        // Inline data takes over: stop the controller so a later facts-clear
        // re-fetches cleanly (reset clears currentSrc).
        if (changed.has('facts')) this.data.reset();
      } else {
        // No inline facts: the controller drives display from src.
        void this.data.setSrc(this.src);
      }
    }
  }

  override firstUpdated(): void {
    // Capture the authored serving count so form reset restores it (native
    // reset semantics), rather than hardcoding the property default.
    this.#defaultServings = this.servings;
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has('servings') || changed.has('disabled')) {
      this.#syncFormValue();
    }
  }

  /**
   * Mirror the serving count into the form value. A disabled control submits
   * nothing, matching native form behavior (disabled fields are excluded from
   * the form entry list).
   */
  #syncFormValue(): void {
    this.#internals.setFormValue(this.disabled ? null : String(this.servings));
  }

  /**
   * Native form reset restores the authored serving count and notifies event
   * consumers, so a readout driven only by nf-servings-change does not go stale.
   */
  formResetCallback(): void {
    this.servings = this.#defaultServings;
    this.commitServings();
  }

  /** A surrounding fieldset/form disabling us mirrors into the disabled state. */
  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
  }

  /**
   * Re-fetch the current `src`, for example to retry after a load error. A no-op
   * when the element is driven by an inline `facts` property.
   */
  reload(): void {
    void this.data.reload();
  }

  /** Inline facts win; otherwise fall back to whatever the controller fetched. */
  private resolveFacts(): NutritionData | undefined {
    return this.facts ?? this.data.facts;
  }

  /** Clamp a finite serving count into the [min, max] range. */
  #clampToRange(value: number): number {
    return Math.min(this.max, Math.max(this.min, value));
  }

  /**
   * Coerce raw stepper input into a valid serving count. Empty or non-numeric
   * input keeps the current value; out-of-range values clamp to [min, max].
   */
  private clampServings(raw: string): number {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? this.#clampToRange(parsed) : this.servings;
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
    // null or undefined means "not provided": omit the row. A real 0 still renders.
    if (amount == null) return nothing;

    const dv = row.dv !== null ? dailyValuePercent(row.dv, amount) : null;
    return html`
      <tr class=${row.sub ? 'sub' : ''}>
        <th scope="row">
          <span class="nutrient-name">${row.label}</span
          ><span class="nutrient-amount">${this.formatAmount(amount)}${row.unit}</span>
        </th>
        <td class="dv">${dv !== null ? `${dv}%` : ''}</td>
      </tr>
    `;
  }

  private renderVitamins(facts: NutritionData) {
    const items = VITAMIN_ROWS.map((v) => ({ label: v.label, value: facts[v.key] })).filter(
      (v): v is { label: string; value: number } => v.value != null,
    );
    if (items.length === 0) return nothing;
    return html`
      <ul class="vitamins">
        ${items.map(
          (v) => html`
            <li>
              <span class="vitamin-name" aria-hidden="true">${v.label}</span>
              <span class="vitamin-dv">
                <span class="visually-hidden">${v.label} </span>${v.value}%
              </span>
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
      <p class="item-name" part="item-name">
        ${facts.item_name}${facts.brand_name
          ? html` <span class="brand">${facts.brand_name}</span>`
          : nothing}
      </p>
      <section
        class="label"
        part="label"
        role="region"
        aria-label="Nutrition Facts for ${facts.item_name}"
      >
        <header class="header">
          <h2 class="title" part="title">Nutrition Facts</h2>
          <dl class="serving-meta">
            <div class="serving-row" part="serving-size">
              <dt>Serving Size</dt>
              <dd>${facts.serving_size_qty} ${facts.serving_size_unit}</dd>
            </div>
            <div class="serving-row">
              <dt>Servings Per Container</dt>
              <dd>${facts.servings_per_container}</dd>
            </div>
          </dl>
        </header>

        ${this.hideStepper ? nothing : this.renderStepper()}

        <hr class="rule thick" />

        <!-- Scoped to values that change with servings. aria-atomic keeps label/value
             pairs intact when assistive tech announces diffs. -->
        <div class="values" aria-live="polite" aria-atomic="true">
          <div class="calories" part="calories">
          <span class="calories-label" aria-hidden="true">Calories</span>
          <span class="calories-value">
            <span class="visually-hidden">Calories </span>${this.formatAmount(facts.calories)}
          </span>
          ${facts.calories_from_fat != null
            ? html`<span class="calories-fat"
                >Calories from Fat ${this.formatAmount(facts.calories_from_fat)}</span
              >`
            : nothing}
        </div>

        <hr class="rule medium" />

        <table class="nutrients" part="nutrient-table">
          <caption class="visually-hidden">
            Nutrition facts per serving; percent daily value in the right column
          </caption>
          <colgroup>
            <col />
            <col class="col-dv" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" class="visually-hidden">Nutrient and amount per serving</th>
              <th scope="col" class="dv-head">% Daily Value*</th>
            </tr>
          </thead>
          <tbody>
            ${MACRO_ROWS.map((row) => this.renderNutrientRow(facts, row))}
          </tbody>
        </table>

          <hr class="rule medium" />

          ${this.renderVitamins(facts)}
        </div>

        <p class="footnote">* Percent Daily Values are based on a 2,000 calorie diet.</p>

        ${facts.ingredients
          ? html`<p class="ingredients">
              <span class="ingredients-label">Ingredients:</span> ${facts.ingredients}
            </p>`
          : nothing}

        <div class="footer"><slot name="footer"></slot></div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nutrition-facts': NutritionFacts;
  }
}
