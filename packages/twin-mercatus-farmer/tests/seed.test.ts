import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import type Database from 'better-sqlite3';

describe('Data Seeding', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase();
    seedDatabase(db);
  });

  it('seeds 12 sites (10 sea + 2 hatchery)', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c;
    expect(count).toBe(12);

    const seaSites = (db.prepare("SELECT COUNT(*) as c FROM sites WHERE type = 'sea_site'").get() as { c: number }).c;
    expect(seaSites).toBe(10);

    const hatcheries = (db.prepare("SELECT COUNT(*) as c FROM sites WHERE type = 'hatchery'").get() as { c: number }).c;
    expect(hatcheries).toBe(2);
  });

  it('seeds at least 1 company', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM companies').get() as { c: number }).c;
    expect(count).toBeGreaterThanOrEqual(1);

    const ode = db.prepare("SELECT * FROM companies WHERE name = 'Ode AS'").get() as Record<string, unknown>;
    expect(ode).toBeDefined();
  });

  it('seeds fish groups for all sea sites across 2 year classes', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM fish_groups').get() as { c: number }).c;
    expect(count).toBe(20); // 10 sites * 2 year classes

    const yearClasses = db.prepare('SELECT DISTINCT year_class FROM fish_groups ORDER BY year_class').all() as Array<{ year_class: number }>;
    expect(yearClasses).toHaveLength(2);
    expect(yearClasses[0].year_class).toBe(2024);
    expect(yearClasses[1].year_class).toBe(2025);
  });

  it('seeds weight samples following growth model', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM weight_samples').get() as { c: number }).c;
    expect(count).toBeGreaterThan(100);

    // Check that weight increases over time for a single fish group
    const fg = db.prepare('SELECT id FROM fish_groups LIMIT 1').get() as { id: string };
    const samples = db.prepare(
      'SELECT sample_date, average_weight_grams FROM weight_samples WHERE fish_group_id = ? ORDER BY sample_date'
    ).all(fg.id) as Array<{ sample_date: string; average_weight_grams: number }>;

    expect(samples.length).toBeGreaterThan(3);

    // Overall trend should be increasing (first vs last)
    const firstWeight = samples[0].average_weight_grams;
    const lastWeight = samples[samples.length - 1].average_weight_grams;
    expect(lastWeight).toBeGreaterThan(firstWeight);
  });

  it('seeds mortality records with various causes', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM mortality').get() as { c: number }).c;
    expect(count).toBeGreaterThan(100);

    const causes = db.prepare('SELECT DISTINCT cause FROM mortality').all() as Array<{ cause: string }>;
    const causeSet = new Set(causes.map((c) => c.cause));
    expect(causeSet.size).toBeGreaterThanOrEqual(3);
    expect(causeSet.has('NATURAL')).toBe(true);
    expect(causeSet.has('DISEASE')).toBe(true);
  });

  it('seeds environment time series data', () => {
    const count = (db.prepare("SELECT COUNT(*) as c FROM time_series WHERE source = 'sensor'").get() as { c: number }).c;
    expect(count).toBeGreaterThan(1000);

    const parameters = db.prepare("SELECT DISTINCT parameter FROM time_series WHERE source = 'sensor'").all() as Array<{ parameter: string }>;
    const paramSet = new Set(parameters.map((p) => p.parameter));
    expect(paramSet.has('temperature')).toBe(true);
    expect(paramSet.has('oxygen')).toBe(true);
    expect(paramSet.has('salinity')).toBe(true);
  });

  it('seeds temperature data with seasonal patterns', () => {
    const site = db.prepare("SELECT id FROM sites WHERE type = 'sea_site' LIMIT 1").get() as { id: string };

    // Summer temperatures should be higher than winter
    const summerTemps = db.prepare(`
      SELECT AVG(value) as avg_temp FROM time_series
      WHERE site_id = ? AND parameter = 'temperature'
      AND timestamp >= '2025-07-01' AND timestamp < '2025-09-01'
    `).get(site.id) as { avg_temp: number };

    const winterTemps = db.prepare(`
      SELECT AVG(value) as avg_temp FROM time_series
      WHERE site_id = ? AND parameter = 'temperature'
      AND timestamp >= '2025-01-01' AND timestamp < '2025-03-01'
    `).get(site.id) as { avg_temp: number | null };

    // We may not have winter data if seed starts from March, so check summer exists
    expect(summerTemps.avg_temp).toBeGreaterThan(8);
    if (winterTemps.avg_temp !== null) {
      expect(summerTemps.avg_temp).toBeGreaterThan(winterTemps.avg_temp);
    }
  });

  it('seeds financial data for all sites and metrics', () => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM financial_values').get() as { c: number }).c;
    expect(count).toBeGreaterThan(100);

    const metrics = db.prepare('SELECT DISTINCT metric FROM financial_values').all() as Array<{ metric: string }>;
    const metricSet = new Set(metrics.map((m) => m.metric));
    expect(metricSet.has('FEED_COST_PER_KG')).toBe(true);
    expect(metricSet.has('FISH_COST_PER_KG')).toBe(true);
    expect(metricSet.has('INVENTORY_VALUE')).toBe(true);
    expect(metricSet.has('BIOMASS_VALUE')).toBe(true);
  });

  it('is idempotent — running seed twice produces same counts', () => {
    const countBefore = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c;

    // Re-seed
    seedDatabase(db);

    const countAfter = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c;
    expect(countAfter).toBe(countBefore);
  });

  it('is deterministic — same seed produces same data', () => {
    const site1 = db.prepare("SELECT name FROM sites WHERE type = 'sea_site' ORDER BY name LIMIT 1").get() as { name: string };

    // Create new DB and seed again
    const db2 = createDatabase();
    seedDatabase(db2);
    const site2 = db2.prepare("SELECT name FROM sites WHERE type = 'sea_site' ORDER BY name LIMIT 1").get() as { name: string };

    expect(site1.name).toBe(site2.name);
  });
});
