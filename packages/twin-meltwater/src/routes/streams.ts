import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

export function createStreamsRouter(db: Database.Database): Router {
  const router = Router();

  // POST /v2/streams - create a webhook stream
  router.post('/', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const { name, query, callbackUrl } = req.body;

    if (!name || !query || !callbackUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'name, query, and callbackUrl are required',
        code: 400,
      });
      return;
    }

    if (!callbackUrl.startsWith('https://')) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'callbackUrl must use HTTPS',
        code: 400,
      });
      return;
    }

    // Check max streams per API key
    const existing = db
      .prepare("SELECT COUNT(*) as count FROM streams WHERE apiKey = ? AND status = 'active'")
      .get(apiKey) as { count: number };

    if (existing.count >= 5) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Maximum of 5 active streams per API key',
        code: 409,
      });
      return;
    }

    const now = new Date().toISOString();
    const stream = {
      id: crypto.randomUUID(),
      apiKey,
      name,
      query,
      callbackUrl,
      status: 'active',
      deliveryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT INTO streams (id, apiKey, name, query, callbackUrl, status, deliveryCount, createdAt, updatedAt)
      VALUES (@id, @apiKey, @name, @query, @callbackUrl, @status, @deliveryCount, @createdAt, @updatedAt)
    `).run(stream);

    res.status(201).json(formatStream(stream));
  });

  // GET /v2/streams - list streams
  router.get('/', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const rows = db
      .prepare('SELECT * FROM streams WHERE apiKey = ? ORDER BY createdAt DESC')
      .all(apiKey) as any[];

    res.json({
      streams: rows.map(formatStream),
      total: rows.length,
    });
  });

  // GET /v2/streams/:id - stream details
  router.get('/:id', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const row = db
      .prepare('SELECT * FROM streams WHERE id = ? AND apiKey = ?')
      .get(req.params.id, apiKey) as any;

    if (!row) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Stream not found',
        code: 404,
      });
      return;
    }

    res.json(formatStream(row));
  });

  // DELETE /v2/streams/:id - deactivate stream
  router.delete('/:id', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey as string;
    const row = db
      .prepare('SELECT * FROM streams WHERE id = ? AND apiKey = ?')
      .get(req.params.id, apiKey) as any;

    if (!row) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Stream not found',
        code: 404,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE streams SET status = 'inactive', updatedAt = ? WHERE id = ?").run(
      now,
      req.params.id
    );

    res.status(204).send();
  });

  return router;
}

function formatStream(row: any) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    callbackUrl: row.callbackUrl,
    status: row.status,
    deliveryCount: row.deliveryCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
