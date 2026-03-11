/** Configuration for a single twin service target */
export interface ServiceConfig {
  host: string;
  port: number;
}

/** Map of service name → target config */
export type ServiceRegistry = Record<string, ServiceConfig>;

/** Health status of an individual service */
export interface ServiceHealthStatus {
  status: 'up' | 'down';
  responseTime: number;
}

/** Aggregate health response */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealthStatus>;
}

/** Structured request log entry */
export interface RequestLogEntry {
  timestamp: string;
  method: string;
  path: string;
  service: string;
  statusCode: number;
  responseTime: number;
}

/** Gateway configuration options */
export interface GatewayOptions {
  /** Port the gateway listens on (default: 4000) */
  port?: number;
  /** Health check timeout per service in ms (default: 2000) */
  healthCheckTimeout?: number;
  /** Custom logger — defaults to stdout JSON */
  logger?: (entry: RequestLogEntry) => void;
}
