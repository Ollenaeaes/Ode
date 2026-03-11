import { Router } from 'express';
import type Database from 'better-sqlite3';
import { parseODataQuery } from '../odata/parser.js';
import { executeODataQuery } from '../odata/sql-builder.js';

export function createProsjektRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/v3/prosjekt
  router.get('/', (req, res) => {
    try {
      const odata = parseODataQuery(req.query as Record<string, string>);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
      const result = executeODataQuery(db, 'prosjekt', odata, baseUrl);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid query';
      res.status(400).json({ statusCode: 400, message });
    }
  });

  return router;
}

export function createProsjektlinjeRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/v3/prosjektlinje
  router.get('/', (req, res) => {
    try {
      const odata = parseODataQuery(req.query as Record<string, string>);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
      const result = executeODataQuery(db, 'prosjektlinje', odata, baseUrl);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid query';
      res.status(400).json({ statusCode: 400, message });
    }
  });

  return router;
}
