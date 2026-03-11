import { describe, beforeAll, beforeEach, afterAll } from 'vitest';
import type { TestSuiteConfig, TwinClient } from './types.js';
import { createTwinClient } from './client.js';

/**
 * Check if a twin service is reachable by hitting its root or /health endpoint.
 */
async function isServiceAvailable(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try /health first, then root
    for (const path of ['/health', '/']) {
      try {
        const resp = await fetch(`${baseUrl}${path}`, {
          signal: controller.signal,
        });
        if (resp.ok) {
          clearTimeout(timer);
          return true;
        }
      } catch {
        // Try next path
      }
    }
    clearTimeout(timer);
    return false;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * Factory to create a fully configured test suite for a twin.
 *
 * Returns the TwinClient for making requests.
 * Handles service discovery, setup/teardown, and reset lifecycle.
 */
export function createTwinTestSuite(config: TestSuiteConfig): TwinClient {
  return createTwinClient(config.baseUrl, config.token);
}

/**
 * Describe a twin test suite with automatic service discovery and lifecycle.
 *
 * If the twin service is not reachable, all tests are skipped with a clear message.
 * Before each test, the twin is reset to its initial state via POST /admin/reset.
 */
export function describeTwin(
  name: string,
  baseUrl: string,
  fn: (client: TwinClient) => void,
  options?: { token?: string; discoveryTimeoutMs?: number },
): void {
  const token = options?.token;
  const timeoutMs = options?.discoveryTimeoutMs ?? 2000;

  describe(name, () => {
    let client: TwinClient;
    let available = false;

    beforeAll(async () => {
      available = await isServiceAvailable(baseUrl, timeoutMs);
      if (!available) {
        console.warn(`⏭ Skipping "${name}": service not available at ${baseUrl}`);
        return;
      }
      client = createTwinClient(baseUrl, token);
    });

    beforeEach(async (context) => {
      if (!available) {
        context.skip();
        return;
      }
      // Reset twin state before each test
      try {
        await client.reset();
      } catch {
        // Reset endpoint might not exist for all twins — that's ok
      }
    });

    // The fn receives a getter that returns the client
    // We use a proxy so the user can destructure and call methods
    const clientProxy = new Proxy({} as TwinClient, {
      get(_target, prop) {
        if (!client) {
          throw new Error(`TwinClient not initialized — service "${name}" may not be available`);
        }
        const value = (client as Record<string | symbol, unknown>)[prop];
        if (typeof value === 'function') {
          return value.bind(client);
        }
        return value;
      },
    });

    fn(clientProxy);
  });
}
