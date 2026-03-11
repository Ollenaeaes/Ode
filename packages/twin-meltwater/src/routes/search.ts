import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createSearchRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const source = req.query.source as string | undefined;
    const language = req.query.language as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    let whereClauses: string[] = [];
    let params: any[] = [];

    // FTS5 search
    let usesFts = false;
    if (q && q.trim()) {
      // Get matching rowids from FTS
      usesFts = true;
    }

    if (from) {
      whereClauses.push('m.publishedAt >= ?');
      params.push(from);
    }

    if (to) {
      whereClauses.push('m.publishedAt <= ?');
      params.push(to);
    }

    if (source) {
      // Support comma-separated sources
      const sources = source.split(',').map((s) => s.trim());
      whereClauses.push(`m.source IN (${sources.map(() => '?').join(',')})`);
      params.push(...sources);
    }

    if (language) {
      const languages = language.split(',').map((l) => l.trim());
      whereClauses.push(`m.language IN (${languages.map(() => '?').join(',')})`);
      params.push(...languages);
    }

    let countSql: string;
    let dataSql: string;

    if (usesFts && q) {
      // Use FTS5 for text search
      const ftsWhere = whereClauses.length > 0 ? ' AND ' + whereClauses.join(' AND ') : '';

      countSql = `
        SELECT COUNT(*) as total
        FROM mentions m
        INNER JOIN mentions_fts fts ON m.rowid = fts.rowid
        WHERE mentions_fts MATCH ?${ftsWhere}
      `;

      dataSql = `
        SELECT m.*
        FROM mentions m
        INNER JOIN mentions_fts fts ON m.rowid = fts.rowid
        WHERE mentions_fts MATCH ?${ftsWhere}
        ORDER BY m.publishedAt DESC
        LIMIT ? OFFSET ?
      `;

      // FTS query param comes first
      const ftsQuery = q.trim();
      const countParams = [ftsQuery, ...params];
      const dataParams = [ftsQuery, ...params, limit, offset];

      try {
        const countRow = db.prepare(countSql).get(...countParams) as { total: number };
        const rows = db.prepare(dataSql).all(...dataParams) as any[];

        res.json({
          documents: rows.map(formatMention),
          total: countRow.total,
          limit,
          offset,
        });
      } catch (err: any) {
        // FTS5 query syntax error
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid search query: ${err.message}`,
          code: 400,
        });
      }
    } else {
      // No text search, just filters
      const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

      countSql = `SELECT COUNT(*) as total FROM mentions m ${where}`;
      dataSql = `SELECT m.* FROM mentions m ${where} ORDER BY m.publishedAt DESC LIMIT ? OFFSET ?`;

      const countRow = db.prepare(countSql).get(...params) as { total: number };
      const dataParams = [...params, limit, offset];
      const rows = db.prepare(dataSql).all(...dataParams) as any[];

      res.json({
        documents: rows.map(formatMention),
        total: countRow.total,
        limit,
        offset,
      });
    }
  });

  return router;
}

function formatMention(row: any) {
  return {
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    url: row.url,
    source: row.source,
    sourceType: row.sourceType,
    publishedAt: row.publishedAt,
    language: row.language,
    sentiment: {
      label: row.sentimentLabel,
      score: row.sentimentScore,
    },
    reach: row.reach,
    topics: JSON.parse(row.topics),
    entities: JSON.parse(row.entities),
    country: row.country,
  };
}
