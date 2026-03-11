/**
 * Norwegian data validators.
 *
 * Used by both custom Vitest matchers and directly in test code.
 * Each validator returns { valid: boolean; reason?: string }.
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a Norwegian organisation number (9 digits, MOD-11 check).
 *
 * The check digit is the 9th digit. Weights for positions 1-8: [3, 2, 7, 6, 5, 4, 3, 2].
 * Sum of (digit * weight) mod 11 gives remainder. Check digit = 11 - remainder.
 * If remainder is 0, check digit is 0. If remainder is 1, the number is invalid.
 */
export function validateNorwegianOrgNumber(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, reason: `Expected string, got ${typeof value}` };
  }

  // Strip spaces for lenient matching
  const cleaned = value.replace(/\s/g, '');

  if (!/^\d{9}$/.test(cleaned)) {
    return { valid: false, reason: `Expected 9 digits, got "${value}"` };
  }

  const digits = cleaned.split('').map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;

  if (remainder === 1) {
    return { valid: false, reason: `MOD-11 check failed: remainder is 1 (invalid org number)` };
  }

  const expectedCheck = remainder === 0 ? 0 : 11 - remainder;

  if (digits[8] !== expectedCheck) {
    return { valid: false, reason: `MOD-11 check digit mismatch: expected ${expectedCheck}, got ${digits[8]}` };
  }

  return { valid: true };
}

/**
 * Validate a Norwegian phone number.
 *
 * Accepts formats:
 * - +47 XXXX XXXX
 * - +47XXXXXXXX
 * - +47 XX XX XX XX
 *
 * Must start with +47, followed by 8 digits.
 */
export function validateNorwegianPhone(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, reason: `Expected string, got ${typeof value}` };
  }

  // Strip spaces
  const cleaned = value.replace(/\s/g, '');

  if (!cleaned.startsWith('+47')) {
    return { valid: false, reason: `Must start with +47, got "${value}"` };
  }

  const digits = cleaned.slice(3);
  if (!/^\d{8}$/.test(digits)) {
    return { valid: false, reason: `Expected 8 digits after +47, got ${digits.length} in "${value}"` };
  }

  return { valid: true };
}

/**
 * Validate an NOK (Norwegian Krone) amount.
 *
 * Must be a positive number with at most 2 decimal places.
 */
export function validateNokAmount(value: unknown): ValidationResult {
  if (typeof value !== 'number') {
    return { valid: false, reason: `Expected number, got ${typeof value}` };
  }

  if (!Number.isFinite(value)) {
    return { valid: false, reason: `Expected finite number, got ${value}` };
  }

  if (value <= 0) {
    return { valid: false, reason: `Expected positive amount, got ${value}` };
  }

  // Check decimal places: multiply by 100 and see if it's an integer
  const scaled = Math.round(value * 100);
  if (Math.abs(scaled - value * 100) > 0.001) {
    return { valid: false, reason: `Expected at most 2 decimal places, got ${value}` };
  }

  return { valid: true };
}

/**
 * Validate an ISO 8601 date string.
 *
 * Accepts date-only (2024-01-15), datetime (2024-01-15T10:30:00),
 * and datetime with timezone (2024-01-15T10:30:00Z, 2024-01-15T10:30:00+01:00).
 */
export function validateIso8601Date(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, reason: `Expected string, got ${typeof value}` };
  }

  // Basic ISO 8601 pattern
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

  if (!iso8601Pattern.test(value)) {
    return { valid: false, reason: `Not a valid ISO 8601 date: "${value}"` };
  }

  // Verify it parses to a valid date
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return { valid: false, reason: `Parses to invalid date: "${value}"` };
  }

  return { valid: true };
}

/**
 * Validate a Norwegian postal code (4 digits, 0001-9999).
 */
export function validateNorwegianPostalCode(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, reason: `Expected string, got ${typeof value}` };
  }

  if (!/^\d{4}$/.test(value)) {
    return { valid: false, reason: `Expected 4 digits, got "${value}"` };
  }

  const num = parseInt(value, 10);
  if (num < 1 || num > 9999) {
    return { valid: false, reason: `Out of range (0001-9999): "${value}"` };
  }

  return { valid: true };
}
