import type DatabaseType from 'better-sqlite3';
import { ODE_SEA_SITES, ODE_HATCHERIES, ode } from '@ode/twin-foundation';
import { createDatabase } from './db.js';

/**
 * Site coordinates — Møre og Romsdal coastline
 * lat ~62.3-63.5 N, lon ~5.5-7.5 E
 */
const SITE_COORDINATES: Record<string, { latitude: number; longitude: number; capacityMt: number }> = {
  'Storfjorden':      { latitude: 62.2200, longitude: 7.0500, capacityMt: 3600 },
  'Hjørundfjorden':   { latitude: 62.2500, longitude: 6.2000, capacityMt: 3200 },
  'Hareidlandet':     { latitude: 62.3700, longitude: 5.6800, capacityMt: 2800 },
  'Sula':             { latitude: 62.4200, longitude: 5.9800, capacityMt: 3000 },
  'Giske':            { latitude: 62.4900, longitude: 5.9200, capacityMt: 2600 },
  'Ellingsøya':       { latitude: 62.4700, longitude: 6.0300, capacityMt: 2400 },
  'Lepsøya':          { latitude: 62.5500, longitude: 6.3500, capacityMt: 2200 },
  'Ona':              { latitude: 62.8600, longitude: 6.5400, capacityMt: 3400 },
  'Sandøya':          { latitude: 62.4500, longitude: 5.8900, capacityMt: 2000 },
  'Kvamsøya':         { latitude: 62.1500, longitude: 5.6000, capacityMt: 2800 },
  // Hatcheries
  'Ode Settefisk Rødberg':     { latitude: 60.2300, longitude: 8.9700, capacityMt: 500 },
  'Lumarine Tjeldbergodden':   { latitude: 63.3700, longitude: 8.7200, capacityMt: 800 },
};

/** Seed names matching the spec */
const SPEC_SITE_NAMES: Record<string, string> = {
  'Storfjorden': 'Apalset',
  'Hjørundfjorden': 'Alida',
  'Hareidlandet': 'Vorpneset',
  'Sula': 'Aukan',
  'Giske': 'Stoylen',
  'Ellingsøya': 'Dysjaneset',
  'Lepsøya': 'Jonskjaer',
  'Ona': 'Svartekari',
  'Sandøya': 'Rekvika',
  'Kvamsøya': 'Stokkeneset',
};

/**
 * Seed the database with all reference data and 12 months of history.
 * Idempotent: clears existing data and re-seeds.
 * Deterministic: uses ode.seed(42) for reproducible output.
 */
export function seedDatabase(db: DatabaseType.Database): void {
  ode.seed(42);

  // Clear existing data (order matters due to foreign keys)
  db.exec(`
    DELETE FROM financial_values;
    DELETE FROM time_series;
    DELETE FROM harvest_imports;
    DELETE FROM mortality;
    DELETE FROM weight_samples;
    DELETE FROM fish_groups;
    DELETE FROM sites;
    DELETE FROM companies;
  `);

  // Seed companies
  seedCompanies(db);

  // Seed sites (sea sites + hatcheries)
  seedSites(db);

  // Seed fish groups
  const fishGroups = seedFishGroups(db);

  // Seed biology data
  seedWeightSamples(db, fishGroups);
  seedMortality(db, fishGroups);

  // Seed environment time series
  seedEnvironmentData(db);

  // Seed financial data
  seedFinancialData(db);
}

function seedCompanies(db: DatabaseType.Database): void {
  const stmt = db.prepare(`
    INSERT INTO companies (id, name, org_number, address, postal_code, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    'company-ode-as',
    'Ode AS',
    '923456789',
    'Kongensgate 12',
    '6003',
    'Ålesund',
    'Norway',
  );
}

function seedSites(db: DatabaseType.Database): void {
  const stmt = db.prepare(`
    INSERT INTO sites (id, name, type, municipality, postal_code, city, latitude, longitude, capacity_mt, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sea sites
  for (const site of ODE_SEA_SITES) {
    const specName = SPEC_SITE_NAMES[site.name] || site.name;
    const coords = SITE_COORDINATES[site.name] || { latitude: 62.4, longitude: 6.0, capacityMt: 2500 };
    const id = `site-${specName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    stmt.run(
      id,
      specName,
      'sea_site',
      site.municipality,
      site.postalCode,
      site.city,
      coords.latitude,
      coords.longitude,
      coords.capacityMt,
      1,
    );
  }

  // Hatcheries
  for (const hatchery of ODE_HATCHERIES) {
    const coords = SITE_COORDINATES[hatchery.name] || { latitude: 62.0, longitude: 7.0, capacityMt: 500 };
    const shortName = hatchery.name.includes('Rødberg') ? 'Rodberg' : 'Tjeldbergodden';
    const id = `site-${shortName.toLowerCase()}`;

    stmt.run(
      id,
      shortName,
      'hatchery',
      hatchery.municipality,
      hatchery.postalCode,
      hatchery.city,
      coords.latitude,
      coords.longitude,
      coords.capacityMt,
      1,
    );
  }
}

interface FishGroup {
  id: string;
  siteId: string;
  stockingDate: string;
  initialCount: number;
  initialWeightGrams: number;
  yearClass: number;
}

function seedFishGroups(db: DatabaseType.Database): FishGroup[] {
  const sites = db.prepare("SELECT id FROM sites WHERE type = 'sea_site'").all() as Array<{ id: string }>;
  const stmt = db.prepare(`
    INSERT INTO fish_groups (id, site_id, species, year_class, stocking_date, initial_count, initial_weight_grams, current_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const fishGroups: FishGroup[] = [];

  // Generate cohorts with staggered deployment across 2 year classes
  for (const yearClass of [2024, 2025]) {
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      // Stagger stocking: March-September, spread evenly across sites
      const month = 3 + Math.floor((i / sites.length) * 7);
      const day = 10 + (i % 15);
      const stockingDate = `${yearClass}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const initialCount = 80000 + (i * 12000);
      const initialWeightGrams = 100 + (i * 15);
      const id = `fg-${yearClass}-${site.id.replace('site-', '')}`;

      const status = yearClass === 2024 ? 'active' : 'active';
      const currentCount = Math.floor(initialCount * (yearClass === 2024 ? 0.88 : 0.95));

      stmt.run(
        id,
        site.id,
        'Gadus morhua',
        yearClass,
        stockingDate,
        initialCount,
        initialWeightGrams,
        currentCount,
        status,
      );

      fishGroups.push({ id, siteId: site.id, stockingDate, initialCount, initialWeightGrams, yearClass });
    }
  }

  return fishGroups;
}

function seedWeightSamples(db: DatabaseType.Database, fishGroups: FishGroup[]): void {
  const stmt = db.prepare(`
    INSERT INTO weight_samples (id, site_id, fish_group_id, sample_date, count, average_weight_grams, min_weight_grams, max_weight_grams, std_dev_grams, condition_factor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const fg of fishGroups) {
      const stockingDate = new Date(fg.stockingDate);
      const now = new Date('2026-03-01');

      // Monthly weight samples following cod growth model
      // Cod: ~200g start -> 4000g+ over 20-24 months
      let currentDate = new Date(stockingDate);
      currentDate.setMonth(currentDate.getMonth() + 1); // First sample 1 month after stocking

      let sampleIdx = 0;
      while (currentDate <= now) {
        const monthsFromStocking = (currentDate.getFullYear() - stockingDate.getFullYear()) * 12
          + (currentDate.getMonth() - stockingDate.getMonth());

        // Cod growth curve: roughly exponential early, then flattening
        // Gompertz-like: W = Wmax * exp(-exp(-k * (t - t0)))
        const maxWeight = 5000; // grams
        const k = 0.15;
        const t0 = 10; // months to inflection
        const growthFactor = Math.exp(-Math.exp(-k * (monthsFromStocking - t0)));
        const avgWeight = fg.initialWeightGrams + (maxWeight - fg.initialWeightGrams) * growthFactor;

        // Add seasonal variation (slower growth in winter)
        const monthOfYear = currentDate.getMonth();
        const seasonalFactor = 1.0 + 0.1 * Math.sin((monthOfYear - 3) * Math.PI / 6); // Peak growth in summer
        const adjustedWeight = avgWeight * seasonalFactor;

        const stdDev = adjustedWeight * 0.15; // 15% CV typical for farmed cod
        const minWeight = Math.max(adjustedWeight - 2 * stdDev, fg.initialWeightGrams);
        const maxWeightSample = adjustedWeight + 2 * stdDev;

        // Condition factor for cod: typically 0.8-1.2
        const conditionFactor = 0.9 + 0.2 * Math.sin((monthOfYear - 1) * Math.PI / 6);

        const sampleDate = currentDate.toISOString().split('T')[0];
        const id = `ws-${fg.id}-${sampleIdx}`;

        stmt.run(
          id,
          fg.siteId,
          fg.id,
          sampleDate,
          50, // Standard sample size
          Math.round(adjustedWeight * 10) / 10,
          Math.round(minWeight * 10) / 10,
          Math.round(maxWeightSample * 10) / 10,
          Math.round(stdDev * 10) / 10,
          Math.round(conditionFactor * 100) / 100,
        );

        sampleIdx++;
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
  });

  insertMany();
}

function seedMortality(db: DatabaseType.Database, fishGroups: FishGroup[]): void {
  const stmt = db.prepare(`
    INSERT INTO mortality (id, site_id, fish_group_id, record_date, count, cause, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const causes = ['NATURAL', 'DISEASE', 'HANDLING', 'PREDATION', 'ENVIRONMENT', 'UNKNOWN'] as const;
  const causeWeights = [0.4, 0.15, 0.1, 0.15, 0.1, 0.1]; // Probability distribution

  const insertMany = db.transaction(() => {
    let recordIdx = 0;

    for (const fg of fishGroups) {
      const stockingDate = new Date(fg.stockingDate);
      const now = new Date('2026-03-01');

      // Weekly mortality records
      let currentDate = new Date(stockingDate);
      currentDate.setDate(currentDate.getDate() + 7);

      while (currentDate <= now) {
        // Background mortality rate: ~0.01-0.03% per week for cod
        const baseRate = 0.0002;
        const weekOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Seasonal adjustment: higher mortality in winter storms
        const seasonalFactor = 1.0 + 0.5 * Math.cos((weekOfYear - 4) * Math.PI / 26);

        // Occasional spikes (roughly every 3 months per site)
        const isSpike = (recordIdx % 13 === 7);
        const spikeFactor = isSpike ? 5.0 : 1.0;

        const mortalityCount = Math.max(1, Math.round(
          fg.initialCount * baseRate * seasonalFactor * spikeFactor
        ));

        // Pick cause based on weighted distribution
        const rand = (recordIdx * 7 + 3) % 100 / 100;
        let cumWeight = 0;
        let cause = causes[0];
        for (let i = 0; i < causes.length; i++) {
          cumWeight += causeWeights[i];
          if (rand < cumWeight) {
            cause = causes[i];
            break;
          }
        }

        // Spikes tend to be disease or environment
        if (isSpike) {
          cause = recordIdx % 2 === 0 ? 'DISEASE' : 'ENVIRONMENT';
        }

        const recordDate = currentDate.toISOString().split('T')[0];
        const id = `mort-${fg.id}-${recordIdx}`;

        stmt.run(
          id,
          fg.siteId,
          fg.id,
          recordDate,
          mortalityCount,
          cause,
          isSpike ? 'Elevated mortality event' : null,
        );

        recordIdx++;
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
  });

  insertMany();
}

function seedEnvironmentData(db: DatabaseType.Database): void {
  const sites = db.prepare("SELECT id FROM sites WHERE type = 'sea_site'").all() as Array<{ id: string }>;

  const stmt = db.prepare(`
    INSERT INTO time_series (site_id, parameter, timestamp, value, unit, source)
    VALUES (?, ?, ?, ?, ?, 'sensor')
  `);

  const parameters = [
    { name: 'temperature', unit: '°C', base: 8, amplitude: 5, noise: 0.5 },
    { name: 'oxygen', unit: 'mg/L', base: 9, amplitude: 1.5, noise: 0.3 },
    { name: 'salinity', unit: 'PSU', base: 33, amplitude: 1, noise: 0.2 },
  ];

  // 12 months of data at 15-min intervals = ~35,000 records per parameter per site
  // That's too much for in-memory tests, so we use 6-hour intervals for the seed
  // (4 readings per day * 365 days * 10 sites * 3 params = ~43,800 records)
  const INTERVAL_HOURS = 6;
  const startDate = new Date('2025-03-01T00:00:00Z');
  const endDate = new Date('2026-03-01T00:00:00Z');

  const insertMany = db.transaction(() => {
    for (const site of sites) {
      // Use site index as seed offset for per-site variation
      const siteIndex = sites.indexOf(site);

      for (const param of parameters) {
        let current = new Date(startDate);

        while (current <= endDate) {
          // Day of year for seasonal pattern
          const dayOfYear = Math.floor(
            (current.getTime() - new Date(current.getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)
          );

          // Hour of day for diurnal pattern
          const hourOfDay = current.getUTCHours();

          // Seasonal: sine wave peaking in August (day ~220)
          const seasonal = param.amplitude * Math.sin((dayOfYear - 80) * 2 * Math.PI / 365);

          // Diurnal: small variation through the day
          const diurnal = (param.amplitude * 0.1) * Math.sin((hourOfDay - 6) * 2 * Math.PI / 24);

          // Per-site offset
          const siteOffset = (siteIndex - 5) * 0.2;

          // Deterministic noise based on timestamp
          const noiseInput = (current.getTime() / 1000 + siteIndex * 1000 + parameters.indexOf(param) * 333) % 1000;
          const noise = param.noise * Math.sin(noiseInput * 2.71828);

          const value = param.base + seasonal + diurnal + siteOffset + noise;

          stmt.run(
            site.id,
            param.name,
            current.toISOString(),
            Math.round(value * 100) / 100,
            param.unit,
          );

          current = new Date(current.getTime() + INTERVAL_HOURS * 60 * 60 * 1000);
        }
      }
    }
  });

  insertMany();
}

function seedFinancialData(db: DatabaseType.Database): void {
  const sites = db.prepare("SELECT id FROM sites WHERE type = 'sea_site'").all() as Array<{ id: string }>;

  const stmt = db.prepare(`
    INSERT INTO financial_values (id, site_id, metric, period, value, currency)
    VALUES (?, ?, ?, ?, ?, 'NOK')
  `);

  const metrics = [
    { name: 'FEED_COST_PER_KG', base: 12.5, variance: 2.0 },
    { name: 'FISH_COST_PER_KG', base: 45.0, variance: 5.0 },
    { name: 'INVENTORY_VALUE', base: 15000000, variance: 3000000 },
    { name: 'BIOMASS_VALUE', base: 25000000, variance: 5000000 },
  ];

  const insertMany = db.transaction(() => {
    let idx = 0;
    for (const site of sites) {
      const siteIndex = sites.indexOf(site);

      for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
        const year = monthOffset < 10 ? 2025 : 2026;
        const month = ((monthOffset + 2) % 12) + 1; // Start from March 2025
        const period = `${year}-${String(month).padStart(2, '0')}`;

        for (const metric of metrics) {
          // Deterministic value variation
          const siteVar = (siteIndex - 5) * metric.variance * 0.1;
          const monthVar = Math.sin(monthOffset * 0.5) * metric.variance * 0.3;
          const value = metric.base + siteVar + monthVar;

          stmt.run(
            `fin-${idx}`,
            site.id,
            metric.name,
            period,
            Math.round(value * 100) / 100,
          );
          idx++;
        }
      }
    }
  });

  insertMany();
}

// CLI entry point
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seed.ts') ||
  process.argv[1].endsWith('seed.js')
);

if (isDirectRun && !process.env.VITEST) {
  const dbPath = process.argv[2] || process.env.DB_PATH || './mercatus-farmer.db';
  console.log(`Seeding database at: ${dbPath}`);
  const db = createDatabase(dbPath);
  seedDatabase(db);

  // Report counts
  const counts = {
    sites: (db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c,
    companies: (db.prepare('SELECT COUNT(*) as c FROM companies').get() as { c: number }).c,
    fishGroups: (db.prepare('SELECT COUNT(*) as c FROM fish_groups').get() as { c: number }).c,
    weightSamples: (db.prepare('SELECT COUNT(*) as c FROM weight_samples').get() as { c: number }).c,
    mortality: (db.prepare('SELECT COUNT(*) as c FROM mortality').get() as { c: number }).c,
    timeSeries: (db.prepare('SELECT COUNT(*) as c FROM time_series').get() as { c: number }).c,
    financialValues: (db.prepare('SELECT COUNT(*) as c FROM financial_values').get() as { c: number }).c,
  };
  console.log('Seed complete:', counts);
  db.close();
}
