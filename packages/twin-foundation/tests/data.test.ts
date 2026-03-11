import { describe, it, expect, beforeEach } from 'vitest';
import {
  ode,
  validateOrgNumber,
  generateOrgNumber,
  generatePhoneNumber,
  generateAddress,
  generateNokAmount,
  formatNok,
  generateDate,
  generatePerson,
  ODE_LOCATIONS,
  ODE_LOCATION_NAMES,
  ODE_SEA_SITES,
  ODE_HATCHERIES,
  generateProduct,
  generateProductCatalog,
  generateCustomer,
  generateCustomerSet,
  AQUACULTURE_TERMS,
  AQUACULTURE_TERM_KEYS,
  generateCohort,
  generateCohortSet,
  generateTemperatureSeries,
  generateGrowthSeries,
  generateFeedSeries,
  generateMortalitySeries,
} from '../src/data/index.js';

describe('Data Generation Library', () => {
  // Reset seed before each test for isolation
  beforeEach(() => {
    ode.seed(12345);
  });

  // ────────────────────────────────────────────────────────
  // MOD-11 Organization Numbers
  // ────────────────────────────────────────────────────────

  describe('Norwegian org numbers (MOD-11)', () => {
    it('generated org numbers pass MOD-11 check digit validation', () => {
      for (let i = 0; i < 100; i++) {
        const org = generateOrgNumber();
        expect(org).toMatch(/^\d{9}$/);
        expect(
          validateOrgNumber(org),
          `Org number ${org} failed MOD-11 validation`,
        ).toBe(true);
      }
    });

    it('rejects org numbers with invalid check digits', () => {
      // Take a valid org number and corrupt the last digit
      const valid = generateOrgNumber();
      const lastDigit = parseInt(valid[8], 10);
      const corrupted = valid.slice(0, 8) + ((lastDigit + 1) % 10);
      expect(validateOrgNumber(corrupted)).toBe(false);
    });

    it('rejects non-9-digit strings', () => {
      expect(validateOrgNumber('12345678')).toBe(false);    // 8 digits
      expect(validateOrgNumber('1234567890')).toBe(false);  // 10 digits
      expect(validateOrgNumber('abcdefghi')).toBe(false);   // letters
      expect(validateOrgNumber('')).toBe(false);             // empty
    });

    it('validates known valid org number (Equinor: 923609016)', () => {
      expect(validateOrgNumber('923609016')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────
  // Dates
  // ────────────────────────────────────────────────────────

  describe('dates', () => {
    it('all dates are valid ISO 8601 strings parseable by new Date()', () => {
      for (let i = 0; i < 50; i++) {
        const date = generateDate();
        const parsed = new Date(date);
        expect(parsed.toString()).not.toBe('Invalid Date');
        // Verify it round-trips to ISO format
        expect(typeof date).toBe('string');
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('respects date range options', () => {
      const from = new Date('2025-01-01');
      const to = new Date('2025-06-30');
      for (let i = 0; i < 20; i++) {
        const date = generateDate({ from, to });
        const parsed = new Date(date);
        expect(parsed.getTime()).toBeGreaterThanOrEqual(from.getTime());
        expect(parsed.getTime()).toBeLessThanOrEqual(to.getTime() + 24 * 60 * 60 * 1000);
      }
    });
  });

  // ────────────────────────────────────────────────────────
  // Seeded determinism
  // ────────────────────────────────────────────────────────

  describe('seeded determinism', () => {
    it('same seed produces byte-identical output across runs', () => {
      // Run 1
      ode.seed(42);
      const run1Person = ode.person();
      const run1Org = generateOrgNumber();
      const run1Product = generateProduct();
      const run1Location = ode.location();

      // Run 2 — same seed
      ode.seed(42);
      const run2Person = ode.person();
      const run2Org = generateOrgNumber();
      const run2Product = generateProduct();
      const run2Location = ode.location();

      expect(JSON.stringify(run1Person)).toBe(JSON.stringify(run2Person));
      expect(run1Org).toBe(run2Org);
      expect(JSON.stringify(run1Product)).toBe(JSON.stringify(run2Product));
      expect(JSON.stringify(run1Location)).toBe(JSON.stringify(run2Location));
    });

    it('different seeds produce different output', () => {
      ode.seed(42);
      const result1 = JSON.stringify(ode.person());

      ode.seed(999);
      const result2 = JSON.stringify(ode.person());

      expect(result1).not.toBe(result2);
    });
  });

  // ────────────────────────────────────────────────────────
  // Ode Locations
  // ────────────────────────────────────────────────────────

  describe('Ode locations', () => {
    it('all locations are drawn from the canonical set', () => {
      for (let i = 0; i < 50; i++) {
        const location = ode.location();
        expect(ODE_LOCATION_NAMES).toContain(location.name);
      }
    });

    it('canonical set contains the required site types', () => {
      const types = ODE_LOCATIONS.map((l) => l.type);
      expect(types).toContain('headquarters');
      expect(types).toContain('processing');
      expect(types).toContain('hatchery');
      expect(types).toContain('sea_site');
    });

    it('has exactly 10 sea sites', () => {
      expect(ODE_SEA_SITES).toHaveLength(10);
    });

    it('has 2 hatcheries', () => {
      expect(ODE_HATCHERIES).toHaveLength(2);
    });

    it('includes specific required locations', () => {
      const names = ODE_LOCATION_NAMES;
      // Headquarters in Ålesund
      expect(ODE_LOCATIONS.find((l) => l.type === 'headquarters')?.city).toBe('Ålesund');
      // Processing in Vartdal
      expect(ODE_LOCATIONS.find((l) => l.type === 'processing')?.city).toBe('Vartdal');
      // Hatcheries: Rødberg, Tjeldbergodden
      const hatcheryCities = ODE_HATCHERIES.map((h) => h.city);
      expect(hatcheryCities).toContain('Rødberg');
      expect(hatcheryCities).toContain('Tjeldbergodden');
    });

    it('can filter by type', () => {
      const seaSite = ode.location('sea_site');
      expect(seaSite.type).toBe('sea_site');

      const hq = ode.location('headquarters');
      expect(hq.type).toBe('headquarters');
    });
  });

  // ────────────────────────────────────────────────────────
  // Phone Numbers
  // ────────────────────────────────────────────────────────

  describe('phone numbers', () => {
    it('generated phone numbers match +47 XXXX XXXX pattern', () => {
      for (let i = 0; i < 50; i++) {
        const phone = generatePhoneNumber();
        expect(phone).toMatch(/^\+47 \d{4} \d{4}$/);
      }
    });
  });

  // ────────────────────────────────────────────────────────
  // NOK Amounts
  // ────────────────────────────────────────────────────────

  describe('NOK amounts', () => {
    it('generated NOK amounts are positive numbers with at most 2 decimal places', () => {
      for (let i = 0; i < 100; i++) {
        const amount = generateNokAmount();
        expect(amount).toBeGreaterThan(0);
        // Check decimal places: multiply by 100 and verify it's an integer
        const scaled = Math.round(amount * 100);
        expect(amount).toBeCloseTo(scaled / 100, 10);
      }
    });

    it('formats NOK correctly with Norwegian conventions', () => {
      expect(formatNok(1234567.89)).toBe('1 234 567,89 kr');
      expect(formatNok(0.5)).toBe('0,50 kr');
      expect(formatNok(1000)).toBe('1 000,00 kr');
    });

    it('respects context ranges', () => {
      for (let i = 0; i < 50; i++) {
        const fishPrice = generateNokAmount('fish_price');
        expect(fishPrice).toBeGreaterThanOrEqual(40);
        expect(fishPrice).toBeLessThanOrEqual(120);
      }
    });
  });

  // ────────────────────────────────────────────────────────
  // Person generator
  // ────────────────────────────────────────────────────────

  describe('person generator', () => {
    it('produces all required fields', () => {
      const person = generatePerson();
      expect(person.firstName).toBeTruthy();
      expect(person.lastName).toBeTruthy();
      expect(person.email).toContain('@');
      expect(person.phone).toMatch(/^\+47 \d{4} \d{4}$/);
      expect(person.address.formatted).toBeTruthy();
      expect(person.address.postalCode).toMatch(/^\d{4}$/);
    });
  });

  // ────────────────────────────────────────────────────────
  // Address generator
  // ────────────────────────────────────────────────────────

  describe('address generator', () => {
    it('produces Norwegian-formatted addresses', () => {
      const addr = generateAddress();
      expect(addr.street).toBeTruthy();
      expect(addr.postalCode).toMatch(/^\d{4}$/);
      expect(addr.city).toBeTruthy();
      // Format: "Street NN, PPPP City"
      expect(addr.formatted).toContain(addr.postalCode);
      expect(addr.formatted).toContain(addr.city);
    });
  });

  // ────────────────────────────────────────────────────────
  // Product Catalog
  // ────────────────────────────────────────────────────────

  describe('product catalog', () => {
    it('product catalog entries have all required fields', () => {
      const products = generateProductCatalog(10);

      for (const product of products) {
        expect(product.name).toBeTruthy();
        expect(product.weightGrams).toBeGreaterThan(0);
        expect(['fresh', 'frozen', 'pre-rigor']).toContain(product.packaging);
        expect(product.ean).toMatch(/^\d{13}$/);
        expect(product.pricePerKgNok).toBeGreaterThan(0);
        expect(product.sku).toBeTruthy();
        expect(product.description).toBeTruthy();
      }
    });

    it('generates requested number of products', () => {
      const products = generateProductCatalog(5);
      expect(products).toHaveLength(5);
    });

    it('EAN codes have valid check digits', () => {
      for (let i = 0; i < 20; i++) {
        const product = generateProduct();
        const digits = product.ean.split('').map(Number);
        // EAN-13 check: sum of odd-pos*1 + even-pos*3, mod 10 = 0
        let sum = 0;
        for (let j = 0; j < 13; j++) {
          sum += digits[j] * (j % 2 === 0 ? 1 : 3);
        }
        expect(sum % 10).toBe(0);
      }
    });
  });

  // ────────────────────────────────────────────────────────
  // Customers
  // ────────────────────────────────────────────────────────

  describe('customers', () => {
    it('customer org numbers are valid (MOD-11)', () => {
      for (let i = 0; i < 20; i++) {
        const customer = generateCustomer();
        expect(
          validateOrgNumber(customer.orgNumber),
          `Customer org number ${customer.orgNumber} failed MOD-11`,
        ).toBe(true);
      }
    });

    it('generates all customer types', () => {
      const set = generateCustomerSet({ retail: 2, horeca: 2, distributor: 2, export: 2 });
      const types = new Set(set.map((c) => c.type));
      expect(types).toContain('retail');
      expect(types).toContain('horeca');
      expect(types).toContain('distributor');
      expect(types).toContain('export');
    });

    it('customers have all required fields', () => {
      const customer = generateCustomer();
      expect(customer.name).toBeTruthy();
      expect(customer.type).toBeTruthy();
      expect(customer.orgNumber).toMatch(/^\d{9}$/);
      expect(customer.contact.firstName).toBeTruthy();
      expect(customer.contact.lastName).toBeTruthy();
      expect(customer.contact.email).toContain('@');
      expect(customer.contact.phone).toMatch(/^\+47 \d{4} \d{4}$/);
      expect(customer.address.formatted).toBeTruthy();
    });
  });

  // ────────────────────────────────────────────────────────
  // Aquaculture Terms
  // ────────────────────────────────────────────────────────

  describe('aquaculture terminology', () => {
    it('contains all required Norwegian terms', () => {
      const required = [
        'settefisk', 'yngel', 'merd', 'biomasse', 'lokalitet',
        'slaktevekt', 'fôrfaktor', 'dødelighet', 'lusegrense',
        'MTB', 'rognkjeks', 'torskeyngel',
      ];
      for (const term of required) {
        expect(AQUACULTURE_TERMS).toHaveProperty(term);
      }
    });

    it('term keys match the terms object', () => {
      expect(AQUACULTURE_TERM_KEYS.sort()).toEqual(
        Object.keys(AQUACULTURE_TERMS).sort(),
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // Cohorts
  // ────────────────────────────────────────────────────────

  describe('cohorts', () => {
    it('generates cohorts with all required fields', () => {
      const cohort = generateCohort();
      expect(cohort.id).toMatch(/^COH-\d{4}-[A-Z0-9]{4}$/);
      expect(cohort.hatchery.type).toBe('hatchery');
      expect(cohort.seaSite.type).toBe('sea_site');
      expect(new Date(cohort.stockingDate).toString()).not.toBe('Invalid Date');
      expect(cohort.initialCount).toBeGreaterThan(0);
      expect(cohort.initialWeightGrams).toBeGreaterThan(0);
      expect(cohort.species).toBe('Gadus morhua');
      expect(cohort.yearClass).toBeGreaterThanOrEqual(2023);
    });

    it('cohort set distributes across sea sites', () => {
      const cohorts = generateCohortSet({ yearClass: 2025, count: 10 });
      expect(cohorts).toHaveLength(10);
      const sites = new Set(cohorts.map((c) => c.seaSite.name));
      // Should use multiple sites (not all the same)
      expect(sites.size).toBeGreaterThan(1);
    });

    it('all cohort locations are from canonical set', () => {
      const cohorts = generateCohortSet({ count: 20 });
      for (const cohort of cohorts) {
        expect(ODE_LOCATION_NAMES).toContain(cohort.hatchery.name);
        expect(ODE_LOCATION_NAMES).toContain(cohort.seaSite.name);
      }
    });
  });

  // ────────────────────────────────────────────────────────
  // Time Series
  // ────────────────────────────────────────────────────────

  describe('time series', () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-12-31');

    it('time-series data spans the requested period with no gaps (daily)', () => {
      const series = generateTemperatureSeries({ from, to, interval: 'daily' });

      // Should have ~365 data points
      expect(series.length).toBeGreaterThanOrEqual(365);

      // Verify no gaps: each point is exactly 1 day after the previous
      for (let i = 1; i < series.length; i++) {
        const prev = new Date(series[i - 1].timestamp).getTime();
        const curr = new Date(series[i].timestamp).getTime();
        const diffMs = curr - prev;
        expect(diffMs).toBe(24 * 60 * 60 * 1000); // exactly 1 day
      }

      // First point matches start date
      expect(new Date(series[0].timestamp).toISOString()).toBe(from.toISOString());
    });

    it('time-series data spans the requested period with no gaps (weekly)', () => {
      const series = generateTemperatureSeries({ from, to, interval: 'weekly' });

      expect(series.length).toBeGreaterThanOrEqual(52);

      for (let i = 1; i < series.length; i++) {
        const prev = new Date(series[i - 1].timestamp).getTime();
        const curr = new Date(series[i].timestamp).getTime();
        const diffMs = curr - prev;
        expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000); // exactly 1 week
      }
    });

    it('all timestamps are valid ISO 8601', () => {
      const series = generateTemperatureSeries({ from, to, interval: 'daily' });
      for (const point of series) {
        expect(new Date(point.timestamp).toString()).not.toBe('Invalid Date');
        expect(point.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('temperature shows seasonal variation', () => {
      const series = generateTemperatureSeries({ from, to, interval: 'daily' });

      // January values (indices ~0–30) should be colder than July values (~180–210)
      const janTemps = series.slice(0, 31).map((p) => p.value);
      const julTemps = series.slice(181, 212).map((p) => p.value);

      const avgJan = janTemps.reduce((a, b) => a + b, 0) / janTemps.length;
      const avgJul = julTemps.reduce((a, b) => a + b, 0) / julTemps.length;

      expect(avgJul).toBeGreaterThan(avgJan);
    });

    it('growth series shows increasing weight over time', () => {
      const series = generateGrowthSeries({
        from,
        to,
        interval: 'daily',
        initialWeightGrams: 100,
      });

      // Weight should generally increase
      const firstWeight = series[0].value;
      const lastWeight = series[series.length - 1].value;
      expect(lastWeight).toBeGreaterThan(firstWeight);
    });

    it('feed series values are positive', () => {
      const series = generateFeedSeries({
        from,
        to,
        interval: 'daily',
        fishCount: 100_000,
        avgWeightGrams: 500,
      });

      for (const point of series) {
        expect(point.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('mortality series is monotonically non-decreasing (cumulative)', () => {
      const series = generateMortalitySeries({
        from,
        to,
        interval: 'daily',
        initialCount: 100_000,
      });

      for (let i = 1; i < series.length; i++) {
        expect(series[i].value).toBeGreaterThanOrEqual(series[i - 1].value);
      }
    });

    it('feed consumption correlates with temperature (higher in summer)', () => {
      const feedSeries = generateFeedSeries({
        from,
        to,
        interval: 'weekly',
        fishCount: 100_000,
        avgWeightGrams: 500,
      });

      // Compare winter (weeks 1-10) vs summer (weeks 25-35)
      const winterFeed = feedSeries.slice(0, 10).map((p) => p.value);
      const summerFeed = feedSeries.slice(24, 35).map((p) => p.value);

      const avgWinter = winterFeed.reduce((a, b) => a + b, 0) / winterFeed.length;
      const avgSummer = summerFeed.reduce((a, b) => a + b, 0) / summerFeed.length;

      // Summer feed should be higher (also because fish are bigger by then)
      expect(avgSummer).toBeGreaterThan(avgWinter);
    });
  });

  // ────────────────────────────────────────────────────────
  // Namespace (ode.*)
  // ────────────────────────────────────────────────────────

  describe('ode namespace', () => {
    it('ode.person() generates a complete person', () => {
      const person = ode.person();
      expect(person.firstName).toBeTruthy();
      expect(person.lastName).toBeTruthy();
      expect(person.email).toContain('@');
      expect(person.phone).toMatch(/^\+47/);
    });

    it('ode.company() generates a company with valid org number', () => {
      const company = ode.company();
      expect(company.name).toBeTruthy();
      expect(validateOrgNumber(company.orgNumber)).toBe(true);
      expect(company.address.formatted).toBeTruthy();
    });

    it('ode.location() returns a canonical location', () => {
      const loc = ode.location();
      expect(ODE_LOCATION_NAMES).toContain(loc.name);
    });

    it('ode.product() generates a valid product', () => {
      const p = ode.product();
      expect(p.name).toBeTruthy();
      expect(p.ean).toMatch(/^\d{13}$/);
    });

    it('ode.customer() generates a valid customer', () => {
      const c = ode.customer();
      expect(c.name).toBeTruthy();
      expect(validateOrgNumber(c.orgNumber)).toBe(true);
    });

    it('ode.cohort() generates a valid cohort', () => {
      const c = ode.cohort();
      expect(c.id).toMatch(/^COH-/);
      expect(c.species).toBe('Gadus morhua');
    });

    it('ode.timeSeries() delegates to correct generator', () => {
      const series = ode.timeSeries('temperature', {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
        interval: 'daily',
      });
      expect(series.length).toBeGreaterThanOrEqual(30);
      expect(series[0].timestamp).toBeTruthy();
      expect(typeof series[0].value).toBe('number');
    });
  });
});
