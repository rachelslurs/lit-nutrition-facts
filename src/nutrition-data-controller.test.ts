import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { NutritionDataController } from './nutrition-data-controller';

const cola = {
  item_name: 'Cola, Cherry',
  calories: 100,
  sodium: 25,
  total_carbohydrate: 28,
  servings_per_container: 6,
  serving_size_qty: 8,
  serving_size_unit: 'fl oz',
};

/** Minimal ReactiveControllerHost that records requestUpdate calls. */
class FakeHost implements ReactiveControllerHost {
  updateCount = 0;
  addController(_c: ReactiveController): void {}
  removeController(_c: ReactiveController): void {}
  requestUpdate(): void {
    this.updateCount++;
  }
  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const okResponse = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as Response;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('NutritionDataController', () => {
  it('fetches and populates facts, clearing loading', async () => {
    globalThis.fetch = vi.fn(async () => okResponse(cola)) as typeof fetch;
    const host = new FakeHost();
    const controller = new NutritionDataController(host);

    await controller.setSrc('/data/cola-cherry.json');

    expect(controller.facts?.item_name).toBe('Cola, Cherry');
    expect(controller.loading).toBe(false);
    expect(controller.error).toBeUndefined();
    expect(host.updateCount).toBeGreaterThan(0);
  });

  it('surfaces an error on a non-200 response', async () => {
    globalThis.fetch = vi.fn(
      async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response,
    ) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/missing.json');

    expect(controller.facts).toBeUndefined();
    expect(controller.loading).toBe(false);
    expect(controller.error).toMatch(/404/);
  });

  it('surfaces an error on invalid JSON', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        }) as unknown as Response,
    ) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/garbage.json');

    expect(controller.error).toMatch(/valid JSON/);
  });

  it('surfaces an error when JSON does not match the schema', async () => {
    globalThis.fetch = vi.fn(
      async () => okResponse({ item_name: 'No nutrients here' }),
    ) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/wrong-shape.json');

    expect(controller.facts).toBeUndefined();
    expect(controller.error).toMatch(/schema/);
  });

  it('aborts an in-flight request when src changes before it resolves', async () => {
    const second = { ...cola, item_name: 'Second' };
    let resolveFirst: (() => void) | undefined;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
        if (url.includes('first')) {
          resolveFirst = () => resolve(okResponse(cola));
        } else {
          resolve(okResponse(second));
        }
      });
    }) as typeof fetch;

    const controller = new NutritionDataController(new FakeHost());
    const first = controller.setSrc('/first.json');
    const next = controller.setSrc('/second.json');

    await next;
    // Resolve the first request late; it must not clobber the second's result.
    resolveFirst?.();
    await first;

    expect(controller.facts?.item_name).toBe('Second');
    expect(controller.error).toBeUndefined();
  });

  it('aborts the in-flight request when the host disconnects', async () => {
    let aborted = false;
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const controller = new NutritionDataController(new FakeHost());
    const pending = controller.setSrc('/slow.json');
    controller.hostDisconnected();
    await pending;

    expect(aborted).toBe(true);
    expect(controller.facts).toBeUndefined();
    expect(controller.loading).toBe(false);
  });

  it('clears state when src is removed', async () => {
    globalThis.fetch = vi.fn(async () => okResponse(cola)) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/data/cola-cherry.json');
    expect(controller.facts).toBeDefined();

    await controller.setSrc(undefined);
    expect(controller.facts).toBeUndefined();
    expect(controller.error).toBeUndefined();
    expect(controller.loading).toBe(false);
  });

  it('rejects JSON where a nutrient has the wrong type', async () => {
    globalThis.fetch = vi.fn(async () =>
      okResponse({ ...cola, sodium: '25' }),
    ) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/wrong-type.json');
    expect(controller.facts).toBeUndefined();
    expect(controller.error).toMatch(/schema/);
  });

  it('accepts JSON that omits an optional nutrient', async () => {
    const withoutSodium: Record<string, unknown> = { ...cola };
    delete withoutSodium.sodium;
    globalThis.fetch = vi.fn(async () => okResponse(withoutSodium)) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/omitted.json');
    expect(controller.error).toBeUndefined();
    expect(controller.facts?.item_name).toBe('Cola, Cherry');
  });

  it('reload re-fetches the same src after a failed load', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? ({ ok: false, status: 500, json: async () => ({}) } as Response)
        : okResponse(cola);
    }) as typeof fetch;
    const controller = new NutritionDataController(new FakeHost());

    await controller.setSrc('/data.json');
    expect(controller.error).toMatch(/500/);

    await controller.reload();
    expect(controller.error).toBeUndefined();
    expect(controller.facts?.item_name).toBe('Cola, Cherry');
  });
});
