import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp, type MeltwaterApp } from '../src/index.js';

describe('Data Streams (Webhooks)', () => {
  let mw: MeltwaterApp;
  const API_KEY = 'test-meltwater-key';
  const API_KEY_2 = 'test-meltwater-key-2';

  beforeAll(() => {
    mw = createApp({
      dbPath: ':memory:',
      auth: { validKeys: [API_KEY, API_KEY_2] },
      rateLimit: { generalPerMinute: 1000, dailyDocumentQuota: 100000, hourlyPerIp: 10000 },
      seed: { count: 100, seed: 42 },
    });
  });

  afterAll(() => {
    mw.close();
  });

  it('should create a stream', async () => {
    const res = await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({
        name: 'Ode mentions',
        query: 'Ode OR torsk',
        callbackUrl: 'https://example.com/webhook',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Ode mentions');
    expect(res.body.query).toBe('Ode OR torsk');
    expect(res.body.callbackUrl).toBe('https://example.com/webhook');
    expect(res.body.status).toBe('active');
    expect(res.body.deliveryCount).toBe(0);
  });

  it('should reject non-HTTPS callback URL', async () => {
    const res = await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({
        name: 'Bad stream',
        query: 'test',
        callbackUrl: 'http://example.com/webhook',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('HTTPS');
  });

  it('should reject stream without required fields', async () => {
    const res = await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({ name: 'Missing fields' });
    expect(res.status).toBe(400);
  });

  it('should list streams for the current API key', async () => {
    // Create another stream
    await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({
        name: 'Second stream',
        query: 'seafood',
        callbackUrl: 'https://example.com/webhook2',
      });

    const res = await request(mw.app).get('/v2/streams').set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.streams.length).toBeGreaterThanOrEqual(2);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('should not return streams from another API key', async () => {
    await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY_2)
      .send({
        name: 'Other key stream',
        query: 'other',
        callbackUrl: 'https://example.com/other',
      });

    const res = await request(mw.app).get('/v2/streams').set('apikey', API_KEY);
    for (const stream of res.body.streams) {
      expect(stream.name).not.toBe('Other key stream');
    }
  });

  it('should get a specific stream by ID', async () => {
    const created = await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({
        name: 'Specific stream',
        query: 'specific',
        callbackUrl: 'https://example.com/specific',
      });

    const res = await request(mw.app)
      .get(`/v2/streams/${created.body.id}`)
      .set('apikey', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.name).toBe('Specific stream');
  });

  it('should return 404 for non-existent stream', async () => {
    const res = await request(mw.app)
      .get('/v2/streams/nonexistent-id')
      .set('apikey', API_KEY);
    expect(res.status).toBe(404);
  });

  it('should deactivate a stream', async () => {
    const created = await request(mw.app)
      .post('/v2/streams')
      .set('apikey', API_KEY)
      .send({
        name: 'To deactivate',
        query: 'deactivate',
        callbackUrl: 'https://example.com/deactivate',
      });

    const deleteRes = await request(mw.app)
      .delete(`/v2/streams/${created.body.id}`)
      .set('apikey', API_KEY);
    expect(deleteRes.status).toBe(204);

    // Verify it's inactive
    const getRes = await request(mw.app)
      .get(`/v2/streams/${created.body.id}`)
      .set('apikey', API_KEY);
    expect(getRes.body.status).toBe('inactive');
  });

  it('should enforce max 5 active streams per API key', async () => {
    // Create a fresh app for this test
    const fresh = createApp({
      dbPath: ':memory:',
      auth: { validKeys: ['limit-test-key'] },
      rateLimit: { generalPerMinute: 1000, dailyDocumentQuota: 100000, hourlyPerIp: 10000 },
      seed: { count: 10, seed: 42 },
    });

    // Create 5 streams
    for (let i = 0; i < 5; i++) {
      const res = await request(fresh.app)
        .post('/v2/streams')
        .set('apikey', 'limit-test-key')
        .send({
          name: `Stream ${i}`,
          query: `query-${i}`,
          callbackUrl: `https://example.com/stream-${i}`,
        });
      expect(res.status).toBe(201);
    }

    // 6th should fail
    const res = await request(fresh.app)
      .post('/v2/streams')
      .set('apikey', 'limit-test-key')
      .send({
        name: 'Stream 6',
        query: 'query-6',
        callbackUrl: 'https://example.com/stream-6',
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Maximum');

    fresh.close();
  });
});
