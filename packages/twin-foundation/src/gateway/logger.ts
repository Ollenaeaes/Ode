import type { RequestLogEntry } from './types.js';

/**
 * Default request logger — writes structured JSON to stdout, one line per request.
 */
export function createRequestLogger(): (entry: RequestLogEntry) => void {
  return (entry: RequestLogEntry): void => {
    process.stdout.write(JSON.stringify(entry) + '\n');
  };
}
