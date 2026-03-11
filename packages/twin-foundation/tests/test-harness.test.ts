import express from 'express';
import type { Server } from 'http';
import { createTwinClient } from '../src/test-harness/client.js';
import clock from '../src/test-harness/clock.js';
import {
  validateNorwegianOrgNumber,
  validateNorwegianPhone,
  validateNokAmount,
  validateIso8601Date,
  validateNorwegianPostalCode,
} from '../src/test-harness/validators.js';
import { describeTwin } from '../src/test-harness/suite.js';
// Side-effect import: registers custom matchers
import '../src/test-harness/assertions.js';

// ---------------------------------------------------------------------------
// Helper: create a mock twin Express server for testing
// ---------------------------------------------------------------------------

interface MockTwinState {
  items: Array<{ id: number; name: string }>;
  clockOffsetMs: number;
}

function createMockTwin() {
  const initialItems = [
    { id: 1, name: 'Laks' },
    { id: 2, name: 'Torsk' },
  ];

  const state: MockTwinState = {
    items: [...initialItems],
    clockOffsetMs: 0,
  };

  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Protected resource endpoint
  app.get('/api/items', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ items: state.items });
  });

  // POST items
  app.post('/api/items', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = { id: state.items.length + 1, name: req.body.name };
    state.items.push(item);
    res.status(201).json(item);
  });

  // Plain text endpoint (non-JSON response)
  app.get('/plain', (_req, res) => {
    res.type('text/plain').send('Hello from twin');
  });

  // Admin: reset
  app.post('/admin/reset', (_req, res) => {
    state.items = [...initialItems];
    state.clockOffsetMs = 0;
    res.json({ ok: true, message: 'State reset to initial' });
  });

  // Admin: time advance
  app.post('/admin/time/advance', (req, res) => {
    const hours = parseFloat(req.query.hours as string);
    if (isNaN(hours) || hours <= 0) {
      res.status(400).json({ error: 'Invalid hours parameter' });
      return;
    }
    state.clockOffsetMs += hours * 60 * 60 * 1000;
    res.json({ ok: true, advancedMs: hours * 60 * 60 * 1000, totalOffsetMs: state.clockOffsetMs });
  });

  return { app, state, initialItems };
}

// ---------------------------------------------------------------------------
// Start mock twin server for tests
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;
let mockTwin: ReturnType<typeof createMockTwin>;

beforeAll(async () => {
  mockTwin = createMockTwin();
  await new Promise<void>((resolve) => {
    server = mockTwin.app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

// ---------------------------------------------------------------------------
// API Client Tests
// ---------------------------------------------------------------------------

describe('TwinClient', () => {
  const testToken = 'test-bearer-token-abc123';

  it('sends correct Authorization header from provided token', async () => {
    const client = createTwinClient(baseUrl, testToken);
    const resp = await client.get<{ items: unknown[] }>('/api/items');
    // If auth header was sent correctly, we get 200 with items
    expect(resp.status).toBe(200);
    expect(resp.body.items).toBeDefined();
  });

  it('fails with 401 when no token is configured', async () => {
    const client = createTwinClient(baseUrl); // no token
    const resp = await client.get('/api/items');
    expect(resp.status).toBe(401);
  });

  it('allows per-request token override', async () => {
    const client = createTwinClient(baseUrl); // no default token
    const resp = await client.get<{ items: unknown[] }>('/api/items', { token: testToken });
    expect(resp.status).toBe(200);
    expect(resp.body.items).toBeDefined();
  });

  it('allows nullifying token for a single request', async () => {
    const client = createTwinClient(baseUrl, testToken); // has default token
    const resp = await client.get('/api/items', { token: null });
    expect(resp.status).toBe(401);
  });

  it('parses JSON responses automatically', async () => {
    const client = createTwinClient(baseUrl, testToken);
    const resp = await client.get<{ items: Array<{ id: number; name: string }> }>('/api/items');
    expect(resp.status).toBe(200);
    expect(typeof resp.body).toBe('object');
    expect(Array.isArray(resp.body.items)).toBe(true);
    expect(resp.body.items[0]).toEqual({ id: 1, name: 'Laks' });
  });

  it('handles non-JSON responses without crashing', async () => {
    const client = createTwinClient(baseUrl);
    const resp = await client.get<string>('/plain');
    expect(resp.status).toBe(200);
    expect(resp.body).toBe('Hello from twin');
  });

  it('sends JSON body on POST automatically', async () => {
    const client = createTwinClient(baseUrl, testToken);
    const resp = await client.post<{ id: number; name: string }>('/api/items', { name: 'Sei' });
    expect(resp.status).toBe(201);
    expect(resp.body.name).toBe('Sei');
    expect(resp.body.id).toBeGreaterThan(0);
  });

  it('exposes response headers', async () => {
    const client = createTwinClient(baseUrl);
    const resp = await client.get('/health');
    expect(resp.headers).toBeDefined();
    expect(resp.headers.get('content-type')).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// Assertion Helpers Tests
// ---------------------------------------------------------------------------

describe('Custom Vitest matchers', () => {
  describe('toHaveStatus', () => {
    it('passes when status matches', async () => {
      const client = createTwinClient(baseUrl);
      const resp = await client.get('/health');
      expect(resp).toHaveStatus(200);
    });

    it('fails with descriptive message when status does not match', async () => {
      const client = createTwinClient(baseUrl);
      const resp = await client.get('/health');
      expect(() => {
        expect(resp).toHaveStatus(404);
      }).toThrow(/Expected status 404, got 200/);
    });
  });

  describe('toMatchShape', () => {
    it('correctly validates partial object shapes', () => {
      const obj = { id: 1, name: 'Kari Nordmann', email: 'kari@ode.no', age: 34 };
      expect(obj).toMatchShape({ name: 'Kari Nordmann', id: 1 });
    });

    it('passes with nested partial shapes', () => {
      const obj = { user: { name: 'Ola Hansen', role: 'admin' }, timestamp: 123 };
      expect(obj).toMatchShape({ user: { name: 'Ola Hansen' } });
    });

    it('fails with descriptive message when shape does not match', () => {
      const obj = { id: 1, name: 'Kari' };
      expect(() => {
        expect(obj).toMatchShape({ name: 'Ola', missing: true });
      }).toThrow(/Shape mismatch/);
    });

    it('fails when value is not an object', () => {
      expect(() => {
        expect('not an object').toMatchShape({ key: 'value' });
      }).toThrow(/Expected an object/);
    });
  });

  describe('toHaveArrayLength', () => {
    it('validates exact length when only min is given', () => {
      expect([1, 2, 3]).toHaveArrayLength(3);
    });

    it('validates range when min and max are given', () => {
      expect([1, 2, 3]).toHaveArrayLength(1, 5);
    });

    it('fails when array length is out of range', () => {
      expect(() => {
        expect([1, 2]).toHaveArrayLength(3, 5);
      }).toThrow(/Expected array length between 3 and 5, got 2/);
    });

    it('fails when received is not an array', () => {
      expect(() => {
        expect('not array').toHaveArrayLength(1);
      }).toThrow(/Expected an array/);
    });
  });

  describe('toBeFieldType', () => {
    it('validates string type', () => {
      expect('hello').toBeFieldType('string');
    });

    it('validates number type', () => {
      expect(42).toBeFieldType('number');
    });

    it('validates array type', () => {
      expect([1, 2]).toBeFieldType('array');
    });

    it('fails with descriptive message', () => {
      expect(() => {
        expect(42).toBeFieldType('string');
      }).toThrow(/Expected type "string", got "number"/);
    });
  });
});

// ---------------------------------------------------------------------------
// Norwegian Validator Tests
// ---------------------------------------------------------------------------

describe('Norwegian data validators', () => {
  describe('org number (MOD-11)', () => {
    it('accepts valid Norwegian org numbers', () => {
      // Well-known valid org numbers
      expect(validateNorwegianOrgNumber('923609016')).toEqual({ valid: true }); // Equinor
      expect(validateNorwegianOrgNumber('914778271')).toEqual({ valid: true }); // DNB
    });

    it('rejects org numbers with wrong check digit', () => {
      const result = validateNorwegianOrgNumber('923609017'); // last digit changed
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('MOD-11');
    });

    it('rejects non-9-digit strings', () => {
      expect(validateNorwegianOrgNumber('12345678').valid).toBe(false);
      expect(validateNorwegianOrgNumber('1234567890').valid).toBe(false);
      expect(validateNorwegianOrgNumber('abcdefghi').valid).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(validateNorwegianOrgNumber(123456789).valid).toBe(false);
    });

    it('works as a custom Vitest matcher', () => {
      expect('923609016').toBeNorwegianOrgNumber();
    });
  });

  describe('phone number (+47)', () => {
    it('accepts valid Norwegian phone numbers', () => {
      expect(validateNorwegianPhone('+47 1234 5678')).toEqual({ valid: true });
      expect(validateNorwegianPhone('+4712345678')).toEqual({ valid: true });
      expect(validateNorwegianPhone('+47 12 34 56 78')).toEqual({ valid: true });
    });

    it('rejects Swedish phone numbers (+46)', () => {
      const result = validateNorwegianPhone('+46 1234 5678');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('+47');
    });

    it('rejects numbers with wrong digit count', () => {
      expect(validateNorwegianPhone('+47 123 456').valid).toBe(false);
      expect(validateNorwegianPhone('+47 123456789').valid).toBe(false);
    });

    it('works as a custom Vitest matcher', () => {
      expect('+47 9876 5432').toBeNorwegianPhone();
    });
  });

  describe('NOK amount', () => {
    it('accepts valid positive amounts with up to 2 decimals', () => {
      expect(validateNokAmount(100)).toEqual({ valid: true });
      expect(validateNokAmount(99.99)).toEqual({ valid: true });
      expect(validateNokAmount(0.01)).toEqual({ valid: true });
    });

    it('rejects zero and negative amounts', () => {
      expect(validateNokAmount(0).valid).toBe(false);
      expect(validateNokAmount(-50).valid).toBe(false);
    });

    it('rejects more than 2 decimal places', () => {
      expect(validateNokAmount(10.001).valid).toBe(false);
    });

    it('rejects non-number values', () => {
      expect(validateNokAmount('100').valid).toBe(false);
    });

    it('works as a custom Vitest matcher', () => {
      expect(1500.50).toBeNokAmount();
    });
  });

  describe('ISO 8601 date', () => {
    it('accepts date-only format', () => {
      expect(validateIso8601Date('2024-01-15')).toEqual({ valid: true });
    });

    it('accepts datetime format', () => {
      expect(validateIso8601Date('2024-01-15T10:30:00')).toEqual({ valid: true });
    });

    it('accepts datetime with Z timezone', () => {
      expect(validateIso8601Date('2024-01-15T10:30:00Z')).toEqual({ valid: true });
    });

    it('accepts datetime with offset timezone', () => {
      expect(validateIso8601Date('2024-01-15T10:30:00+01:00')).toEqual({ valid: true });
    });

    it('rejects non-ISO strings', () => {
      expect(validateIso8601Date('15/01/2024').valid).toBe(false);
      expect(validateIso8601Date('Jan 15, 2024').valid).toBe(false);
    });

    it('works as a custom Vitest matcher', () => {
      expect('2026-03-11T08:00:00Z').toBeIso8601Date();
    });
  });

  describe('Norwegian postal code', () => {
    it('accepts valid 4-digit postal codes', () => {
      expect(validateNorwegianPostalCode('0001')).toEqual({ valid: true });
      expect(validateNorwegianPostalCode('6057')).toEqual({ valid: true }); // Ellingsøy
      expect(validateNorwegianPostalCode('9999')).toEqual({ valid: true });
    });

    it('rejects non-4-digit strings', () => {
      expect(validateNorwegianPostalCode('123').valid).toBe(false);
      expect(validateNorwegianPostalCode('12345').valid).toBe(false);
    });

    it('rejects 0000', () => {
      expect(validateNorwegianPostalCode('0000').valid).toBe(false);
    });

    it('works as a custom Vitest matcher', () => {
      expect('6057').toBeNorwegianPostalCode();
    });
  });
});

// ---------------------------------------------------------------------------
// Clock Module Tests
// ---------------------------------------------------------------------------

describe('Clock module', () => {
  beforeEach(() => {
    clock.reset();
  });

  it('returns approximately real time by default', () => {
    const before = Date.now();
    const clockTime = clock.now();
    const after = Date.now();
    expect(clockTime).toBeGreaterThanOrEqual(before);
    expect(clockTime).toBeLessThanOrEqual(after);
  });

  it('advances time by the given milliseconds', () => {
    const before = clock.now();
    clock.advance(3600 * 1000); // 1 hour
    const after = clock.now();
    // Should be ~1 hour ahead (within a few ms tolerance)
    expect(after - before).toBeGreaterThanOrEqual(3600 * 1000 - 50);
    expect(after - before).toBeLessThanOrEqual(3600 * 1000 + 50);
  });

  it('supports multiple advances (cumulative)', () => {
    clock.advance(1000); // +1 second
    clock.advance(2000); // +2 more seconds
    expect(clock.getOffset()).toBe(3000);
  });

  it('resets to real time', () => {
    clock.advance(10_000_000);
    expect(clock.getOffset()).toBe(10_000_000);
    clock.reset();
    expect(clock.getOffset()).toBe(0);
    // Should be close to real time again
    expect(Math.abs(clock.now() - Date.now())).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Admin Endpoints (Reset + Time Advance) Tests
// ---------------------------------------------------------------------------

describe('Admin endpoints via TwinClient', () => {
  const testToken = 'admin-token';

  it('POST /admin/reset restores initial state', async () => {
    const client = createTwinClient(baseUrl, testToken);

    // Add an item
    await client.post('/api/items', { name: 'Kveite' });

    // Verify it was added
    const beforeReset = await client.get<{ items: unknown[] }>('/api/items');
    expect(beforeReset.body.items.length).toBeGreaterThan(2);

    // Reset
    const resetResp = await client.reset();
    expect(resetResp.status).toBe(200);
    expect(resetResp.body).toMatchShape({ ok: true });

    // Verify state is back to initial
    const afterReset = await client.get<{ items: Array<{ id: number; name: string }> }>('/api/items');
    expect(afterReset.body.items).toHaveLength(2);
    expect(afterReset.body.items[0].name).toBe('Laks');
    expect(afterReset.body.items[1].name).toBe('Torsk');
  });

  it('POST /admin/time/advance moves internal clock forward', async () => {
    const client = createTwinClient(baseUrl);

    const resp = await client.advanceTime(3);
    expect(resp.status).toBe(200);
    expect(resp.body).toMatchShape({
      ok: true,
      advancedMs: 3 * 60 * 60 * 1000,
    });

    // Advance again — should be cumulative
    const resp2 = await client.advanceTime(2);
    expect(resp2.status).toBe(200);
    expect((resp2.body as Record<string, unknown>).totalOffsetMs).toBe(5 * 60 * 60 * 1000);
  });

  it('POST /admin/time/advance rejects invalid hours', async () => {
    const client = createTwinClient(baseUrl);
    const resp = await client.request('/admin/time/advance?hours=-1', { method: 'POST' });
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// describeTwin() — service discovery + skip logic
// ---------------------------------------------------------------------------

describe('describeTwin() with available service', () => {
  // We need a server whose URL is known before describeTwin is called.
  // Start a dedicated server on a fixed port for this test block.
  let describeTwinServer: Server;
  const describeTwinPort = 39871;
  const describeTwinUrl = `http://127.0.0.1:${describeTwinPort}`;

  beforeAll(async () => {
    const twin = createMockTwin();
    await new Promise<void>((resolve, reject) => {
      describeTwinServer = twin.app.listen(describeTwinPort, () => resolve());
      describeTwinServer.on('error', reject);
    });
  });

  afterAll(() => {
    describeTwinServer?.close();
  });

  describeTwin('Mock Twin (available)', describeTwinUrl, (client) => {
    it('can make requests through the provided client', async () => {
      const resp = await client.get('/health');
      expect(resp).toHaveStatus(200);
    });
  });
});

describe('describeTwin() with unavailable service', () => {
  // Use a port that's definitely not listening
  describeTwin('Ghost Twin (unavailable)', 'http://127.0.0.1:19999', (client) => {
    it('should be skipped because the service is not available', () => {
      // This test body should never execute — describeTwin skips it
      expect(true).toBe(false); // Would fail if it ran
    });
  }, { discoveryTimeoutMs: 500 });
});
