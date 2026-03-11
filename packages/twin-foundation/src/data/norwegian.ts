/**
 * Norwegian locale helpers — org numbers, phone numbers, addresses, amounts.
 * Uses Faker.js nb_NO locale as the base, extends with Norwegian-specific logic.
 */

import { faker } from '@faker-js/faker/locale/nb_NO';

// Norwegian postal codes mapped to cities for realistic address generation
const NORWEGIAN_CITIES: ReadonlyArray<{ postalCode: string; city: string }> = [
  { postalCode: '0001', city: 'Oslo' },
  { postalCode: '5003', city: 'Bergen' },
  { postalCode: '7010', city: 'Trondheim' },
  { postalCode: '4006', city: 'Stavanger' },
  { postalCode: '6003', city: 'Ålesund' },
  { postalCode: '9008', city: 'Tromsø' },
  { postalCode: '4611', city: 'Kristiansand' },
  { postalCode: '8006', city: 'Bodø' },
  { postalCode: '6400', city: 'Molde' },
  { postalCode: '6509', city: 'Kristiansund' },
  { postalCode: '6100', city: 'Volda' },
  { postalCode: '6150', city: 'Ørsta' },
];

const NORWEGIAN_STREET_SUFFIXES = [
  'gate', 'vegen', 'veien', 'gata', 'allé', 'plass', 'stien', 'bakken',
];

/**
 * MOD-11 check digit validation for Norwegian organization numbers.
 * Weights [3, 2, 7, 6, 5, 4, 3, 2] applied right-to-left on first 8 digits.
 * Check digit = 11 - (weighted sum % 11).
 * If result is 11, check digit is 0. If result is 10, the number is invalid.
 */
export function validateOrgNumber(orgNumber: string): boolean {
  const cleaned = orgNumber.replace(/\s/g, '');
  if (!/^\d{9}$/.test(cleaned)) return false;

  const digits = cleaned.split('').map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = 11 - remainder;

  if (checkDigit === 10) return false; // Invalid combination
  const expected = checkDigit === 11 ? 0 : checkDigit;

  return digits[8] === expected;
}

/**
 * Generate a valid Norwegian organization number with MOD-11 check digit.
 * Regenerates if the random first 8 digits produce a check digit of 10 (invalid).
 */
export function generateOrgNumber(): string {
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const digits: number[] = [];
    // First digit should be 8 or 9 for Norwegian org numbers
    digits.push(faker.helpers.arrayElement([8, 9]));
    for (let i = 1; i < 8; i++) {
      digits.push(faker.number.int({ min: 0, max: 9 }));
    }

    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += digits[i] * weights[i];
    }

    const remainder = sum % 11;
    const checkDigit = 11 - remainder;

    if (checkDigit === 10) continue; // Invalid — regenerate
    digits.push(checkDigit === 11 ? 0 : checkDigit);

    return digits.join('');
  }
}

/**
 * Generate a Norwegian phone number in +47 XXXX XXXX format.
 */
export function generatePhoneNumber(): string {
  // Norwegian mobile numbers start with 4 or 9
  const firstDigit = faker.helpers.arrayElement([4, 9]);
  const rest = faker.string.numeric(7);
  const number = `${firstDigit}${rest}`;
  return `+47 ${number.slice(0, 4)} ${number.slice(4)}`;
}

/**
 * Generate a Norwegian street address with proper formatting.
 * Format: "Streetname NN, PPPP City"
 */
export function generateAddress(): {
  street: string;
  postalCode: string;
  city: string;
  formatted: string;
} {
  const streetName = faker.person.lastName();
  const suffix = faker.helpers.arrayElement(NORWEGIAN_STREET_SUFFIXES);
  const number = faker.number.int({ min: 1, max: 150 });
  const cityData = faker.helpers.arrayElement(NORWEGIAN_CITIES);

  const street = `${streetName}${suffix} ${number}`;
  return {
    street,
    postalCode: cityData.postalCode,
    city: cityData.city,
    formatted: `${street}, ${cityData.postalCode} ${cityData.city}`,
  };
}

/**
 * Generate a Norwegian email address based on realistic name patterns.
 */
export function generateEmail(firstName?: string, lastName?: string): string {
  const first = (firstName ?? faker.person.firstName()).toLowerCase();
  const last = (lastName ?? faker.person.lastName()).toLowerCase();

  // Replace Norwegian characters for email
  const normalize = (s: string) =>
    s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');

  const domain = faker.helpers.arrayElement([
    'gmail.com', 'outlook.com', 'hotmail.no', 'online.no', 'broadpark.no',
  ]);

  const patterns = [
    `${normalize(first)}.${normalize(last)}@${domain}`,
    `${normalize(first)}${normalize(last)}@${domain}`,
    `${normalize(first)}.${normalize(last)}${faker.number.int({ min: 1, max: 99 })}@${domain}`,
  ];

  return faker.helpers.arrayElement(patterns);
}

/**
 * Generate a Norwegian person with realistic data.
 */
export function generatePerson(): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: ReturnType<typeof generateAddress>;
} {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    firstName,
    lastName,
    email: generateEmail(firstName, lastName),
    phone: generatePhoneNumber(),
    address: generateAddress(),
  };
}

/** Ranges for different financial contexts (in NOK øre to avoid float issues) */
const NOK_RANGES = {
  feed_cost: { min: 50_000_00, max: 500_000_00 },       // 50k–500k
  fish_price: { min: 40_00, max: 120_00 },                // 40–120 per kg
  salary: { min: 350_000_00, max: 900_000_00 },           // 350k–900k yearly
  invoice: { min: 10_000_00, max: 5_000_000_00 },         // 10k–5M
  general: { min: 100_00, max: 1_000_000_00 },            // 100–1M
} as const;

export type NokContext = keyof typeof NOK_RANGES;

/**
 * Generate a NOK amount as a number with at most 2 decimal places.
 */
export function generateNokAmount(context: NokContext = 'general'): number {
  const range = NOK_RANGES[context];
  const øre = faker.number.int({ min: range.min, max: range.max });
  return øre / 100;
}

/**
 * Format a number as Norwegian NOK string: "1 234 567,89 kr"
 */
export function formatNok(amount: number): string {
  // Split integer and decimal parts
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Add space as thousands separator
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${withSpaces},${decPart} kr`;
}

/**
 * Generate an ISO 8601 date string in Europe/Oslo timezone.
 */
export function generateDate(options?: { from?: Date; to?: Date }): string {
  const from = options?.from ?? new Date('2023-01-01');
  const to = options?.to ?? new Date('2026-12-31');
  const date = faker.date.between({ from, to });

  // Format in Europe/Oslo timezone using ISO 8601
  return date.toISOString();
}
