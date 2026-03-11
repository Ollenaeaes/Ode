import { Router } from 'express';
import type Database from 'better-sqlite3';
import { parseODataQuery } from '../odata/parser.js';
import { executeODataQuery } from '../odata/sql-builder.js';
import { dispatchWebhook } from '../webhooks/dispatcher.js';

export function createStemplingRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/v3/stempling — with OData support
  router.get('/', (req, res) => {
    try {
      const odata = parseODataQuery(req.query as Record<string, string>);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
      const result = executeODataQuery(db, 'stempling', odata, baseUrl);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid query';
      res.status(400).json({ statusCode: 400, message });
    }
  });

  // POST /api/v3/stempling — create stempling + fire webhooks
  router.post('/', async (req, res) => {
    const body = req.body;
    if (body.AnsattNr === undefined || body.Type === undefined) {
      res.status(400).json({ statusCode: 400, message: 'AnsattNr and Type are required' });
      return;
    }

    // Verify employee exists
    const emp = db.prepare('SELECT AnsattNr FROM ansatt WHERE AnsattNr = ?').get(body.AnsattNr);
    if (!emp) {
      res.status(404).json({ statusCode: 404, message: `Ansatt ${body.AnsattNr} not found` });
      return;
    }

    const id = crypto.randomUUID();
    const tidspunkt = body.Tidspunkt || new Date().toISOString();

    db.prepare(`
      INSERT INTO stempling (StemplingId, AnsattNr, Tidspunkt, Type, Kilde, Lokasjon, Aktivitet, Prosjekt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.AnsattNr,
      tidspunkt,
      body.Type,
      body.Kilde || 'api',
      body.Lokasjon || null,
      body.Aktivitet || null,
      body.Prosjekt || null,
    );

    const created = db.prepare('SELECT * FROM stempling WHERE StemplingId = ?').get(id);

    // Fire webhook asynchronously (don't block response)
    dispatchWebhook(db, 'stempling', created).catch(() => {});

    res.status(201).json(created);
  });

  return router;
}
