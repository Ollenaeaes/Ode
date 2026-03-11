import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { setupTestApp } from './helpers.js';

describe('Pay Codes API', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = setupTestApp());
  });

  describe('GET /api/v1/pay-codes', () => {
    it('should return all pay codes', async () => {
      const res = await request(app).get('/api/v1/pay-codes');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(11);
    });

    it('should filter by type=addition', async () => {
      const res = await request(app).get('/api/v1/pay-codes?type=addition');

      expect(res.status).toBe(200);
      res.body.data.forEach((pc: Record<string, unknown>) => {
        expect(pc.type).toBe('addition');
      });
      expect(res.body.data.length).toBe(8);
    });

    it('should filter by type=deduction', async () => {
      const res = await request(app).get('/api/v1/pay-codes?type=deduction');

      expect(res.status).toBe(200);
      res.body.data.forEach((pc: Record<string, unknown>) => {
        expect(pc.type).toBe('deduction');
      });
      expect(res.body.data.length).toBe(3);
    });

    it('should have correct pay code structure', async () => {
      const res = await request(app).get('/api/v1/pay-codes');

      const pc = res.body.data[0];
      expect(pc).toHaveProperty('payCodeId');
      expect(pc).toHaveProperty('code');
      expect(pc).toHaveProperty('name');
      expect(pc).toHaveProperty('type');
      expect(pc).toHaveProperty('description');
      expect(pc).toHaveProperty('unit');
      expect(pc).toHaveProperty('rate');
    });

    it('should include expected pay codes', async () => {
      const res = await request(app).get('/api/v1/pay-codes');

      const names = res.body.data.map((pc: Record<string, unknown>) => pc.name);
      expect(names).toContain('Fastlønn');
      expect(names).toContain('Overtid 50%');
      expect(names).toContain('Overtid 100%');
      expect(names).toContain('Sjøtillegg');
      expect(names).toContain('Skifttillegg');
      expect(names).toContain('Feriepenger');
      expect(names).toContain('Skattetrekk');
      expect(names).toContain('Pensjon');
      expect(names).toContain('Fagforeningskontingent');
      expect(names).toContain('Kuldetillegg');
    });

    it('should return codes sorted by code field', async () => {
      const res = await request(app).get('/api/v1/pay-codes');

      const codes = res.body.data.map((pc: Record<string, unknown>) => pc.code);
      const sorted = [...codes].sort();
      expect(codes).toEqual(sorted);
    });
  });

  describe('GET /api/v1/pay-codes/:id', () => {
    it('should return a single pay code', async () => {
      const res = await request(app).get('/api/v1/pay-codes/pc-fastlonn');

      expect(res.status).toBe(200);
      expect(res.body.data.payCodeId).toBe('pc-fastlonn');
      expect(res.body.data.name).toBe('Fastlønn');
      expect(res.body.data.code).toBe('1000');
    });

    it('should return 404 for non-existent pay code', async () => {
      const res = await request(app).get('/api/v1/pay-codes/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
