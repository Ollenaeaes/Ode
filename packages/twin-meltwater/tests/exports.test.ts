import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp, type MeltwaterApp } from '../src/index.js';

describe('Export Endpoints', () => {
  let mw: MeltwaterApp;
  const API_KEY = 'test-meltwater-key';

  beforeAll(() => {
    mw = createApp({
      dbPath: ':memory:',
      auth: { validKeys: [API_KEY] },
      rateLimit: { exportPerMinute: 1000, dailyDocumentQuota: 100000, hourlyPerIp: 10000 },
      seed: { count: 100, seed: 42 },
      export: { processingDelayMs: 50, expiryMs: 3600000 },
    });
  });

  afterAll(() => {
    mw.close();
  });

  it('should create an export job', async () => {
    const res = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ query: 'torsk', format: 'json' });
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('id');
    expect(res.body.query).toBe('torsk');
    expect(res.body.format).toBe('json');
    expect(res.body.status).toBe('pending');
  });

  it('should reject export without query', async () => {
    const res = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ format: 'json' });
    expect(res.status).toBe(400);
  });

  it('should reject export with invalid format', async () => {
    const res = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ query: 'test', format: 'xml' });
    expect(res.status).toBe(400);
  });

  it('should list exports', async () => {
    const res = await request(mw.app).get('/v2/exports').set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.exports.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('should complete export and allow download (JSON)', async () => {
    const createRes = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ query: 'torsk', format: 'json' });
    const exportId = createRes.body.id;

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check status
    const statusRes = await request(mw.app)
      .get(`/v2/exports/${exportId}`)
      .set('apikey', API_KEY);
    expect(statusRes.body.status).toBe('completed');
    expect(statusRes.body.documentCount).toBeGreaterThan(0);

    // Download
    const downloadRes = await request(mw.app)
      .get(`/v2/exports/${exportId}/download`)
      .set('apikey', API_KEY);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.body.documents).toBeDefined();
    expect(downloadRes.body.documents.length).toBeGreaterThan(0);
    expect(downloadRes.body.total).toBeGreaterThan(0);
  });

  it('should complete export and allow download (CSV)', async () => {
    const createRes = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ query: 'cod', format: 'csv' });
    const exportId = createRes.body.id;

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Download
    const downloadRes = await request(mw.app)
      .get(`/v2/exports/${exportId}/download`)
      .set('apikey', API_KEY);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('text/csv');
    expect(downloadRes.text).toContain('id,title,snippet');
  });

  it('should reject download of pending export', async () => {
    const createRes = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({ query: 'test-no-wait', format: 'json' });

    // Immediately try to download (before processing completes)
    const downloadRes = await request(mw.app)
      .get(`/v2/exports/${createRes.body.id}/download`)
      .set('apikey', API_KEY);
    expect(downloadRes.status).toBe(409);
  });

  it('should return 404 for non-existent export', async () => {
    const res = await request(mw.app)
      .get('/v2/exports/nonexistent-id')
      .set('apikey', API_KEY);
    expect(res.status).toBe(404);
  });

  it('should support date range in export', async () => {
    const createRes = await request(mw.app)
      .post('/v2/exports')
      .set('apikey', API_KEY)
      .send({
        query: 'torsk',
        from: '2025-11-01T00:00:00.000Z',
        to: '2025-12-01T00:00:00.000Z',
        format: 'json',
      });
    expect(createRes.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const downloadRes = await request(mw.app)
      .get(`/v2/exports/${createRes.body.id}/download`)
      .set('apikey', API_KEY);
    expect(downloadRes.status).toBe(200);

    for (const doc of downloadRes.body.documents) {
      const date = new Date(doc.publishedAt);
      expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-11-01').getTime());
      expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-12-01').getTime());
    }
  });
});
