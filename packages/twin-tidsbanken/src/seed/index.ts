import type Database from 'better-sqlite3';
import { seedReferenceData } from './reference-data.js';
import { seedEmployees } from './employees.js';
import { seedPlans } from './plans.js';
import { seedStemplings } from './stemplings.js';
import { seedTimelinje } from './timelinje.js';

/**
 * Run all seed functions in the correct order.
 */
export function seedAll(db: Database.Database, options?: { seed?: number; referenceDate?: string }): void {
  const seed = options?.seed ?? (process.env.TWIN_SEED ? parseInt(process.env.TWIN_SEED, 10) : 42);
  const referenceDate = options?.referenceDate ?? process.env.TWIN_REFERENCE_DATE ?? '2025-10-01';

  console.log(`Seeding database (seed=${seed}, referenceDate=${referenceDate})...`);

  const start = Date.now();

  // 1. Reference data (departments, activities, work types, shifts, projects)
  seedReferenceData(db);
  console.log('  Reference data seeded');

  // 2. Employees
  seedEmployees(db, seed);
  console.log('  Employees seeded');

  // 3. Plans (schedules)
  seedPlans(db, referenceDate, seed);
  console.log('  Plans seeded');

  // 4. Stemplings (clock-in/out from plans)
  seedStemplings(db, seed);
  console.log('  Stemplings seeded');

  // 5. Timelinje (time entries from stemplings)
  seedTimelinje(db, seed);
  console.log('  Timelinje seeded');

  const elapsed = Date.now() - start;
  console.log(`Seeding complete in ${elapsed}ms`);
}

export { seedReferenceData } from './reference-data.js';
export { seedEmployees } from './employees.js';
export { seedPlans } from './plans.js';
export { seedStemplings } from './stemplings.js';
export { seedTimelinje } from './timelinje.js';
