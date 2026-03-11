/**
 * Main Ode data generator namespace.
 *
 * Usage:
 *   import { ode } from '@ode/twin-foundation/data';
 *   ode.seed(42);
 *   const person = ode.person();
 *   const location = ode.location();
 */

import { faker } from '@faker-js/faker/locale/nb_NO';

// Re-export all sub-modules for direct access
export {
  generateOrgNumber,
  validateOrgNumber,
  generatePhoneNumber,
  generateAddress,
  generateEmail,
  generatePerson,
  generateNokAmount,
  formatNok,
  generateDate,
  type NokContext,
} from './norwegian.js';

export {
  ODE_LOCATIONS,
  ODE_LOCATION_NAMES,
  ODE_SEA_SITES,
  ODE_HATCHERIES,
  type OdeLocation,
} from './locations.js';

export {
  generateProduct,
  generateProductCatalog,
  type ProductData,
  type PackagingType,
} from './products.js';

export {
  generateCustomer,
  generateCustomerSet,
  type CustomerData,
  type CustomerType,
} from './customers.js';

export {
  AQUACULTURE_TERMS,
  AQUACULTURE_TERM_KEYS,
  generateCohort,
  generateCohortSet,
  type AquacultureTerm,
  type CohortData,
} from './aquaculture.js';

export {
  generateTemperatureSeries,
  generateGrowthSeries,
  generateFeedSeries,
  generateMortalitySeries,
  generateTimeSeries,
  type TimeSeriesPoint,
  type TimeSeriesOptions,
  type TimeInterval,
} from './time-series.js';

// Import generators for the namespace object
import {
  generatePerson,
  generateOrgNumber,
  generateNokAmount,
  formatNok,
  generateDate,
  generateAddress,
} from './norwegian.js';
import { ODE_LOCATIONS, ODE_SEA_SITES, ODE_HATCHERIES, type OdeLocation } from './locations.js';
import { generateProduct, generateProductCatalog } from './products.js';
import { generateCustomer, generateCustomerSet } from './customers.js';
import {
  AQUACULTURE_TERMS,
  AQUACULTURE_TERM_KEYS,
  generateCohort,
  generateCohortSet,
} from './aquaculture.js';
import {
  generateTemperatureSeries,
  generateGrowthSeries,
  generateFeedSeries,
  generateMortalitySeries,
  generateTimeSeries,
  type TimeSeriesOptions,
} from './time-series.js';

/**
 * The `ode` namespace — a convenient façade over all data generators.
 * Call `ode.seed(n)` before generating to get deterministic output.
 */
export const ode = {
  /**
   * Seed the random number generator for deterministic output.
   * Same seed = identical output across runs.
   */
  seed(value: number): void {
    faker.seed(value);
  },

  /** Generate a Norwegian person with name, email, phone, and address. */
  person: generatePerson,

  /** Generate a Norwegian company with org number and address. */
  company(): {
    name: string;
    orgNumber: string;
    address: ReturnType<typeof generateAddress>;
  } {
    return {
      name: faker.company.name(),
      orgNumber: generateOrgNumber(),
      address: generateAddress(),
    };
  },

  /** Pick a random Ode location from the canonical set. */
  location(type?: OdeLocation['type']): OdeLocation {
    const filtered = type
      ? ODE_LOCATIONS.filter((l) => l.type === type)
      : ODE_LOCATIONS;
    return faker.helpers.arrayElement([...filtered]);
  },

  /** Generate a Snow Cod product. */
  product: generateProduct,

  /** Generate a full product catalog. */
  productCatalog: generateProductCatalog,

  /** Generate a customer of a specific type or random. */
  customer: generateCustomer,

  /** Generate a set of customers across all types. */
  customerSet: generateCustomerSet,

  /** Generate a single aquaculture cohort. */
  cohort: generateCohort,

  /** Generate a set of staggered cohorts across sea sites. */
  cohortSet: generateCohortSet,

  /** Generate time-series data with seasonal patterns. */
  timeSeries: generateTimeSeries,

  /** Norwegian aquaculture terminology. */
  terms: AQUACULTURE_TERMS,

  /** All aquaculture term keys. */
  termKeys: AQUACULTURE_TERM_KEYS,

  /** Generate a NOK amount for a given context. */
  nokAmount: generateNokAmount,

  /** Format a number as Norwegian NOK string. */
  formatNok,

  /** Generate an ISO 8601 date. */
  date: generateDate,
};
