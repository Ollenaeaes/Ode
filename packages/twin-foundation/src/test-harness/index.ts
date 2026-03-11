// Test harness — barrel exports

// Types
export type { TestSuiteConfig, TwinClient, ApiResponse, RequestOptions } from './types.js';

// API client
export { createTwinClient } from './client.js';

// Custom Vitest matchers (side-effect import registers them)
// Users should import this file or use the barrel to get matchers registered
import './assertions.js';

// Validators (also usable standalone)
export {
  validateNorwegianOrgNumber,
  validateNorwegianPhone,
  validateNokAmount,
  validateIso8601Date,
  validateNorwegianPostalCode,
  type ValidationResult,
} from './validators.js';

// Advanceable clock
export { default as clock } from './clock.js';
export { now, advance, reset as resetClock, getOffset } from './clock.js';

// Test suite helpers
export { createTwinTestSuite, describeTwin } from './suite.js';
