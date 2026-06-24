import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isNutritionData, type NutritionData } from './types';

/**
 * The modern replacement for the 2014 `<nutrition-facts-service>` DOM element.
 *
 * A plain reactive controller class owns the fetch lifecycle: the data, the
 * loading flag, and any error. It calls `host.requestUpdate()` whenever that
 * state changes, and uses an AbortController so a new `src` (or disconnecting the
 * host) cancels an in-flight request. No DOM node, same responsibility.
 *
 * Precedence between an inline `facts` property and `src` lives in the host
 * element; this controller is a pure fetch engine driven by `setSrc` / `reset`.
 */
export class NutritionDataController implements ReactiveController {
  private readonly host: ReactiveControllerHost;

  private abortController?: AbortController;
  private currentSrc?: string;

  /** Last successfully fetched data, or undefined when none / cleared. */
  facts?: NutritionData;
  /** True while a request is in flight. */
  loading = false;
  /** Human-readable, accessible error message, or undefined when healthy. */
  error?: string;

  constructor(host: ReactiveControllerHost) {
    (this.host = host).addController(this);
  }

  hostConnected(): void {
    // A src assigned while disconnected (or a fetch aborted by a disconnect)
    // is re-armed on reconnect. On the very first connect currentSrc is still
    // unset, so the host's own update cycle owns the initial fetch.
    if (this.currentSrc && !this.facts && !this.loading) {
      void this.load(this.currentSrc);
    }
  }

  hostDisconnected(): void {
    this.abortController?.abort();
    this.loading = false;
  }

  /**
   * Point the controller at a URL. A different URL aborts any in-flight request
   * and starts a new one; an empty URL clears fetched state. Returns the load
   * promise so callers (and tests) can await settlement; production callers may
   * ignore it.
   */
  setSrc(src: string | undefined): Promise<void> {
    if (src === this.currentSrc) return Promise.resolve();
    this.currentSrc = src;

    if (!src) {
      this.abortController?.abort();
      this.facts = undefined;
      this.loading = false;
      this.error = undefined;
      this.host.requestUpdate();
      return Promise.resolve();
    }

    return this.load(src);
  }

  /**
   * Drop all fetched state. Used when the host switches to an inline `facts`
   * property, which takes precedence over `src`. Clearing currentSrc means a
   * later `setSrc` with the same URL will correctly re-fetch.
   */
  reset(): void {
    this.abortController?.abort();
    this.currentSrc = undefined;
    this.facts = undefined;
    this.loading = false;
    this.error = undefined;
    this.host.requestUpdate();
  }

  /**
   * Force a re-fetch of the current src. Unlike setSrc, this does not short
   * circuit on an unchanged URL, so it is the retry path after a failed load.
   * No-op when no src is set.
   */
  reload(): Promise<void> {
    return this.currentSrc ? this.load(this.currentSrc) : Promise.resolve();
  }

  private async load(src: string): Promise<void> {
    this.abortController?.abort();
    const abort = new AbortController();
    this.abortController = abort;

    this.loading = true;
    this.error = undefined;
    this.facts = undefined;
    this.host.requestUpdate();

    try {
      const response = await fetch(src, { signal: abort.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new Error('Response was not valid JSON');
      }

      if (!isNutritionData(json)) {
        throw new Error('Data does not match the expected nutrition schema');
      }

      if (abort.signal.aborted) return; // superseded by a newer request
      this.facts = json;
      this.loading = false;
      this.error = undefined;
      this.host.requestUpdate();
    } catch (err) {
      // A superseded or disconnected request leaves state for its successor.
      if (abort.signal.aborted) return;
      this.facts = undefined;
      this.loading = false;
      this.error =
        err instanceof Error ? err.message : 'Failed to load nutrition data';
      this.host.requestUpdate();
    }
  }
}
