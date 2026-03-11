import { Router } from 'express';
import type Database from 'better-sqlite3';
import { registerWebhook, getWebhooks, deleteWebhook, dispatchWebhook } from '../webhooks/dispatcher.js';

export function createWebhooksRouter(db: Database.Database): Router {
  const router = Router();

  // POST /admin/webhooks/register — register a webhook
  router.post('/register', (req, res) => {
    const { url, event } = req.body;
    if (!url || !event) {
      res.status(400).json({ statusCode: 400, message: 'url and event are required' });
      return;
    }

    const validEvents = ['stempling', 'payroll-complete'];
    if (!validEvents.includes(event)) {
      res.status(400).json({ statusCode: 400, message: `Invalid event. Must be one of: ${validEvents.join(', ')}` });
      return;
    }

    const webhook = registerWebhook(db, url, event);
    res.status(201).json(webhook);
  });

  // GET /admin/webhooks — list all active webhooks
  router.get('/', (req, res) => {
    const webhooks = getWebhooks(db);
    res.json({ value: webhooks });
  });

  // DELETE /admin/webhooks/:id — delete a webhook
  router.delete('/:id', (req, res) => {
    const deleted = deleteWebhook(db, req.params.id);
    if (!deleted) {
      res.status(404).json({ statusCode: 404, message: 'Webhook not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}

export function createEksportRouter(db: Database.Database): Router {
  const router = Router();

  // POST /admin/eksport/trigger — fires payroll-complete webhook
  router.post('/trigger', async (req, res) => {
    const result = await dispatchWebhook(db, 'payroll-complete', {
      type: 'payroll-complete',
      period: req.body?.period || new Date().toISOString().slice(0, 7),
      triggeredAt: new Date().toISOString(),
    });

    res.json({
      message: 'Payroll export triggered',
      ...result,
    });
  });

  return router;
}
