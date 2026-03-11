import express, { type Request, type Response } from 'express';
import { createTestToken, decodeToken, createAuthMiddleware } from '../src/auth/index.js';
import type { AuthenticatedRequest, UserContext } from '../src/auth/index.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal Express app with the auth middleware
// ---------------------------------------------------------------------------
function createApp(options?: Parameters<typeof createAuthMiddleware>[0]) {
  const app = express();
  app.use(createAuthMiddleware(options));

  // Protected route that returns user context
  app.get('/protected', (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    res.json({ ok: true, user });
  });

  // Another protected route for role testing
  app.get('/admin', (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    res.json({ ok: true, user });
  });

  // Public health route (used for publicRoutes tests)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}

// Helper to make requests via supertest-style approach using the app directly
async function request(app: express.Express, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const req = {
      method: 'GET',
      url: path,
      path,
      headers: { ...headers },
      get(name: string) {
        const lower = name.toLowerCase();
        for (const [key, val] of Object.entries(this.headers)) {
          if (key.toLowerCase() === lower) return val;
        }
        return undefined;
      },
    } as unknown as Request;

    // Set up path on req
    Object.defineProperty(req, 'path', { value: path, writable: false });

    const chunks: Buffer[] = [];
    const res = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: Record<string, unknown>) {
        this.statusCode = this.statusCode;
        resolve({ status: this.statusCode, body: data });
      },
      setHeader(name: string, value: string) {
        this._headers[name] = value;
        return this;
      },
    } as unknown as Response;

    // Use the app's handle method to process the request
    // We'll use a simpler approach — just use node's http
    // Actually, let's use a real HTTP server approach
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        resolve({ status: 500, body: { error: 'Failed to start server' } });
        return;
      }
      const port = addr.port;
      fetch(`http://127.0.0.1:${port}${path}`, { headers })
        .then(async (resp) => {
          const body = await resp.json();
          server.close();
          resolve({ status: resp.status, body: body as Record<string, unknown> });
        })
        .catch((err) => {
          server.close();
          resolve({ status: 500, body: { error: String(err) } });
        });
    });
  });
}

// ---------------------------------------------------------------------------
// Standard test payload
// ---------------------------------------------------------------------------
const validPayload = {
  sub: 'user-123',
  tid: 'tenant-ode',
  roles: ['employee'],
  name: 'Kari Nordmann',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTestToken', () => {
  it('creates a token with three dot-separated base64url segments', () => {
    const token = createTestToken(validPayload);
    const segments = token.split('.');
    expect(segments).toHaveLength(3);

    // Each segment should be valid base64url (no +, /, or = characters)
    for (const seg of segments) {
      expect(seg).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('embeds the payload fields correctly', () => {
    const token = createTestToken(validPayload);
    const user = decodeToken(token);
    expect(user).toEqual({
      userId: 'user-123',
      tenantId: 'tenant-ode',
      roles: ['employee'],
      name: 'Kari Nordmann',
    });
  });

  it('sets iat and exp automatically', () => {
    const token = createTestToken(validPayload);
    const segments = token.split('.');
    const raw = Buffer.from(segments[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const payload = JSON.parse(raw);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

describe('decodeToken', () => {
  it('decodes a valid token into UserContext', () => {
    const token = createTestToken(validPayload);
    const user = decodeToken(token);
    expect(user).toEqual({
      userId: 'user-123',
      tenantId: 'tenant-ode',
      roles: ['employee'],
      name: 'Kari Nordmann',
    });
  });

  it('throws on malformed token (not three segments)', () => {
    expect(() => decodeToken('only.two')).toThrow('expected three segments');
    expect(() => decodeToken('single')).toThrow('expected three segments');
    expect(() => decodeToken('a.b.c.d')).toThrow('expected three segments');
  });

  it('throws on token with missing required fields', () => {
    // Create a token-like structure with missing fields
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url'); // missing tid, roles, name
    const sig = Buffer.from('sig').toString('base64url');
    const token = `${header}.${body}.${sig}`;

    expect(() => decodeToken(token)).toThrow('missing required fields');
  });
});

describe('createAuthMiddleware', () => {
  it('returns 200 and attaches user context for valid Bearer token', async () => {
    const app = createApp();
    const token = createTestToken(validPayload);
    const resp = await request(app, '/protected', { Authorization: `Bearer ${token}` });

    expect(resp.status).toBe(200);
    expect(resp.body.ok).toBe(true);
    const user = resp.body.user as UserContext;
    expect(user.userId).toBe('user-123');
    expect(user.tenantId).toBe('tenant-ode');
    expect(user.roles).toEqual(['employee']);
    expect(user.name).toBe('Kari Nordmann');
  });

  it('returns 401 for malformed token (not three segments)', async () => {
    const app = createApp();
    const resp = await request(app, '/protected', { Authorization: 'Bearer not-a-valid-token' });

    expect(resp.status).toBe(401);
    expect(resp.body.error).toBe('Unauthorized');
    expect(resp.body.message).toMatch(/three segments/i);
  });

  it('returns 401 for token with missing required fields in payload', async () => {
    const app = createApp();
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
    const sig = Buffer.from('sig').toString('base64url');
    const token = `${header}.${body}.${sig}`;

    const resp = await request(app, '/protected', { Authorization: `Bearer ${token}` });

    expect(resp.status).toBe(401);
    expect(resp.body.error).toBe('Unauthorized');
    expect(resp.body.message).toMatch(/missing required fields/i);
  });

  it('returns 401 when no Authorization header is present', async () => {
    const app = createApp();
    const resp = await request(app, '/protected');

    expect(resp.status).toBe(401);
    expect(resp.body.error).toBe('Unauthorized');
    expect(resp.body.message).toBe('No authorization header');
  });

  it('returns 401 for non-Bearer scheme (e.g., Basic)', async () => {
    const app = createApp();
    const resp = await request(app, '/protected', { Authorization: 'Basic dXNlcjpwYXNz' });

    expect(resp.status).toBe(401);
    expect(resp.body.error).toBe('Unauthorized');
    expect(resp.body.message).toBe('Bearer token required');
  });

  it('allows customizing required roles — rejects users without the role', async () => {
    const app = createApp({ requiredRoles: ['admin'] });
    const token = createTestToken({ ...validPayload, roles: ['employee'] });
    const resp = await request(app, '/protected', { Authorization: `Bearer ${token}` });

    expect(resp.status).toBe(401);
    expect(resp.body.error).toBe('Unauthorized');
    expect(resp.body.message).toMatch(/Required role/i);
  });

  it('allows customizing required roles — accepts users with the role', async () => {
    const app = createApp({ requiredRoles: ['admin'] });
    const token = createTestToken({ ...validPayload, roles: ['admin', 'employee'] });
    const resp = await request(app, '/protected', { Authorization: `Bearer ${token}` });

    expect(resp.status).toBe(200);
    expect(resp.body.ok).toBe(true);
  });

  it('allows marking routes as public (no auth required)', async () => {
    const app = createApp({ publicRoutes: ['/health'] });
    const resp = await request(app, '/health');

    expect(resp.status).toBe(200);
    expect(resp.body.status).toBe('ok');
  });

  it('still requires auth on non-public routes when publicRoutes is set', async () => {
    const app = createApp({ publicRoutes: ['/health'] });
    const resp = await request(app, '/protected');

    expect(resp.status).toBe(401);
  });

  it('allows overriding token validation logic via custom validateToken', async () => {
    const customValidator = (token: string): UserContext => {
      if (token === 'magic-key') {
        return { userId: 'admin-1', tenantId: 'ode', roles: ['superadmin'], name: 'Admin' };
      }
      throw new Error('Custom: invalid token');
    };

    const app = createApp({ validateToken: customValidator });

    const okResp = await request(app, '/protected', { Authorization: 'Bearer magic-key' });
    expect(okResp.status).toBe(200);
    expect((okResp.body.user as UserContext).userId).toBe('admin-1');

    const failResp = await request(app, '/protected', { Authorization: 'Bearer wrong-key' });
    expect(failResp.status).toBe(401);
    expect(failResp.body.message).toBe('Custom: invalid token');
  });
});
