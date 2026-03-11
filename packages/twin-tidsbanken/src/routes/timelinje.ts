import { Router } from 'express';
import type Database from 'better-sqlite3';
import { parseODataQuery } from '../odata/parser.js';
import { executeODataQuery } from '../odata/sql-builder.js';

export function createTimelinjeRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/v3/timelinje — with OData support
  router.get('/', (req, res) => {
    try {
      const odata = parseODataQuery(req.query as Record<string, string>);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
      const result = executeODataQuery(db, 'timelinje', odata, baseUrl);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid query';
      res.status(400).json({ statusCode: 400, message });
    }
  });

  // POST /api/v3/timelinje — create time entry
  router.post('/', (req, res) => {
    const body = req.body;
    if (body.AnsattNr === undefined || !body.Dato) {
      res.status(400).json({ statusCode: 400, message: 'AnsattNr and Dato are required' });
      return;
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO timelinje (TimelinjeId, AnsattNr, Dato, Timer, Overtid, Fraverstype, Aktivitet, Prosjekt, Arbeidstype, Godkjent, Kommentar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.AnsattNr,
      body.Dato,
      body.Timer ?? 0,
      body.Overtid ?? 0,
      body.Fraverstype || null,
      body.Aktivitet || null,
      body.Prosjekt || null,
      body.Arbeidstype || null,
      body.Godkjent ?? 0,
      body.Kommentar || null,
    );

    const created = db.prepare('SELECT * FROM timelinje WHERE TimelinjeId = ?').get(id);
    res.status(201).json(created);
  });

  return router;
}
