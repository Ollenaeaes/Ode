import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import { createTestApp, authGet } from './helpers.js';

describe('Reference Data Endpoints', () => {
  let request: supertest.Agent;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
  });

  describe('GET /api/v3/avdeling', () => {
    it('returns departments in OData envelope', async () => {
      const res = await authGet(request, '/api/v3/avdeling?$top=200');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
      expect(res.body.value.length).toBe(19); // All departments
    });

    it('includes expected department fields', async () => {
      const res = await authGet(request, '/api/v3/avdeling?$top=1');
      const dept = res.body.value[0];
      expect(dept).toHaveProperty('AvdelingId');
      expect(dept).toHaveProperty('Navn');
      expect(dept).toHaveProperty('Kode');
      expect(dept).toHaveProperty('Lokasjon');
      expect(dept).toHaveProperty('LokasjonNavn');
    });

    it('supports OData filtering', async () => {
      const res = await authGet(request, "/api/v3/avdeling?$filter=Kode eq 'LED'");
      expect(res.body.value.length).toBe(1);
      expect(res.body.value[0].Kode).toBe('LED');
    });
  });

  describe('GET /api/v3/aktivitet', () => {
    it('returns activity codes', async () => {
      const res = await authGet(request, '/api/v3/aktivitet?$top=200');
      expect(res.status).toBe(200);
      expect(res.body.value.length).toBe(10);
    });

    it('includes expected fields', async () => {
      const res = await authGet(request, '/api/v3/aktivitet?$top=1');
      const act = res.body.value[0];
      expect(act).toHaveProperty('AktivitetId');
      expect(act).toHaveProperty('Kode');
      expect(act).toHaveProperty('Navn');
    });
  });

  describe('GET /api/v3/arbeidstype', () => {
    it('returns work types', async () => {
      const res = await authGet(request, '/api/v3/arbeidstype?$top=200');
      expect(res.status).toBe(200);
      expect(res.body.value.length).toBe(4);
    });
  });

  describe('GET /api/v3/prosjekt', () => {
    it('returns projects', async () => {
      const res = await authGet(request, '/api/v3/prosjekt?$top=200');
      expect(res.status).toBe(200);
      expect(res.body.value.length).toBe(6);
    });

    it('includes date fields', async () => {
      const res = await authGet(request, '/api/v3/prosjekt?$top=1');
      expect(res.body.value[0]).toHaveProperty('StartDato');
      expect(res.body.value[0]).toHaveProperty('SluttDato');
    });
  });

  describe('GET /api/v3/prosjektlinje', () => {
    it('returns project lines (empty initially)', async () => {
      const res = await authGet(request, '/api/v3/prosjektlinje');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
    });
  });
});
