import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

interface ExportData {
  documents: any[];
  format: string;
}

export interface ExportRouterOptions {
  /** Delay in ms before export completes. Default 100ms for tests. */
  processingDelayMs?: number;
  /** TTL for export data in ms. Default 1 hour. */
  expiryMs?: number;
}

export function createExportsRouter(
  db: Database.Database,
  options: ExportRouterOptions = {}
): Router {
  const router = Router();
  const { processingDelayMs = 100, expiryMs = 3600000 } = options;

  // In-memory store for export data
  const exportDataStore = new Map<string, ExportData>();

  // Cleanup expired exports periodically
  const cleanupInterval = setInterval(() => {
    const now = new Date().toISOString();
    const expired = db
      .prepare("SELECT id FROM exports WHERE expiresAt IS NOT NULL AND expiresAt < ? AND status = 'completed'")
      .all(now) as { id: string }[];
    for (const exp of expired) {
      exportDataStore.delete(exp.id);
      db.prepare("UPDATE exports SET status = 'expired' WHERE id = ?").run(exp.id);
    }
  }, 60000);

  // Attach cleanup so tests can stop it
  (router as any)._cleanupInterval = cleanupInterval;

  // POST /v2/exports - create async export
  router.post('/', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const { query, from, to, format } = req.body;

    if (!query) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'query is required',
        code: 400,
      });
      return;
    }

    if (!format || !['json', 'csv'].includes(format)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'format must be json or csv',
        code: 400,
      });
      return;
    }

    const now = new Date();
    const exportId = crypto.randomUUID();

    const exportRecord = {
      id: exportId,
      apiKey,
      query,
      fromDate: from || null,
      toDate: to || null,
      format,
      status: 'pending',
      documentCount: 0,
      createdAt: now.toISOString(),
      completedAt: null,
      expiresAt: null,
    };

    db.prepare(`
      INSERT INTO exports (id, apiKey, query, fromDate, toDate, format, status, documentCount, createdAt, completedAt, expiresAt)
      VALUES (@id, @apiKey, @query, @fromDate, @toDate, @format, @status, @documentCount, @createdAt, @completedAt, @expiresAt)
    `).run(exportRecord);

    // Simulate async processing
    setTimeout(() => {
      processExport(db, exportId, exportDataStore, expiryMs);
    }, processingDelayMs);

    res.status(202).json(formatExport(exportRecord));
  });

  // GET /v2/exports - list exports
  router.get('/', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const rows = db
      .prepare('SELECT * FROM exports WHERE apiKey = ? ORDER BY createdAt DESC')
      .all(apiKey) as any[];

    res.json({
      exports: rows.map(formatExport),
      total: rows.length,
    });
  });

  // GET /v2/exports/:id - export status
  router.get('/:id', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const row = db
      .prepare('SELECT * FROM exports WHERE id = ? AND apiKey = ?')
      .get(req.params.id, apiKey) as any;

    if (!row) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Export not found',
        code: 404,
      });
      return;
    }

    res.json(formatExport(row));
  });

  // GET /v2/exports/:id/download - download export data
  router.get('/:id/download', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const row = db
      .prepare('SELECT * FROM exports WHERE id = ? AND apiKey = ?')
      .get(req.params.id, apiKey) as any;

    if (!row) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Export not found',
        code: 404,
      });
      return;
    }

    if (row.status !== 'completed') {
      res.status(409).json({
        error: 'Conflict',
        message: `Export is ${row.status}, not ready for download`,
        code: 409,
      });
      return;
    }

    const data = exportDataStore.get(row.id);
    if (!data) {
      res.status(410).json({
        error: 'Gone',
        message: 'Export data has expired',
        code: 410,
      });
      return;
    }

    if (data.format === 'csv') {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename="export-${row.id}.csv"`);
      res.send(convertToCsv(data.documents));
    } else {
      res.set('Content-Type', 'application/json');
      res.set('Content-Disposition', `attachment; filename="export-${row.id}.json"`);
      res.json({ documents: data.documents, total: data.documents.length });
    }
  });

  return router;
}

function processExport(
  db: Database.Database,
  exportId: string,
  store: Map<string, ExportData>,
  expiryMs: number
): void {
  const exportRow = db.prepare('SELECT * FROM exports WHERE id = ?').get(exportId) as any;
  if (!exportRow) return;

  // Update status to processing
  db.prepare("UPDATE exports SET status = 'processing' WHERE id = ?").run(exportId);

  // Build query
  const clauses: string[] = [];
  const params: any[] = [];

  if (exportRow.query) {
    try {
      // Check if query is a valid FTS query by testing it
      const testSql = `SELECT COUNT(*) as c FROM mentions m INNER JOIN mentions_fts fts ON m.rowid = fts.rowid WHERE mentions_fts MATCH ?`;
      db.prepare(testSql).get(exportRow.query);

      clauses.push('mentions_fts MATCH ?');
      params.push(exportRow.query);
    } catch {
      // If FTS fails, fall back to LIKE search
      clauses.push("(m.title LIKE ? OR m.snippet LIKE ?)");
      params.push(`%${exportRow.query}%`, `%${exportRow.query}%`);
    }
  }

  if (exportRow.fromDate) {
    clauses.push('m.publishedAt >= ?');
    params.push(exportRow.fromDate);
  }

  if (exportRow.toDate) {
    clauses.push('m.publishedAt <= ?');
    params.push(exportRow.toDate);
  }

  const hasFts = clauses.length > 0 && clauses[0].includes('mentions_fts MATCH');
  const joinFts = hasFts ? 'INNER JOIN mentions_fts fts ON m.rowid = fts.rowid' : '';
  const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';

  const sql = `SELECT m.* FROM mentions m ${joinFts} ${where} ORDER BY m.publishedAt DESC`;
  const rows = db.prepare(sql).all(...params) as any[];

  const documents = rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    url: row.url,
    source: row.source,
    sourceType: row.sourceType,
    publishedAt: row.publishedAt,
    language: row.language,
    sentiment: { label: row.sentimentLabel, score: row.sentimentScore },
    reach: row.reach,
    topics: JSON.parse(row.topics),
    entities: JSON.parse(row.entities),
    country: row.country,
  }));

  store.set(exportId, { documents, format: exportRow.format });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMs);

  db.prepare(`
    UPDATE exports SET status = 'completed', documentCount = ?, completedAt = ?, expiresAt = ?
    WHERE id = ?
  `).run(documents.length, now.toISOString(), expiresAt.toISOString(), exportId);
}

function formatExport(row: any) {
  return {
    id: row.id,
    query: row.query,
    from: row.fromDate,
    to: row.toDate,
    format: row.format,
    status: row.status,
    documentCount: row.documentCount,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    expiresAt: row.expiresAt,
  };
}

function convertToCsv(documents: any[]): string {
  if (documents.length === 0) return '';

  const headers = [
    'id',
    'title',
    'snippet',
    'url',
    'source',
    'sourceType',
    'publishedAt',
    'language',
    'sentimentLabel',
    'sentimentScore',
    'reach',
    'topics',
    'entities',
    'country',
  ];

  const csvRows = [headers.join(',')];

  for (const doc of documents) {
    const values = headers.map((h) => {
      let val: any;
      if (h === 'sentimentLabel') val = doc.sentiment?.label;
      else if (h === 'sentimentScore') val = doc.sentiment?.score;
      else if (h === 'topics') val = JSON.stringify(doc.topics);
      else if (h === 'entities') val = JSON.stringify(doc.entities);
      else val = doc[h];

      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
