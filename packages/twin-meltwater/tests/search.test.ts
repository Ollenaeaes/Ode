import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp, type MeltwaterApp } from '../src/index.js';

describe('Search Media Mentions', () => {
  let mw: MeltwaterApp;
  const API_KEY = 'test-meltwater-key';

  beforeAll(() => {
    mw = createApp({
      dbPath: ':memory:',
      auth: { validKeys: [API_KEY] },
      rateLimit: { generalPerMinute: 1000, dailyDocumentQuota: 100000, hourlyPerIp: 10000 },
      seed: { count: 500, seed: 42 },
    });
  });

  afterAll(() => {
    mw.close();
  });

  it('should return 401 without apikey header', async () => {
    const res = await request(mw.app).get('/v2/search');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should return 403 with invalid apikey', async () => {
    const res = await request(mw.app).get('/v2/search').set('apikey', 'wrong-key');
    expect(res.status).toBe(403);
  });

  it('should return all mentions with no filters', async () => {
    const res = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.documents).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(500);
    expect(res.body.documents.length).toBe(25); // default limit
    expect(res.body.limit).toBe(25);
    expect(res.body.offset).toBe(0);
  });

  it('should respect limit and offset', async () => {
    const res = await request(mw.app)
      .get('/v2/search?limit=5&offset=10')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(5);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(10);
  });

  it('should search by keyword using FTS5', async () => {
    const res = await request(mw.app)
      .get('/v2/search?q=torsk')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    // Verify results contain the search term in title or snippet
    for (const doc of res.body.documents) {
      const text = (doc.title + ' ' + doc.snippet).toLowerCase();
      expect(text).toContain('torsk');
    }
  });

  it('should filter by date range', async () => {
    const res = await request(mw.app)
      .get('/v2/search?from=2025-11-01T00:00:00.000Z&to=2025-12-01T00:00:00.000Z')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    for (const doc of res.body.documents) {
      const date = new Date(doc.publishedAt);
      expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-11-01').getTime());
      expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-12-01').getTime());
    }
  });

  it('should filter by source', async () => {
    const res = await request(mw.app)
      .get('/v2/search?source=NRK')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    for (const doc of res.body.documents) {
      expect(doc.source).toBe('NRK');
    }
  });

  it('should filter by multiple sources', async () => {
    const res = await request(mw.app)
      .get('/v2/search?source=NRK,E24')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    for (const doc of res.body.documents) {
      expect(['NRK', 'E24']).toContain(doc.source);
    }
  });

  it('should filter by language', async () => {
    const res = await request(mw.app)
      .get('/v2/search?language=en')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const doc of res.body.documents) {
      expect(doc.language).toBe('en');
    }
  });

  it('should combine keyword search with filters', async () => {
    const res = await request(mw.app)
      .get('/v2/search?q=cod&language=en&limit=10')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    for (const doc of res.body.documents) {
      expect(doc.language).toBe('en');
      const text = (doc.title + ' ' + doc.snippet).toLowerCase();
      expect(text).toContain('cod');
    }
  });

  it('should return documents sorted by publishedAt descending', async () => {
    const res = await request(mw.app)
      .get('/v2/search?limit=10')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    const dates = res.body.documents.map((d: any) => new Date(d.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it('should return correct document shape', async () => {
    const res = await request(mw.app)
      .get('/v2/search?limit=1')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    const doc = res.body.documents[0];
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('title');
    expect(doc).toHaveProperty('snippet');
    expect(doc).toHaveProperty('url');
    expect(doc).toHaveProperty('source');
    expect(doc).toHaveProperty('sourceType');
    expect(doc).toHaveProperty('publishedAt');
    expect(doc).toHaveProperty('language');
    expect(doc).toHaveProperty('sentiment');
    expect(doc.sentiment).toHaveProperty('label');
    expect(doc.sentiment).toHaveProperty('score');
    expect(doc).toHaveProperty('reach');
    expect(doc).toHaveProperty('topics');
    expect(doc).toHaveProperty('entities');
    expect(doc).toHaveProperty('country');
    expect(Array.isArray(doc.topics)).toBe(true);
    expect(Array.isArray(doc.entities)).toBe(true);
  });

  it('should cap limit at 100', async () => {
    const res = await request(mw.app)
      .get('/v2/search?limit=200')
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(res.body.documents.length).toBeLessThanOrEqual(100);
  });
});
