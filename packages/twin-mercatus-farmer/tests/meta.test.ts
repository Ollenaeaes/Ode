import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestToken } from '@ode/twin-foundation';
import { createApp } from '../src/index.js';
import { seedDatabase } from '../src/seed.js';
import type Database from 'better-sqlite3';

const token = createTestToken({
  sub: 'user-1',
  tid: 'tenant-1',
  roles: ['admin'],
  name: 'Kari Nordmann',
});

describe('Meta Endpoints', () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedDatabase(db);
  });

  describe('GET /api/meta/sites', () => {
    it('returns all 12 sites', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(12);
      expect(res.body.data).toHaveLength(12);
    });

    it('returns sites with correct fields', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);

      const site = res.body.data[0];
      expect(site).toHaveProperty('id');
      expect(site).toHaveProperty('name');
      expect(site).toHaveProperty('type');
      expect(site).toHaveProperty('municipality');
      expect(site).toHaveProperty('postalCode');
      expect(site).toHaveProperty('city');
      expect(site).toHaveProperty('latitude');
      expect(site).toHaveProperty('longitude');
      expect(site).toHaveProperty('active');
    });

    it('includes 10 sea sites and 2 hatcheries', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);

      const seaSites = res.body.data.filter((s: Record<string, unknown>) => s.type === 'sea_site');
      const hatcheries = res.body.data.filter((s: Record<string, unknown>) => s.type === 'hatchery');
      expect(seaSites).toHaveLength(10);
      expect(hatcheries).toHaveLength(2);
    });

    it('has coordinates in Møre og Romsdal range for sea sites', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);

      const seaSites = res.body.data.filter((s: Record<string, unknown>) => s.type === 'sea_site');
      for (const site of seaSites) {
        expect(site.latitude).toBeGreaterThanOrEqual(62.0);
        expect(site.latitude).toBeLessThanOrEqual(63.5);
        expect(site.longitude).toBeGreaterThanOrEqual(5.5);
        expect(site.longitude).toBeLessThanOrEqual(7.5);
      }
    });
  });

  describe('GET /api/meta/sites/:id', () => {
    it('returns a single site', async () => {
      // Get first site id
      const listRes = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);
      const firstSite = listRes.body.data[0];

      const res = await request(app)
        .get(`/api/meta/sites/${firstSite.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(firstSite.id);
      expect(res.body.name).toBe(firstSite.name);
    });

    it('returns 404 for non-existent site', async () => {
      const res = await request(app)
        .get('/api/meta/sites/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('GET /api/meta/companies', () => {
    it('returns Ode AS', async () => {
      const res = await request(app)
        .get('/api/meta/companies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const ode = res.body.data.find((c: Record<string, unknown>) => c.name === 'Ode AS');
      expect(ode).toBeDefined();
      expect(ode.city).toBe('Ålesund');
      expect(ode.country).toBe('Norway');
      expect(ode.orgNumber).toBeDefined();
    });

    it('returns companies with correct fields', async () => {
      const res = await request(app)
        .get('/api/meta/companies')
        .set('Authorization', `Bearer ${token}`);

      const company = res.body.data[0];
      expect(company).toHaveProperty('id');
      expect(company).toHaveProperty('name');
      expect(company).toHaveProperty('orgNumber');
      expect(company).toHaveProperty('address');
      expect(company).toHaveProperty('postalCode');
      expect(company).toHaveProperty('city');
      expect(company).toHaveProperty('country');
    });
  });

  describe('GET /api/meta/companies/:id', () => {
    it('returns a single company', async () => {
      const res = await request(app)
        .get('/api/meta/companies/company-ode-as')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Ode AS');
    });

    it('returns 404 for non-existent company', async () => {
      const res = await request(app)
        .get('/api/meta/companies/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });
});
