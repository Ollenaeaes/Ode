import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import { createTestApp, authGet, authPost, AUTH_HEADERS } from './helpers.js';

describe('Ansatt (Employee) Endpoints', () => {
  let request: supertest.Agent;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
  });

  describe('GET /api/v3/ansatt', () => {
    it('returns OData envelope with value array', async () => {
      const res = await authGet(request, '/api/v3/ansatt');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('value');
      expect(Array.isArray(res.body.value)).toBe(true);
    });

    it('returns 155 employees total', async () => {
      // Get all with high $top
      const res = await authGet(request, '/api/v3/ansatt?$top=200');
      expect(res.body.value.length).toBe(155);
    });

    it('supports $top pagination', async () => {
      const res = await authGet(request, '/api/v3/ansatt?$top=10');
      expect(res.body.value.length).toBe(10);
    });

    it('supports $skip pagination', async () => {
      const all = await authGet(request, '/api/v3/ansatt?$top=200');
      const skipped = await authGet(request, '/api/v3/ansatt?$skip=5&$top=5');
      expect(skipped.body.value[0].AnsattNr).toBe(all.body.value[5].AnsattNr);
    });

    it('returns @odata.nextLink when more results exist', async () => {
      const res = await authGet(request, '/api/v3/ansatt?$top=10');
      expect(res.body['@odata.nextLink']).toBeDefined();
      // URL may encode $ as %24
      const link = decodeURIComponent(res.body['@odata.nextLink']);
      expect(link).toContain('$skip=10');
    });

    it('does not return nextLink on last page', async () => {
      const res = await authGet(request, '/api/v3/ansatt?$top=200');
      expect(res.body['@odata.nextLink']).toBeUndefined();
    });

    it('supports $filter eq', async () => {
      const res = await authGet(request, "/api/v3/ansatt?$filter=Avdeling eq 'LED'");
      expect(res.body.value.length).toBe(8);
      expect(res.body.value.every((e: any) => e.Avdeling === 'LED')).toBe(true);
    });

    it('supports $filter with and', async () => {
      const res = await authGet(request, "/api/v3/ansatt?$filter=Avdeling eq 'LED' and Aktiv eq 1");
      expect(res.body.value.length).toBe(8);
    });

    it('supports $select', async () => {
      const res = await authGet(request, '/api/v3/ansatt?$select=AnsattNr,Fornavn&$top=5');
      expect(res.body.value[0]).toHaveProperty('AnsattNr');
      expect(res.body.value[0]).toHaveProperty('Fornavn');
      // Should not have Etternavn
      expect(res.body.value[0]).not.toHaveProperty('Etternavn');
    });

    it('supports $orderby', async () => {
      const res = await authGet(request, '/api/v3/ansatt?$orderby=AnsattNr desc&$top=5');
      const ids = res.body.value.map((e: any) => e.AnsattNr);
      expect(ids).toEqual([...ids].sort((a: number, b: number) => b - a));
    });

    it('supports startswith filter', async () => {
      const res = await authGet(request, "/api/v3/ansatt?$filter=startswith(Avdeling, 'SJO')&$top=200");
      expect(res.body.value.length).toBe(50); // 10 sea sites * 5 each
      expect(res.body.value.every((e: any) => e.Avdeling.startsWith('SJO'))).toBe(true);
    });

    it('supports substringof filter', async () => {
      const res = await authGet(request, "/api/v3/ansatt?$filter=substringof('PRO', Avdeling)&$top=200");
      expect(res.body.value.length).toBe(45); // 3 processing depts * 15
      expect(res.body.value.every((e: any) => e.Avdeling.includes('PRO'))).toBe(true);
    });
  });

  describe('GET /api/v3/ansatt(:id)', () => {
    it('returns single employee with OData key syntax', async () => {
      const res = await authGet(request, '/api/v3/ansatt/(1001)');
      expect(res.status).toBe(200);
      expect(res.body.AnsattNr).toBe(1001);
      expect(res.body.Fornavn).toBeDefined();
    });

    it('returns single employee with plain id', async () => {
      const res = await authGet(request, '/api/v3/ansatt/1001');
      expect(res.status).toBe(200);
      expect(res.body.AnsattNr).toBe(1001);
    });

    it('returns 404 for unknown employee', async () => {
      const res = await authGet(request, '/api/v3/ansatt/(9999)');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v3/ansatt', () => {
    it('creates new employee', async () => {
      const res = await authPost(request, '/api/v3/ansatt', {
        Fornavn: 'Kari',
        Etternavn: 'Nordmann',
        Avdeling: 'ADM',
        AvdelingNavn: 'Administrasjon',
        Stilling: 'Rådgiver',
      });
      expect(res.status).toBe(201);
      expect(res.body.Fornavn).toBe('Kari');
      expect(res.body.AnsattNr).toBeGreaterThan(1000);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await authPost(request, '/api/v3/ansatt', {
        Fornavn: 'Test',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth headers', async () => {
      const res = await request.get('/api/v3/ansatt');
      expect(res.status).toBe(401);
    });

    it('returns 403 with wrong credentials', async () => {
      const res = await request
        .get('/api/v3/ansatt')
        .set({ 'subscription-key': 'wrong', 'tb-key': 'wrong' });
      expect(res.status).toBe(403);
    });

    it('allows admin routes without auth', async () => {
      const res = await request.get('/admin/webhooks');
      expect(res.status).toBe(200);
    });
  });
});
