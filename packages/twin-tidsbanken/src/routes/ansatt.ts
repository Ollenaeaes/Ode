import { Router } from 'express';
import type Database from 'better-sqlite3';
import { parseODataQuery } from '../odata/parser.js';
import { executeODataQuery } from '../odata/sql-builder.js';

export function createAnsattRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/v3/ansatt — list all employees with OData support
  router.get('/', (req, res) => {
    try {
      const odata = parseODataQuery(req.query as Record<string, string>);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
      const result = executeODataQuery(db, 'ansatt', odata, baseUrl);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid query';
      res.status(400).json({ statusCode: 400, message });
    }
  });

  // GET /api/v3/ansatt(:id) — single employee by AnsattNr (OData key syntax)
  // Express uses regex to match OData-style key: ansatt(1001)
  // The router receives the path after stripping the base, so we match "/:key"
  // where key looks like "(1001)" or just a number
  router.get('/:key', (req, res) => {
    // Support both OData format (1001) and plain /1001
    const keyStr = req.params.key.replace(/^\(/, '').replace(/\)$/, '');
    const id = parseInt(keyStr, 10);
    if (isNaN(id)) {
      res.status(400).json({ statusCode: 400, message: 'Invalid AnsattNr' });
      return;
    }
    const row = db.prepare('SELECT * FROM ansatt WHERE AnsattNr = ?').get(id);
    if (!row) {
      res.status(404).json({ statusCode: 404, message: `Ansatt ${id} not found` });
      return;
    }
    res.json(row);
  });

  // POST /api/v3/ansatt — create employee
  router.post('/', (req, res) => {
    const body = req.body;
    if (!body.Fornavn || !body.Etternavn || !body.Avdeling) {
      res.status(400).json({ statusCode: 400, message: 'Fornavn, Etternavn, and Avdeling are required' });
      return;
    }

    // Auto-assign AnsattNr
    const maxNr = db.prepare('SELECT MAX(AnsattNr) as maxNr FROM ansatt').get() as { maxNr: number | null };
    const ansattNr = (maxNr.maxNr || 1000) + 1;

    const stmt = db.prepare(`
      INSERT INTO ansatt (AnsattNr, Fornavn, Etternavn, Epost, Mobil, Stilling, Avdeling, AvdelingNavn, Lokasjon, LokasjonNavn, Aktiv, Ansattdato, Stillingsprosent, Arbeidstype)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      ansattNr,
      body.Fornavn,
      body.Etternavn,
      body.Epost || `${body.Fornavn.toLowerCase()}.${body.Etternavn.toLowerCase()}@ode.no`,
      body.Mobil || '',
      body.Stilling || 'Medarbeider',
      body.Avdeling,
      body.AvdelingNavn || '',
      body.Lokasjon || '',
      body.LokasjonNavn || '',
      body.Aktiv ?? 1,
      body.Ansattdato || new Date().toISOString().split('T')[0],
      body.Stillingsprosent ?? 100,
      body.Arbeidstype || 'FAST',
    );

    const created = db.prepare('SELECT * FROM ansatt WHERE AnsattNr = ?').get(ansattNr);
    res.status(201).json(created);
  });

  return router;
}
