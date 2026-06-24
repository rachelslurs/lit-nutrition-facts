/*
 * Test-only polyfill. happy-dom does not implement `attachInternals`, which the
 * form-associated element calls in its constructor, and it does not collect
 * form-associated custom element values into FormData. This mock lets the
 * element construct and records the submitted form value so the form-association
 * mechanism is unit-testable.
 *
 * The real native-form round-trip (a surrounding <form> posting name=servings)
 * is verified in a browser via the vanilla demo; see the README a11y/testing
 * notes.
 */
interface MockInternals {
  formValue: string | File | FormData | null;
  setFormValue(value: string | File | FormData | null): void;
  setValidity(): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
  states: Set<string>;
}

declare global {
  interface HTMLElement {
    __internals?: MockInternals;
  }
}

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.attachInternals) {
  HTMLElement.prototype.attachInternals = function attachInternals(
    this: HTMLElement,
  ): ElementInternals {
    const internals: MockInternals = {
      formValue: null,
      setFormValue(value) {
        this.formValue = value;
      },
      setValidity() {},
      checkValidity() {
        return true;
      },
      reportValidity() {
        return true;
      },
      states: new Set<string>(),
    };
    this.__internals = internals;
    return internals as unknown as ElementInternals;
  };
}

export {};
