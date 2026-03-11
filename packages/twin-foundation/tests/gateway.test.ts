import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createGateway } from '../src/gateway/server.js';
import type { ServiceRegistry, RequestLogEntry } from '../src/gateway/types.js';

/** Helper to start a mock twin Express server on a random port */
function createMockTwin(name: string): {
  app: express.Express;
  server: http.Server;
  port: () => number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const app = express();
  app.use(express.json());

  // Default health endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: name });
  });

  let server: http.Server;

  return {
    app,
    get server() {
      return server;
    },
    port: () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') return addr.port;
      throw new Error('Server not started');
    },
    start: () =>
      new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      }),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/** Helper to make HTTP requests to a server */
function request(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr !== 'object') {
      reject(new Error('Server not started'));
      return;
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: bodyStr
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(bodyStr) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 500, headers: res.headers, body: data }),
        );
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('API Gateway', () => {
  let twin1: ReturnType<typeof createMockTwin>;
  let twin2: ReturnType<typeof createMockTwin>;
  let gatewayServer: http.Server;
  let logEntries: RequestLogEntry[];
  let registry: ServiceRegistry;

  beforeAll(async () => {
    // Start two mock twin services
    twin1 = createMockTwin('mercatus');
    twin1.app.get('/products', (_req, res) => {
      res.json([{ id: 1, name: 'Atlantic Salmon' }, { id: 2, name: 'Rainbow Trout' }]);
    });
    twin1.app.get('/products/:id', (req, res) => {
      res.json({ id: Number(req.params.id), name: 'Atlantic Salmon' });
    });
    twin1.app.post('/products', (req, res) => {
      res.status(201).json({ id: 3, ...req.body });
    });

    twin2 = createMockTwin('tidsbanken');
    twin2.app.get('/shifts', (_req, res) => {
      res.status(200).json([{ id: 10, employee: 'Kari Nordmann' }]);
    });

    await twin1.start();
    await twin2.start();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (gatewayServer) gatewayServer.close((err) => (err ? reject(err) : resolve()));
      else resolve();
    });
    await twin1.stop();
    await twin2.stop();
  });

  beforeEach(async () => {
    logEntries = [];

    registry = {
      mercatus: { host: '127.0.0.1', port: twin1.port() },
      tidsbanken: { host: '127.0.0.1', port: twin2.port() },
    };

    // Close previous gateway if open
    if (gatewayServer) {
      await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
    }

    const app = createGateway(registry, {
      healthCheckTimeout: 2000,
      logger: (entry) => logEntries.push(entry),
    });
    gatewayServer = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
  });

  // --- Routing / Proxy Tests ---

  it('routes request with valid service prefix to correct twin and strips prefix', async () => {
    const res = await request(gatewayServer, 'GET', '/mercatus/products');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual([
      { id: 1, name: 'Atlantic Salmon' },
      { id: 2, name: 'Rainbow Trout' },
    ]);
  });

  it('passes through twin response status code and body unchanged', async () => {
    const res = await request(gatewayServer, 'POST', '/mercatus/products', {
      name: 'Arctic Char',
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ id: 3, name: 'Arctic Char' });
  });

  it('routes to second registered twin correctly', async () => {
    const res = await request(gatewayServer, 'GET', '/tidsbanken/shifts');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual([{ id: 10, employee: 'Kari Nordmann' }]);
  });

  // --- Health Check Tests ---

  it('GET /health returns aggregate status with per-service detail', async () => {
    const res = await request(gatewayServer, 'GET', '/health');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.services.mercatus.status).toBe('up');
    expect(body.services.tidsbanken.status).toBe('up');
    expect(typeof body.services.mercatus.responseTime).toBe('number');
    expect(typeof body.services.tidsbanken.responseTime).toBe('number');
  });

  it('health returns "degraded" when one service is down but others are up', async () => {
    // Stop twin2 to simulate it being down
    await twin2.stop();

    const res = await request(gatewayServer, 'GET', '/health');
    const body = JSON.parse(res.body);
    expect(body.status).toBe('degraded');
    expect(body.services.mercatus.status).toBe('up');
    expect(body.services.tidsbanken.status).toBe('down');

    // Restart twin2 for subsequent tests
    await twin2.start();
    // Update registry with new port
    registry.tidsbanken = { host: '127.0.0.1', port: twin2.port() };
  });

  it('gateway with zero registered services returns healthy (vacuous truth)', async () => {
    // Create a gateway with empty registry
    const emptyApp = createGateway({}, { logger: () => {} });
    const emptyServer = await new Promise<http.Server>((resolve) => {
      const s = emptyApp.listen(0, () => resolve(s));
    });

    try {
      const res = await request(emptyServer, 'GET', '/health');
      const body = JSON.parse(res.body);
      expect(body.status).toBe('healthy');
      expect(body.services).toEqual({});
    } finally {
      await new Promise<void>((resolve) => emptyServer.close(() => resolve()));
    }
  });

  // --- Error Handling Tests ---

  it('request with unknown prefix returns 404 with service name in error', async () => {
    const res = await request(gatewayServer, 'GET', '/nonexistent/foo');
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Unknown service: nonexistent');
  });

  it('request to unavailable service returns 502', async () => {
    // Register a service pointing to a port nothing listens on
    registry.ghost = { host: '127.0.0.1', port: 59999 };

    // Recreate gateway with updated registry
    await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
    const app = createGateway(registry, {
      logger: (entry) => logEntries.push(entry),
    });
    gatewayServer = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const res = await request(gatewayServer, 'GET', '/ghost/data');
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Bad Gateway');
    expect(body.message).toBe('Service ghost is not available');
  });

  // --- Logging Tests ---

  it('every proxied request produces a log entry with all required fields', async () => {
    logEntries = [];
    await request(gatewayServer, 'GET', '/mercatus/products');

    expect(logEntries.length).toBeGreaterThanOrEqual(1);
    const entry = logEntries.find((e) => e.service === 'mercatus');
    expect(entry).toBeDefined();
    expect(entry!.method).toBe('GET');
    expect(entry!.path).toBe('/mercatus/products');
    expect(entry!.service).toBe('mercatus');
    expect(entry!.statusCode).toBe(200);
    expect(typeof entry!.responseTime).toBe('number');
    // ISO 8601 timestamp check
    expect(new Date(entry!.timestamp).toISOString()).toBe(entry!.timestamp);
  });

  it('health check request also produces a log entry', async () => {
    logEntries = [];
    await request(gatewayServer, 'GET', '/health');

    expect(logEntries.length).toBeGreaterThanOrEqual(1);
    const entry = logEntries.find((e) => e.path === '/health');
    expect(entry).toBeDefined();
    expect(entry!.method).toBe('GET');
    expect(entry!.service).toBe('gateway');
    expect(entry!.statusCode).toBe(200);
  });

  it('404 request also produces a log entry', async () => {
    logEntries = [];
    await request(gatewayServer, 'GET', '/unknown/path');

    expect(logEntries.length).toBeGreaterThanOrEqual(1);
    const entry = logEntries.find((e) => e.statusCode === 404);
    expect(entry).toBeDefined();
    expect(entry!.path).toBe('/unknown/path');
    expect(entry!.service).toBe('unknown');
  });
});
