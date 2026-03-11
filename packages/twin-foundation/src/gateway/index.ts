export { createGateway, startGateway } from './server.js';
export { aggregateHealth } from './health.js';
export { createRequestLogger } from './logger.js';
export type {
  ServiceConfig,
  ServiceRegistry,
  ServiceHealthStatus,
  HealthResponse,
  RequestLogEntry,
  GatewayOptions,
} from './types.js';
