/**
 * Seasonal pattern generators for aquaculture time-series data.
 * Produces temperature-dependent growth curves, feed consumption, and mortality patterns.
 */

import { faker } from '@faker-js/faker/locale/nb_NO';

export type TimeInterval = 'hourly' | 'daily' | 'weekly';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesOptions {
  /** Start date of the series */
  from: Date;
  /** End date of the series */
  to: Date;
  /** Data point interval */
  interval: TimeInterval;
}

/** Interval durations in milliseconds */
const INTERVAL_MS: Record<TimeInterval, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Generate timestamps for a time range at the given interval.
 * No gaps — every interval step is represented.
 */
function generateTimestamps(options: TimeSeriesOptions): Date[] {
  const { from, to, interval } = options;
  const step = INTERVAL_MS[interval];
  const timestamps: Date[] = [];

  let current = from.getTime();
  const end = to.getTime();

  while (current <= end) {
    timestamps.push(new Date(current));
    current += step;
  }

  return timestamps;
}

/**
 * Sea temperature model for Møre og Romsdal coast.
 * Follows a sinusoidal annual curve:
 * - Winter (Jan–Feb): ~4–6°C
 * - Spring (Mar–May): ~6–10°C
 * - Summer (Jun–Aug): ~12–16°C
 * - Autumn (Sep–Nov): ~8–12°C
 */
function seaTemperature(date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000)
  );
  // Sinusoidal: peak around day 200 (mid-July), trough around day 15 (mid-January)
  const base = 10; // mean temperature
  const amplitude = 6; // ±6°C swing
  const phase = ((dayOfYear - 200) / 365) * 2 * Math.PI;
  const temp = base + amplitude * Math.cos(phase);
  // Add small noise
  const noise = (faker.number.float({ min: -0.5, max: 0.5 }));
  return Math.round((temp + noise) * 10) / 10;
}

/**
 * Generate sea temperature time series.
 */
export function generateTemperatureSeries(options: TimeSeriesOptions): TimeSeriesPoint[] {
  const timestamps = generateTimestamps(options);
  return timestamps.map((date) => ({
    timestamp: date.toISOString(),
    value: seaTemperature(date),
  }));
}

/**
 * Generate cod growth time series (average weight in grams).
 * Growth is temperature-dependent: faster in warmer months.
 * Starting from an initial weight, increasing over time.
 */
export function generateGrowthSeries(
  options: TimeSeriesOptions & { initialWeightGrams?: number },
): TimeSeriesPoint[] {
  const timestamps = generateTimestamps(options);
  let weight = options.initialWeightGrams ?? 100;

  return timestamps.map((date) => {
    const temp = seaTemperature(date);
    // Growth rate: roughly 0.3–1.5% per day depending on temperature
    // Optimal growth at 10–14°C for Atlantic cod
    const optimalTemp = 12;
    const tempFactor = Math.max(0.1, 1 - Math.abs(temp - optimalTemp) / 20);
    const dailyGrowthRate = 0.003 + 0.012 * tempFactor;

    // Scale growth rate by interval
    const intervalDays = INTERVAL_MS[options.interval] / INTERVAL_MS.daily;
    const growthFactor = 1 + dailyGrowthRate * intervalDays;

    // Small noise
    const noise = 1 + faker.number.float({ min: -0.002, max: 0.002 });
    weight = Math.round(weight * growthFactor * noise * 10) / 10;

    return {
      timestamp: date.toISOString(),
      value: weight,
    };
  });
}

/**
 * Generate feed consumption time series (kg per day).
 * Feed consumption correlates with growth rate and temperature.
 * Higher in summer, lower in winter.
 */
export function generateFeedSeries(
  options: TimeSeriesOptions & {
    /** Number of fish in the cohort */
    fishCount?: number;
    /** Average weight in grams (used for initial feed calculation) */
    avgWeightGrams?: number;
  },
): TimeSeriesPoint[] {
  const timestamps = generateTimestamps(options);
  const fishCount = options.fishCount ?? 100_000;
  let avgWeight = options.avgWeightGrams ?? 500;

  return timestamps.map((date) => {
    const temp = seaTemperature(date);

    // Feed rate: 0.5–2% of body weight per day, temperature-dependent
    const optimalTemp = 12;
    const tempFactor = Math.max(0.2, 1 - Math.abs(temp - optimalTemp) / 20);
    const feedRatePercent = 0.005 + 0.015 * tempFactor;

    const intervalDays = INTERVAL_MS[options.interval] / INTERVAL_MS.daily;

    // Feed in kg = (fish count * avg weight in kg * feed rate * days)
    const feedKg = fishCount * (avgWeight / 1000) * feedRatePercent * intervalDays;

    // Slowly increase average weight for feed calculation
    const dailyGrowthRate = 0.003 + 0.012 * tempFactor;
    avgWeight *= 1 + dailyGrowthRate * intervalDays;

    // Add noise
    const noise = 1 + faker.number.float({ min: -0.05, max: 0.05 });
    const value = Math.round(feedKg * noise * 100) / 100;

    return {
      timestamp: date.toISOString(),
      value: Math.max(0, value),
    };
  });
}

/**
 * Generate mortality time series (cumulative fish count lost).
 * Baseline mortality ~0.01–0.05% per day with occasional spike events.
 */
export function generateMortalitySeries(
  options: TimeSeriesOptions & {
    /** Initial fish count */
    initialCount?: number;
  },
): TimeSeriesPoint[] {
  const timestamps = generateTimestamps(options);
  const initialCount = options.initialCount ?? 100_000;
  let cumulativeMortality = 0;

  return timestamps.map((date, i) => {
    const intervalDays = INTERVAL_MS[options.interval] / INTERVAL_MS.daily;

    // Baseline daily mortality rate: 0.01–0.05%
    const baseRate = 0.0001 + faker.number.float({ min: 0, max: 0.0004 });

    // Occasional spike events (roughly 1–2% chance per data point)
    const isSpike = faker.number.float({ min: 0, max: 1 }) < 0.015;
    const spikeMultiplier = isSpike ? faker.number.float({ min: 5, max: 20 }) : 1;

    const dailyLoss = Math.round(
      initialCount * baseRate * spikeMultiplier * intervalDays
    );
    cumulativeMortality += dailyLoss;

    return {
      timestamp: date.toISOString(),
      value: cumulativeMortality,
    };
  });
}

/**
 * Generic time-series generator that delegates to specific series types.
 */
export function generateTimeSeries(
  type: 'temperature' | 'growth' | 'feed' | 'mortality',
  options: TimeSeriesOptions & Record<string, unknown>,
): TimeSeriesPoint[] {
  switch (type) {
    case 'temperature':
      return generateTemperatureSeries(options);
    case 'growth':
      return generateGrowthSeries(options);
    case 'feed':
      return generateFeedSeries(options);
    case 'mortality':
      return generateMortalitySeries(options);
  }
}
