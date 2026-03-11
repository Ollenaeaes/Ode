/**
 * Canonical Ode locations — all physical sites in the Ode Seafood operation.
 * These are the ONLY locations data generators should reference.
 */

export interface OdeLocation {
  name: string;
  type: 'headquarters' | 'processing' | 'hatchery' | 'sea_site';
  municipality: string;
  postalCode: string;
  city: string;
}

export const ODE_LOCATIONS: readonly OdeLocation[] = [
  // Headquarters
  {
    name: 'Ode Hovedkontor',
    type: 'headquarters',
    municipality: 'Ålesund',
    postalCode: '6003',
    city: 'Ålesund',
  },
  // Processing plant
  {
    name: 'Ode Foredling Vartdal',
    type: 'processing',
    municipality: 'Ørsta',
    postalCode: '6170',
    city: 'Vartdal',
  },
  // Hatcheries
  {
    name: 'Ode Settefisk Rødberg',
    type: 'hatchery',
    municipality: 'Nore og Uvdal',
    postalCode: '3630',
    city: 'Rødberg',
  },
  {
    name: 'Lumarine Tjeldbergodden',
    type: 'hatchery',
    municipality: 'Aure',
    postalCode: '6694',
    city: 'Tjeldbergodden',
  },
  // Sea sites (10) — plausible Møre og Romsdal coastal locations
  {
    name: 'Storfjorden',
    type: 'sea_site',
    municipality: 'Fjord',
    postalCode: '6210',
    city: 'Valldal',
  },
  {
    name: 'Hjørundfjorden',
    type: 'sea_site',
    municipality: 'Ørsta',
    postalCode: '6196',
    city: 'Norangsfjorden',
  },
  {
    name: 'Hareidlandet',
    type: 'sea_site',
    municipality: 'Hareid',
    postalCode: '6060',
    city: 'Hareid',
  },
  {
    name: 'Sula',
    type: 'sea_site',
    municipality: 'Sula',
    postalCode: '6030',
    city: 'Langevåg',
  },
  {
    name: 'Giske',
    type: 'sea_site',
    municipality: 'Giske',
    postalCode: '6052',
    city: 'Giske',
  },
  {
    name: 'Ellingsøya',
    type: 'sea_site',
    municipality: 'Ålesund',
    postalCode: '6057',
    city: 'Ellingsøy',
  },
  {
    name: 'Lepsøya',
    type: 'sea_site',
    municipality: 'Haram',
    postalCode: '6260',
    city: 'Skodje',
  },
  {
    name: 'Ona',
    type: 'sea_site',
    municipality: 'Hustadvika',
    postalCode: '6490',
    city: 'Eide',
  },
  {
    name: 'Sandøya',
    type: 'sea_site',
    municipality: 'Ålesund',
    postalCode: '6025',
    city: 'Ålesund',
  },
  {
    name: 'Kvamsøya',
    type: 'sea_site',
    municipality: 'Sande',
    postalCode: '6084',
    city: 'Larsnes',
  },
] as const;

/** All canonical location names */
export const ODE_LOCATION_NAMES = ODE_LOCATIONS.map((l) => l.name);

/** Sea site locations only */
export const ODE_SEA_SITES = ODE_LOCATIONS.filter((l) => l.type === 'sea_site');

/** Hatchery locations only */
export const ODE_HATCHERIES = ODE_LOCATIONS.filter((l) => l.type === 'hatchery');
