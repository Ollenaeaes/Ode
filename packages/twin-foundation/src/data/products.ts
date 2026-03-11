/**
 * Snow Cod product catalog generator.
 * Produces realistic product entries for Ode's Snow Cod brand.
 */

import { faker } from '@faker-js/faker/locale/nb_NO';
import { generateNokAmount } from './norwegian.js';

export type PackagingType = 'fresh' | 'frozen' | 'pre-rigor';

export interface ProductData {
  /** Product name */
  name: string;
  /** SKU code */
  sku: string;
  /** Weight class in grams */
  weightGrams: number;
  /** Packaging type */
  packaging: PackagingType;
  /** EAN-13 barcode */
  ean: string;
  /** Price per kg in NOK */
  pricePerKgNok: number;
  /** Product description in Norwegian */
  description: string;
}

/** Product name templates — realistic Snow Cod products */
const PRODUCT_NAMES: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'Snow Cod Loins', description: 'Premium torskeloin, benfri og skinnfri' },
  { name: 'Snow Cod Fileter', description: 'Ferske torskefileter av høy kvalitet' },
  { name: 'Snow Cod Hel Fisk', description: 'Hel sløyd torsk, klar for tilberedning' },
  { name: 'Snow Cod Porsjoner', description: 'Porsjonsklare torskestykker' },
  { name: 'Snow Cod Backs', description: 'Torskerygg, perfekt for ovnsbaking' },
  { name: 'Snow Cod Tails', description: 'Torskehale, mager og smakfull' },
  { name: 'Snow Cod Flakes', description: 'Torskeflak til salater og gratenger' },
  { name: 'Snow Cod Skrei Filet', description: 'Skreifilet fra vintersesongen' },
  { name: 'Snow Cod Røkt Filet', description: 'Kaldrøkt torskefilet' },
  { name: 'Snow Cod Burger', description: 'Torskeburgere, klare til steking' },
];

/** Weight classes in grams */
const WEIGHT_CLASSES = [200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];

const PACKAGING_TYPES: PackagingType[] = ['fresh', 'frozen', 'pre-rigor'];

/**
 * Generate a valid EAN-13 barcode.
 * Norwegian products use 70 prefix.
 */
function generateEan(): string {
  // Norwegian prefix: 70
  const prefix = '70';
  const body = faker.string.numeric(10);
  const digits = (prefix + body).split('').map(Number);

  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return prefix + body + checkDigit;
}

/**
 * Generate a single Snow Cod product.
 */
export function generateProduct(): ProductData {
  const template = faker.helpers.arrayElement(PRODUCT_NAMES);
  const packaging = faker.helpers.arrayElement(PACKAGING_TYPES);
  const weightGrams = faker.helpers.arrayElement(WEIGHT_CLASSES);

  return {
    name: template.name,
    sku: `SC-${faker.string.alphanumeric(6).toUpperCase()}`,
    weightGrams,
    packaging,
    ean: generateEan(),
    pricePerKgNok: generateNokAmount('fish_price'),
    description: template.description,
  };
}

/**
 * Generate a product catalog with multiple products.
 */
export function generateProductCatalog(count?: number): ProductData[] {
  const n = count ?? PRODUCT_NAMES.length;
  const products: ProductData[] = [];

  for (let i = 0; i < n; i++) {
    products.push(generateProduct());
  }

  return products;
}
