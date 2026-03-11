import { expect } from 'vitest';
import type { ApiResponse } from './types.js';
import {
  validateNorwegianOrgNumber,
  validateNorwegianPhone,
  validateNokAmount,
  validateIso8601Date,
  validateNorwegianPostalCode,
} from './validators.js';

// ---------------------------------------------------------------------------
// Custom matchers
// ---------------------------------------------------------------------------

/**
 * Check if `actual` matches a partial shape (like Jest's objectContaining).
 * Every key in `expected` must be present in `actual` with a matching value.
 * Extra keys in `actual` are ignored.
 */
function matchesPartialShape(actual: unknown, expected: Record<string, unknown>): { pass: boolean; message: string } {
  if (typeof actual !== 'object' || actual === null) {
    return {
      pass: false,
      message: `Expected an object, but received ${actual === null ? 'null' : typeof actual}`,
    };
  }

  const obj = actual as Record<string, unknown>;
  const failures: string[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in obj)) {
      failures.push(`missing key "${key}"`);
      continue;
    }

    const actualValue = obj[key];

    if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
      // Recurse for nested objects
      const nested = matchesPartialShape(actualValue, expectedValue as Record<string, unknown>);
      if (!nested.pass) {
        failures.push(`at "${key}": ${nested.message}`);
      }
    } else {
      // Use deep equality for primitives and arrays
      try {
        expect(actualValue).toEqual(expectedValue);
      } catch {
        failures.push(`at "${key}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    }
  }

  if (failures.length > 0) {
    return { pass: false, message: `Shape mismatch:\n  ${failures.join('\n  ')}` };
  }

  return { pass: true, message: 'Object matches the expected shape' };
}

// ---------------------------------------------------------------------------
// Register custom matchers with Vitest
// ---------------------------------------------------------------------------

expect.extend({
  /** Assert HTTP status code with a descriptive failure message */
  toHaveStatus(received: ApiResponse, expected: number) {
    const pass = received.status === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected response not to have status ${expected}`
          : `Expected status ${expected}, got ${received.status}.\nResponse body: ${JSON.stringify(received.body, null, 2)}`,
    };
  },

  /** Assert response body matches a partial shape */
  toMatchShape(received: unknown, expected: Record<string, unknown>) {
    const result = matchesPartialShape(received, expected);
    return {
      pass: result.pass,
      message: () => result.message,
    };
  },

  /** Assert array has length within constraints */
  toHaveArrayLength(received: unknown, min: number, max?: number) {
    if (!Array.isArray(received)) {
      return {
        pass: false,
        message: () => `Expected an array, got ${typeof received}`,
      };
    }

    const len = received.length;
    const effectiveMax = max ?? min;
    const pass = len >= min && len <= effectiveMax;

    return {
      pass,
      message: () =>
        pass
          ? `Expected array not to have length between ${min} and ${effectiveMax}, but it has ${len}`
          : `Expected array length between ${min} and ${effectiveMax}, got ${len}`,
    };
  },

  /** Assert value is a specific type */
  toBeFieldType(received: unknown, expectedType: string) {
    const actualType = Array.isArray(received) ? 'array' : typeof received;
    const pass = actualType === expectedType;
    return {
      pass,
      message: () =>
        pass
          ? `Expected value not to be of type "${expectedType}"`
          : `Expected type "${expectedType}", got "${actualType}" (value: ${JSON.stringify(received)})`,
    };
  },

  // -- Norwegian validators as matchers --

  toBeNorwegianOrgNumber(received: unknown) {
    const result = validateNorwegianOrgNumber(received);
    return {
      pass: result.valid,
      message: () => result.reason ?? `Expected ${received} not to be a valid Norwegian org number`,
    };
  },

  toBeNorwegianPhone(received: unknown) {
    const result = validateNorwegianPhone(received);
    return {
      pass: result.valid,
      message: () => result.reason ?? `Expected ${received} not to be a valid Norwegian phone number`,
    };
  },

  toBeNokAmount(received: unknown) {
    const result = validateNokAmount(received);
    return {
      pass: result.valid,
      message: () => result.reason ?? `Expected ${received} not to be a valid NOK amount`,
    };
  },

  toBeIso8601Date(received: unknown) {
    const result = validateIso8601Date(received);
    return {
      pass: result.valid,
      message: () => result.reason ?? `Expected ${received} not to be a valid ISO 8601 date`,
    };
  },

  toBeNorwegianPostalCode(received: unknown) {
    const result = validateNorwegianPostalCode(received);
    return {
      pass: result.valid,
      message: () => result.reason ?? `Expected ${received} not to be a valid Norwegian postal code`,
    };
  },
});

// ---------------------------------------------------------------------------
// Type declarations for the custom matchers
// ---------------------------------------------------------------------------

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface CustomMatchers<R = unknown> {
    /** Assert an ApiResponse has the expected HTTP status code */
    toHaveStatus(expected: number): R;
    /** Assert an object matches a partial shape (like objectContaining) */
    toMatchShape(expected: Record<string, unknown>): R;
    /** Assert an array has length between min and max (if max omitted, exact length) */
    toHaveArrayLength(min: number, max?: number): R;
    /** Assert a value is of the expected type ("string", "number", "boolean", "object", "array") */
    toBeFieldType(expectedType: string): R;
    /** Assert a string is a valid Norwegian org number (9 digits, MOD-11 check) */
    toBeNorwegianOrgNumber(): R;
    /** Assert a string is a valid Norwegian phone number (+47 + 8 digits) */
    toBeNorwegianPhone(): R;
    /** Assert a number is a valid NOK amount (positive, max 2 decimal places) */
    toBeNokAmount(): R;
    /** Assert a string is a valid ISO 8601 date */
    toBeIso8601Date(): R;
    /** Assert a string is a valid Norwegian postal code (4 digits, 0001-9999) */
    toBeNorwegianPostalCode(): R;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchersContaining {
    toHaveStatus(expected: number): unknown;
    toMatchShape(expected: Record<string, unknown>): unknown;
    toHaveArrayLength(min: number, max?: number): unknown;
    toBeFieldType(expectedType: string): unknown;
    toBeNorwegianOrgNumber(): unknown;
    toBeNorwegianPhone(): unknown;
    toBeNokAmount(): unknown;
    toBeIso8601Date(): unknown;
    toBeNorwegianPostalCode(): unknown;
  }
}
