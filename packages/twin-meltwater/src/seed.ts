import Database from 'better-sqlite3';
import crypto from 'node:crypto';

// --- Deterministic PRNG (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedOptions {
  count?: number;
  fromDate?: string;
  toDate?: string;
  seed?: number;
}

const SOURCES = [
  { name: 'NRK', type: 'broadcast', country: 'NO', lang: 'no' },
  { name: 'Fiskeribladet', type: 'print', country: 'NO', lang: 'no' },
  { name: 'IntraFish', type: 'online', country: 'NO', lang: 'no' },
  { name: 'iLaks', type: 'online', country: 'NO', lang: 'no' },
  { name: 'Bergens Tidende', type: 'print', country: 'NO', lang: 'no' },
  { name: 'Sysla', type: 'online', country: 'NO', lang: 'no' },
  { name: 'E24', type: 'online', country: 'NO', lang: 'no' },
  { name: 'Nationen', type: 'print', country: 'NO', lang: 'no' },
  { name: 'Kyst.no', type: 'online', country: 'NO', lang: 'no' },
  { name: 'Financial Times', type: 'print', country: 'GB', lang: 'en' },
  { name: 'Seafood Source', type: 'online', country: 'US', lang: 'en' },
  { name: 'Undercurrent News', type: 'online', country: 'GB', lang: 'en' },
  { name: 'The Fish Site', type: 'online', country: 'GB', lang: 'en' },
  { name: 'Aquaculture Magazine', type: 'print', country: 'US', lang: 'en' },
];

const TOPICS = [
  'cod farming',
  'aquaculture sustainability',
  'Norwegian seafood exports',
  'deep farming',
  'Nautilus',
  'Snow Cod brand',
  'fish welfare',
  'competitor news',
  'industry regulation',
  'product launches',
  'food safety',
];

const ENTITIES = [
  'Ode',
  'Snow Cod',
  'Nautilus',
  'Norcod',
  'Lerøy',
  'Mowi',
  'Cermaq',
  'SalMar',
  'Norwegian Seafood Council',
  'Fiskeridirektoratet',
  'Mattilsynet',
];

// Event spike dates and their associated topics/entities
const EVENT_SPIKES = [
  { date: '2025-09-15', topic: 'product launches', entity: 'Ode', label: 'AquaNor', count: 15 },
  { date: '2025-10-01', topic: 'Norwegian seafood exports', entity: 'Ode', label: 'Ode Q3', count: 12 },
  { date: '2025-11-20', topic: 'Snow Cod brand', entity: 'Snow Cod', label: 'Snow Cod launch', count: 18 },
  { date: '2025-12-10', topic: 'aquaculture sustainability', entity: 'Ode', label: 'Sustainability cert', count: 10 },
  { date: '2026-01-15', topic: 'Norwegian seafood exports', entity: 'Ode', label: 'Q4 report', count: 14 },
  { date: '2026-02-01', topic: 'deep farming', entity: 'Nautilus', label: 'Nautilus results', count: 12 },
  { date: '2026-02-20', topic: 'Norwegian seafood exports', entity: 'Norwegian Seafood Council', label: 'Export stats', count: 10 },
];

const TITLE_TEMPLATES_NO: Record<string, string[]> = {
  'cod farming': [
    'Torskeoppdrett vokser i nord',
    'Ny milepæl for norsk torskeopprett',
    'Rekordproduksjon av oppdrettstorsk',
    'Torskenæringen tar nye steg fremover',
  ],
  'aquaculture sustainability': [
    'Bærekraftig oppdrett i fokus',
    'Ny sertifisering for bærekraftig akvakultur',
    'Miljøvennlig oppdrett gir resultater',
    'Bærekraft i havbruksnæringen',
  ],
  'Norwegian seafood exports': [
    'Sjømateksport slår ny rekord',
    'Norsk sjømat populær internasjonalt',
    'Eksportverdien av norsk sjømat øker',
    'Sterk vekst i sjømateksporten',
  ],
  'deep farming': [
    'Dypdyrking av torsk viser lovende resultater',
    'Nautilus-teknologi revolusjonerer oppdrett',
    'Havdybde gir bedre fiskevelferd',
    'Dypvannsoppdrett tar neste steg',
  ],
  'Nautilus': [
    'Nautilus-prosjektet leverer sterke tall',
    'Fremtidens oppdrett med Nautilus',
    'Nautilus-konseptet tiltrekker investorer',
    'Ode satser videre på Nautilus',
  ],
  'Snow Cod brand': [
    'Snow Cod lanseres i nye markeder',
    'Premium torsk under Snow Cod merkevare',
    'Snow Cod tar markedsandeler',
    'Etterspørselen etter Snow Cod øker',
  ],
  'fish welfare': [
    'Fiskevelferd i fokus hos oppdrettere',
    'Nye standarder for fiskevelferd',
    'Bedre velferd gir bedre torsk',
    'Fiskevelferd: Næringen tar grep',
  ],
  'competitor news': [
    'Konkurrentene investerer i torsk',
    'Nye aktører i torskeopprett',
    'Markedskamp i torskesektoren',
    'Stor aktivitet blant torskeprodusentene',
  ],
  'industry regulation': [
    'Nye reguleringer for havbruk',
    'Fiskeridirektoratet strammer inn krav',
    'Konsesjonsregler under revisjon',
    'Myndighetene endrer rammevilkår',
  ],
  'product launches': [
    'Ny torskprodukt lansert på markedet',
    'Innovasjon i sjømatprodukter',
    'AquaNor viser frem nye løsninger',
    'Norsk sjømat satser på kvalitet',
  ],
  'food safety': [
    'Mattilsynet godkjenner nye prosesser',
    'Mattrygghet i sjømatnæringen',
    'Strenge krav til sjømatkvalitet',
    'Nye rutiner for kvalitetskontroll',
  ],
};

const TITLE_TEMPLATES_EN: Record<string, string[]> = {
  'cod farming': [
    'Norwegian cod farming reaches new milestone',
    'Atlantic cod aquaculture expands rapidly',
    'Cod farming industry sees record growth',
    'Innovation drives cod aquaculture forward',
  ],
  'aquaculture sustainability': [
    'Sustainable aquaculture gains momentum',
    'New certification boosts sustainable farming',
    'Environmental impact of fish farming improving',
    'Sustainability at the heart of modern aquaculture',
  ],
  'Norwegian seafood exports': [
    'Norwegian seafood exports hit record high',
    'Global demand for Norwegian fish grows',
    'Norway leads seafood export rankings',
    'Premium Norwegian seafood captures new markets',
  ],
  'deep farming': [
    'Deep water farming shows promising results',
    'Nautilus technology transforms aquaculture',
    'Deep farming improves fish welfare metrics',
    'Innovative deep-water systems reduce mortality',
  ],
  'Nautilus': [
    'Nautilus project delivers strong performance',
    'Future of farming: the Nautilus concept',
    'Investors flock to Nautilus technology',
    'Nautilus expansion plans announced',
  ],
  'Snow Cod brand': [
    'Snow Cod brand enters premium markets',
    'Premium cod brand Snow Cod expands globally',
    'Snow Cod wins food industry award',
    'Consumer demand drives Snow Cod growth',
  ],
  'fish welfare': [
    'Fish welfare standards rise across industry',
    'New welfare benchmarks for cod farming',
    'Better welfare leads to better fish',
    'Industry adopts stricter welfare protocols',
  ],
  'competitor news': [
    'Competition heats up in cod aquaculture',
    'New entrants challenge established cod farmers',
    'Market dynamics shift in cod sector',
    'Major players invest in cod farming',
  ],
  'industry regulation': [
    'Regulatory changes reshape aquaculture landscape',
    'New licensing rules for fish farming announced',
    'Government tightens aquaculture requirements',
    'Policy shifts impact farming operations',
  ],
  'product launches': [
    'New cod product line launches at AquaNor',
    'Innovation showcase at aquaculture trade fair',
    'Product innovation drives seafood industry',
    'Next-generation seafood products unveiled',
  ],
  'food safety': [
    'Food safety standards in seafood industry tighten',
    'Quality control advances in fish processing',
    'New food safety protocols for seafood',
    'Regulatory approval for novel processing methods',
  ],
};

const SNIPPET_PARTS_NO = [
  'Selskapet rapporterer om sterk vekst i produksjonen av oppdrettstorsk.',
  'Nye investeringer i teknologi gir lovende resultater for næringen.',
  'Bærekraftig praksis er i fokus for norsk havbruk.',
  'Eksperter mener at torskeopprett har stort potensial fremover.',
  'Myndighetene følger utviklingen tett med nye krav og retningslinjer.',
  'Norsk sjømat fortsetter å være etterspurt i internasjonale markeder.',
  'Fiskevelferden har blitt et sentralt tema for bransjen.',
  'Nye konsesjonssøknader viser stor interesse for torskeoppdrett.',
  'Teknologisk innovasjon driver næringen fremover.',
  'Kvaliteten på norsk oppdrettstorsk anerkjennes globalt.',
];

const SNIPPET_PARTS_EN = [
  'The company reports strong growth in farmed cod production.',
  'New technology investments show promising results for the industry.',
  'Sustainable practices are at the forefront of Norwegian aquaculture.',
  'Experts believe cod farming has significant potential going forward.',
  'Regulators are closely monitoring developments with new requirements.',
  'Norwegian seafood continues to be in high demand internationally.',
  'Fish welfare has become a central focus for the industry.',
  'New license applications indicate growing interest in cod farming.',
  'Technological innovation continues to drive the industry forward.',
  'The quality of Norwegian farmed cod is gaining global recognition.',
];

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickMultiple<T>(arr: T[], count: number, rand: () => number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

function generateReach(rand: () => number): number {
  // Long-tail distribution: most mentions have low reach, a few are huge
  const u = rand();
  if (u < 0.6) return Math.floor(500 + rand() * 9500); // 500-10,000
  if (u < 0.85) return Math.floor(10000 + rand() * 90000); // 10,000-100,000
  if (u < 0.95) return Math.floor(100000 + rand() * 400000); // 100,000-500,000
  return Math.floor(500000 + rand() * 1500000); // 500,000-2,000,000
}

function generateSentiment(rand: () => number): { label: string; score: number } {
  const u = rand();
  if (u < 0.45) {
    // Positive
    return { label: 'positive', score: 0.3 + rand() * 0.7 };
  } else if (u < 0.80) {
    // Neutral
    return { label: 'neutral', score: -0.2 + rand() * 0.4 };
  } else {
    // Negative
    return { label: 'negative', score: -(0.3 + rand() * 0.7) };
  }
}

function generateDate(from: Date, to: Date, rand: () => number): Date {
  const diff = to.getTime() - from.getTime();
  return new Date(from.getTime() + Math.floor(rand() * diff));
}

function formatDate(d: Date): string {
  return d.toISOString();
}

function generateMention(
  index: number,
  rand: () => number,
  from: Date,
  to: Date,
  overrides?: { topic?: string; entity?: string; date?: Date }
) {
  const source = pickRandom(SOURCES, rand);
  const topic = overrides?.topic ?? pickRandom(TOPICS, rand);
  const extraTopics = pickMultiple(
    TOPICS.filter((t) => t !== topic),
    Math.floor(rand() * 2),
    rand
  );
  const allTopics = [topic, ...extraTopics];

  const entity = overrides?.entity ?? pickRandom(ENTITIES, rand);
  const extraEntities = pickMultiple(
    ENTITIES.filter((e) => e !== entity),
    Math.floor(rand() * 3),
    rand
  );
  const allEntities = [entity, ...extraEntities];

  const sentiment = generateSentiment(rand);
  const publishedAt = overrides?.date ?? generateDate(from, to, rand);

  // Pick language: 60% no, 30% en, 10% other
  let lang: string;
  const langRoll = rand();
  if (langRoll < 0.6) {
    lang = 'no';
  } else if (langRoll < 0.9) {
    lang = 'en';
  } else {
    lang = pickRandom(['sv', 'da', 'de', 'fr', 'es'], rand);
  }

  // For non-no/en languages, use English templates
  const titleTemplates = lang === 'no' ? TITLE_TEMPLATES_NO : TITLE_TEMPLATES_EN;
  const snippetParts = lang === 'no' ? SNIPPET_PARTS_NO : SNIPPET_PARTS_EN;

  const templates = titleTemplates[topic] ?? titleTemplates['cod farming']!;
  const title = pickRandom(templates, rand);
  const snippet = pickRandom(snippetParts, rand) + ' ' + pickRandom(snippetParts, rand);

  const sourceSlug = source.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const dateSlug = publishedAt.toISOString().slice(0, 10);
  const url = `https://www.${sourceSlug}.com/articles/${dateSlug}/${topic.replace(/\s+/g, '-')}-${index}`;

  return {
    id: crypto.randomUUID(),
    title,
    snippet,
    url,
    source: source.name,
    sourceType: source.type,
    publishedAt: formatDate(publishedAt),
    language: lang,
    sentimentLabel: sentiment.label,
    sentimentScore: Math.round(sentiment.score * 100) / 100,
    reach: generateReach(rand),
    topics: JSON.stringify(allTopics),
    entities: JSON.stringify(allEntities),
    country: source.country,
  };
}

export function seedDatabase(db: Database.Database, options: SeedOptions = {}): number {
  const {
    count = 500,
    fromDate = '2025-09-01',
    toDate = '2026-03-01',
    seed = 42,
  } = options;

  const rand = mulberry32(seed);
  const from = new Date(fromDate);
  const to = new Date(toDate);

  const insert = db.prepare(`
    INSERT INTO mentions (id, title, snippet, url, source, sourceType, publishedAt, language, sentimentLabel, sentimentScore, reach, topics, entities, country)
    VALUES (@id, @title, @snippet, @url, @source, @sourceType, @publishedAt, @language, @sentimentLabel, @sentimentScore, @reach, @topics, @entities, @country)
  `);

  const mentions: ReturnType<typeof generateMention>[] = [];

  // Generate event spike mentions first
  let idx = 0;
  for (const spike of EVENT_SPIKES) {
    const spikeDate = new Date(spike.date);
    for (let i = 0; i < spike.count; i++) {
      // Spread spike mentions across a 3-day window around the event
      const offsetDays = (rand() - 0.5) * 3;
      const date = new Date(spikeDate.getTime() + offsetDays * 86400000);
      mentions.push(
        generateMention(idx++, rand, from, to, {
          topic: spike.topic,
          entity: spike.entity,
          date,
        })
      );
    }
  }

  // Fill remaining with random mentions
  const remaining = count - mentions.length;
  for (let i = 0; i < remaining; i++) {
    mentions.push(generateMention(idx++, rand, from, to));
  }

  // Sort by date for insertion
  mentions.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const insertMany = db.transaction((items: typeof mentions) => {
    for (const m of items) {
      insert.run(m);
    }
  });

  insertMany(mentions);

  return mentions.length;
}
