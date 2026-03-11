/**
 * Customer type generators for Ode's customer segments.
 * Categories: retail (Norwegian grocery), horeca, distributor, export.
 */

import { faker } from '@faker-js/faker/locale/nb_NO';
import {
  generateOrgNumber,
  generatePerson,
  generateAddress,
} from './norwegian.js';

export type CustomerType = 'retail' | 'horeca' | 'distributor' | 'export';

export interface CustomerData {
  /** Customer name / company name */
  name: string;
  /** Customer type/category */
  type: CustomerType;
  /** Norwegian organization number (9 digits, MOD-11 valid) */
  orgNumber: string;
  /** Primary contact person */
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  /** Company address */
  address: {
    street: string;
    postalCode: string;
    city: string;
    formatted: string;
  };
}

/** Real Norwegian grocery chains for retail customers */
const RETAIL_NAMES = [
  'Norgesgruppen',
  'REMA 1000',
  'Coop Norge',
  'Bunnpris',
  'Joker',
  'Kiwi',
  'Meny',
  'Spar',
  'Extra',
];

/** HoReCa company name templates */
const HORECA_TEMPLATES = [
  'Restaurant {city}',
  '{lastName}s Kjøkken',
  'Hotel {city}',
  '{city} Catering',
  'Sjømat & Grill {city}',
  'Fjordhotellet {city}',
  '{lastName}s Bistro',
  'Havets Delikatesser',
];

/** Distributor name templates */
const DISTRIBUTOR_TEMPLATES = [
  '{city} Sjømat AS',
  'Nordic Seafood Distribution',
  '{lastName} Fiskeksport',
  'Havbruk Distribusjon AS',
  'Fjord Trading AS',
  'Coast Seafood Logistics',
  'Nordvest Fisk AS',
  '{city} Fish Market AS',
];

/** Export customer name templates */
const EXPORT_TEMPLATES = [
  'Atlantic Seafood Trading Ltd',
  'Nordic Ocean Exports GmbH',
  'Fjord Fresh Europe SAS',
  'Scandinavian Fish Co. Ltd',
  'North Sea Proteins BV',
  'Arctic Catch International',
  'Ocean Harvest Trading Co.',
  'Baltic Seafood Imports Oy',
];

function fillTemplate(template: string): string {
  return template
    .replace('{city}', faker.helpers.arrayElement([
      'Ålesund', 'Bergen', 'Oslo', 'Trondheim', 'Molde', 'Kristiansund',
    ]))
    .replace('{lastName}', faker.person.lastName());
}

/**
 * Generate a customer of a specific type.
 */
export function generateCustomer(type?: CustomerType): CustomerData {
  const customerType = type ?? faker.helpers.arrayElement<CustomerType>([
    'retail', 'horeca', 'distributor', 'export',
  ]);

  let name: string;
  switch (customerType) {
    case 'retail':
      name = faker.helpers.arrayElement(RETAIL_NAMES);
      break;
    case 'horeca':
      name = fillTemplate(faker.helpers.arrayElement(HORECA_TEMPLATES));
      break;
    case 'distributor':
      name = fillTemplate(faker.helpers.arrayElement(DISTRIBUTOR_TEMPLATES));
      break;
    case 'export':
      name = faker.helpers.arrayElement(EXPORT_TEMPLATES);
      break;
  }

  const person = generatePerson();
  const address = generateAddress();

  return {
    name,
    type: customerType,
    orgNumber: generateOrgNumber(),
    contact: {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
    },
    address,
  };
}

/**
 * Generate a set of customers across all types.
 */
export function generateCustomerSet(options?: {
  retail?: number;
  horeca?: number;
  distributor?: number;
  export?: number;
}): CustomerData[] {
  const counts = {
    retail: options?.retail ?? 3,
    horeca: options?.horeca ?? 3,
    distributor: options?.distributor ?? 2,
    export: options?.export ?? 2,
  };

  const customers: CustomerData[] = [];

  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      customers.push(generateCustomer(type as CustomerType));
    }
  }

  return customers;
}
