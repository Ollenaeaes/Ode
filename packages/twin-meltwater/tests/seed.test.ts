import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import Database from 'better-sqlite3';

describe('Seed Data Generation', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = createDatabase(':memory:');
    seedDatabase(db, { count: 500, seed: 42 });
  });

  afterAll(() => {
    db.close();
  });

  it('should generate at least 500 mentions', () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM mentions').get() as { count: number };
    expect(row.count).toBeGreaterThanOrEqual(500);
  });

  it('should produce deterministic results with same seed', () => {
    const db2 = createDatabase(':memory:');
    seedDatabase(db2, { count: 500, seed: 42 });

    const first = db.prepare('SELECT id, title FROM mentions ORDER BY publishedAt LIMIT 5').all() as any[];
    const second = db2.prepare('SELECT id, title FROM mentions ORDER BY publishedAt LIMIT 5').all() as any[];

    // Titles should be the same (IDs differ because of randomUUID)
    expect(first.map((r: any) => r.title)).toEqual(second.map((r: any) => r.title));
    db2.close();
  });

  it('should have mentions spanning the date range', () => {
    const earliest = db
      .prepare('SELECT MIN(publishedAt) as d FROM mentions')
      .get() as { d: string };
    const latest = db
      .prepare('SELECT MAX(publishedAt) as d FROM mentions')
      .get() as { d: string };

    expect(new Date(earliest.d).getFullYear()).toBe(2025);
    expect(new Date(latest.d).getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
  });

  it('should have correct sentiment distribution (approximately)', () => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM mentions').get() as any).c;
    const positive = (
      db.prepare("SELECT COUNT(*) as c FROM mentions WHERE sentimentLabel = 'positive'").get() as any
    ).c;
    const neutral = (
      db.prepare("SELECT COUNT(*) as c FROM mentions WHERE sentimentLabel = 'neutral'").get() as any
    ).c;
    const negative = (
      db.prepare("SELECT COUNT(*) as c FROM mentions WHERE sentimentLabel = 'negative'").get() as any
    ).c;

    // Allow 10% tolerance
    expect(positive / total).toBeGreaterThan(0.30);
    expect(positive / total).toBeLessThan(0.60);
    expect(neutral / total).toBeGreaterThan(0.20);
    expect(neutral / total).toBeLessThan(0.50);
    expect(negative / total).toBeGreaterThan(0.10);
    expect(negative / total).toBeLessThan(0.35);
  });

  it('should have mentions from all expected sources', () => {
    const sources = db
      .prepare('SELECT DISTINCT source FROM mentions ORDER BY source')
      .all() as { source: string }[];
    const sourceNames = sources.map((s) => s.source);

    expect(sourceNames).toContain('NRK');
    expect(sourceNames).toContain('Fiskeribladet');
    expect(sourceNames).toContain('Financial Times');
    expect(sourceNames).toContain('IntraFish');
  });

  it('should have language distribution (approximately 60% no, 30% en)', () => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM mentions').get() as any).c;
    const norwegian = (
      db.prepare("SELECT COUNT(*) as c FROM mentions WHERE language = 'no'").get() as any
    ).c;
    const english = (
      db.prepare("SELECT COUNT(*) as c FROM mentions WHERE language = 'en'").get() as any
    ).c;

    expect(norwegian / total).toBeGreaterThan(0.40);
    expect(norwegian / total).toBeLessThan(0.80);
    expect(english / total).toBeGreaterThan(0.15);
    expect(english / total).toBeLessThan(0.50);
  });

  it('should have reach values with long-tail distribution', () => {
    const lowReach = (
      db.prepare('SELECT COUNT(*) as c FROM mentions WHERE reach < 10000').get() as any
    ).c;
    const highReach = (
      db.prepare('SELECT COUNT(*) as c FROM mentions WHERE reach > 500000').get() as any
    ).c;
    const total = (db.prepare('SELECT COUNT(*) as c FROM mentions').get() as any).c;

    // Most mentions should have low reach
    expect(lowReach / total).toBeGreaterThan(0.3);
    // Few should have very high reach
    expect(highReach / total).toBeLessThan(0.15);
  });

  it('should have event spikes in the data', () => {
    // AquaNor spike around 2025-09-15
    const aquanor = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM mentions WHERE publishedAt >= '2025-09-13' AND publishedAt < '2025-09-18'"
        )
        .get() as any
    ).c;
    expect(aquanor).toBeGreaterThanOrEqual(10);

    // Snow Cod launch around 2025-11-20
    const snowCod = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM mentions WHERE publishedAt >= '2025-11-18' AND publishedAt < '2025-11-23'"
        )
        .get() as any
    ).c;
    expect(snowCod).toBeGreaterThanOrEqual(10);
  });

  it('should populate the FTS5 index', () => {
    const ftsResult = db
      .prepare(
        "SELECT COUNT(*) as c FROM mentions m INNER JOIN mentions_fts fts ON m.rowid = fts.rowid WHERE mentions_fts MATCH 'torsk OR cod'"
      )
      .get() as any;
    expect(ftsResult.c).toBeGreaterThan(0);
  });

  it('should have topics and entities as JSON arrays', () => {
    const row = db.prepare('SELECT topics, entities FROM mentions LIMIT 1').get() as any;
    const topics = JSON.parse(row.topics);
    const entities = JSON.parse(row.entities);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThan(0);
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
  });
});
