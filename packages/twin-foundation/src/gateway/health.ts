import http from 'node:http';
import type { ServiceRegistry, HealthResponse, ServiceHealthStatus } from './types.js';

/**
 * Check a single service's health by hitting GET /health.
 */
function checkServiceHealth(
  name: string,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ServiceHealthStatus> {
  return new Promise((resolve) => {
    const start = Date.now();

    const req = http.get({ hostname: host, port, path: '/health', timeout: timeoutMs }, (res) => {
      // Consume response data to free up memory
      res.resume();
      resolve({ status: 'up', responseTime: Date.now() - start });
    });

    req.on('error', () => {
      resolve({ status: 'down', responseTime: Date.now() - start });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'down', responseTime: Date.now() - start });
    });
  });
}

/**
 * Check health of all registered services and return aggregate status.
 *
 * - "healthy" if all services are up (or zero services registered)
 * - "unhealthy" if all services are down
 * - "degraded" if some are up and some are down
 */
export async function aggregateHealth(
  registry: ServiceRegistry,
  timeoutMs: number = 2000,
): Promise<HealthResponse> {
  const entries = Object.entries(registry);

  // Zero services = healthy (vacuous truth)
  if (entries.length === 0) {
    return { status: 'healthy', services: {} };
  }

  const checks = await Promise.all(
    entries.map(async ([name, config]) => {
      const health = await checkServiceHealth(name, config.host, config.port, timeoutMs);
      return [name, health] as const;
    }),
  );

  const services: Record<string, ServiceHealthStatus> = {};
  let upCount = 0;

  for (const [name, health] of checks) {
    services[name] = health;
    if (health.status === 'up') {
      upCount++;
    }
  }

  let status: HealthResponse['status'];
  if (upCount === entries.length) {
    status = 'healthy';
  } else if (upCount === 0) {
    status = 'unhealthy';
  } else {
    status = 'degraded';
  }

  return { status, services };
}
