import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createAnalyticsRouter(db: Database.Database): Router {
  const router = Router();

  // GET /v2/analytics/volume
  router.get('/volume', (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const interval = (req.query.interval as string) || 'day';

    if (!['day', 'week', 'month'].includes(interval)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'interval must be one of: day, week, month',
        code: 400,
      });
      return;
    }

    const { where, params, joinFts } = buildFilters(q, from, to);

    let dateGroup: string;
    switch (interval) {
      case 'week':
        dateGroup = "strftime('%Y-W%W', m.publishedAt)";
        break;
      case 'month':
        dateGroup = "strftime('%Y-%m', m.publishedAt)";
        break;
      default:
        dateGroup = "strftime('%Y-%m-%d', m.publishedAt)";
    }

    const sql = `
      SELECT ${dateGroup} as period, COUNT(*) as count
      FROM mentions m
      ${joinFts}
      ${where}
      GROUP BY period
      ORDER BY period ASC
    `;

    try {
      const rows = db.prepare(sql).all(...params) as { period: string; count: number }[];
      res.json({
        interval,
        data: rows.map((r) => ({ period: r.period, count: r.count })),
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        code: 400,
      });
    }
  });

  // GET /v2/analytics/sentiment
  router.get('/sentiment', (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const { where, params, joinFts } = buildFilters(q, from, to);

    const sql = `
      SELECT
        m.sentimentLabel as label,
        COUNT(*) as count,
        AVG(m.sentimentScore) as avgScore
      FROM mentions m
      ${joinFts}
      ${where}
      GROUP BY m.sentimentLabel
      ORDER BY count DESC
    `;

    try {
      const rows = db.prepare(sql).all(...params) as {
        label: string;
        count: number;
        avgScore: number;
      }[];

      const total = rows.reduce((sum, r) => sum + r.count, 0);

      res.json({
        data: rows.map((r) => ({
          label: r.label,
          count: r.count,
          percentage: total > 0 ? Math.round((r.count / total) * 10000) / 100 : 0,
          avgScore: Math.round(r.avgScore * 100) / 100,
        })),
        total,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        code: 400,
      });
    }
  });

  // GET /v2/analytics/top-sources
  router.get('/top-sources', (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    const { where, params, joinFts } = buildFilters(q, from, to);

    const sql = `
      SELECT m.source, COUNT(*) as count
      FROM mentions m
      ${joinFts}
      ${where}
      GROUP BY m.source
      ORDER BY count DESC
      LIMIT ?
    `;

    try {
      const rows = db.prepare(sql).all(...params, limit) as { source: string; count: number }[];
      res.json({
        data: rows.map((r) => ({ source: r.source, count: r.count })),
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        code: 400,
      });
    }
  });

  // GET /v2/analytics/top-topics
  router.get('/top-topics', (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    const { where, params, joinFts } = buildFilters(q, from, to);

    // Topics are stored as JSON arrays; we need to extract them
    // SQLite doesn't have native JSON array unnesting, so we use a CTE approach
    // or just fetch and aggregate in JS
    const sql = `
      SELECT m.topics
      FROM mentions m
      ${joinFts}
      ${where}
    `;

    try {
      const rows = db.prepare(sql).all(...params) as { topics: string }[];

      const topicCounts = new Map<string, number>();
      for (const row of rows) {
        const topics: string[] = JSON.parse(row.topics);
        for (const t of topics) {
          topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
        }
      }

      const sorted = [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      res.json({
        data: sorted.map(([topic, count]) => ({ topic, count })),
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
        code: 400,
      });
    }
  });

  return router;
}

function buildFilters(
  q?: string,
  from?: string,
  to?: string
): { where: string; params: any[]; joinFts: string } {
  const clauses: string[] = [];
  const params: any[] = [];
  let joinFts = '';

  if (q && q.trim()) {
    joinFts = 'INNER JOIN mentions_fts fts ON m.rowid = fts.rowid';
    clauses.push('mentions_fts MATCH ?');
    params.push(q.trim());
  }

  if (from) {
    clauses.push('m.publishedAt >= ?');
    params.push(from);
  }

  if (to) {
    clauses.push('m.publishedAt <= ?');
    params.push(to);
  }

  const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';
  return { where, params, joinFts };
}
