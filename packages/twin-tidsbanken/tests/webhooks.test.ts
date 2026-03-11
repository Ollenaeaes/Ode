import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import { createTestApp } from './helpers.js';

describe('Webhook Endpoints', () => {
  let request: supertest.Agent;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
  });

  describe('POST /admin/webhooks/register', () => {
    it('registers a webhook', async () => {
      const res = await request
        .post('/admin/webhooks/register')
        .send({ url: 'http://example.com/hook', event: 'stempling' });
      expect(res.status).toBe(201);
      expect(res.body.WebhookId).toBeDefined();
      expect(res.body.Url).toBe('http://example.com/hook');
      expect(res.body.Event).toBe('stempling');
    });

    it('returns 400 for missing fields', async () => {
      const res = await request
        .post('/admin/webhooks/register')
        .send({ url: 'http://example.com/hook' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid event', async () => {
      const res = await request
        .post('/admin/webhooks/register')
        .send({ url: 'http://example.com/hook', event: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /admin/webhooks', () => {
    it('returns registered webhooks', async () => {
      // Register one first
      await request
        .post('/admin/webhooks/register')
        .send({ url: 'http://example.com/test', event: 'payroll-complete' });

      const res = await request.get('/admin/webhooks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
      expect(res.body.value.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /admin/webhooks/:id', () => {
    it('deletes a webhook', async () => {
      // Register one
      const created = await request
        .post('/admin/webhooks/register')
        .send({ url: 'http://example.com/delete-me', event: 'stempling' });

      const res = await request.delete(`/admin/webhooks/${created.body.WebhookId}`);
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await request.delete('/admin/webhooks/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /admin/eksport/trigger', () => {
    it('triggers payroll export', async () => {
      const res = await request
        .post('/admin/eksport/trigger')
        .send({ period: '2025-10' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Payroll export triggered');
      expect(res.body).toHaveProperty('dispatched');
      expect(res.body).toHaveProperty('failed');
    });
  });
});
