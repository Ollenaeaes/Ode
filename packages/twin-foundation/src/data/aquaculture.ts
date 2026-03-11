/**
 * Cod farming terminology and cohort generators.
 * Norwegian aquaculture domain knowledge specific to Ode's cod farming operations.
 */

import { faker } from '@faker-js/faker/locale/nb_NO';
import { ODE_SEA_SITES, ODE_HATCHERIES, type OdeLocation } from './locations.js';

/** Norwegian aquaculture terminology with English descriptions */
export const AQUACULTURE_TERMS = {
  settefisk: 'smolt/juvenile fish',
  yngel: 'fry',
  merd: 'net pen/cage',
  biomasse: 'biomass',
  lokalitet: 'site/locality',
  slaktevekt: 'harvest weight',
  fôrfaktor: 'FCR (feed conversion ratio)',
  dødelighet: 'mortality',
  lusegrense: 'lice threshold',
  MTB: 'maksimalt tillatt biomasse (maximum allowed biomass)',
  rognkjeks: 'lumpfish (cleaner fish)',
  torskeyngel: 'cod fry',
} as const;

export type AquacultureTerm = keyof typeof AQUACULTURE_TERMS;

/** All Norwegian aquaculture term keys */
export const AQUACULTURE_TERM_KEYS = Object.keys(AQUACULTURE_TERMS) as AquacultureTerm[];

export interface CohortData {
  /** Unique cohort identifier */
  id: string;
  /** Which hatchery the cohort originated from */
  hatchery: OdeLocation;
  /** Which sea site the cohort is deployed to */
  seaSite: OdeLocation;
  /** Date the cohort was stocked at the sea site */
  stockingDate: string;
  /** Number of fish in the cohort at stocking */
  initialCount: number;
  /** Average weight at stocking in grams */
  initialWeightGrams: number;
  /** Species — always Atlantic cod for Ode */
  species: string;
  /** Generation/year class */
  yearClass: number;
}

/**
 * Generate a single cohort record.
 * Cohorts originate from one of Ode's hatcheries and are deployed to a sea site.
 */
export function generateCohort(options?: {
  yearClass?: number;
  seaSite?: OdeLocation;
  stockingMonth?: number;
}): CohortData {
  const yearClass = options?.yearClass ?? faker.number.int({ min: 2023, max: 2026 });
  const hatchery = faker.helpers.arrayElement(ODE_HATCHERIES);
  const seaSite = options?.seaSite ?? faker.helpers.arrayElement(ODE_SEA_SITES);

  // Stocking typically happens between March and September
  const month = options?.stockingMonth ?? faker.number.int({ min: 3, max: 9 });
  const day = faker.number.int({ min: 1, max: 28 });
  const stockingDate = new Date(yearClass, month - 1, day).toISOString();

  return {
    id: `COH-${yearClass}-${faker.string.alphanumeric(4).toUpperCase()}`,
    hatchery,
    seaSite,
    stockingDate,
    initialCount: faker.number.int({ min: 50_000, max: 200_000 }),
    initialWeightGrams: faker.number.int({ min: 50, max: 200 }),
    species: 'Gadus morhua', // Atlantic cod
    yearClass,
  };
}

/**
 * Generate a set of cohorts staggered across sites through the year.
 * Mimics real Ode operations where cohorts are deployed progressively.
 */
export function generateCohortSet(options?: {
  yearClass?: number;
  count?: number;
}): CohortData[] {
  const yearClass = options?.yearClass ?? 2025;
  const count = options?.count ?? ODE_SEA_SITES.length;

  // Distribute stocking months across the season (March–September)
  const sites = faker.helpers.shuffle([...ODE_SEA_SITES]);
  const cohorts: CohortData[] = [];

  for (let i = 0; i < count; i++) {
    const site = sites[i % sites.length];
    // Stagger months: March through September, spread evenly
    const month = 3 + Math.floor((i / count) * 7);

    cohorts.push(generateCohort({
      yearClass,
      seaSite: site,
      stockingMonth: Math.min(month, 9),
    }));
  }

  return cohorts;
}
