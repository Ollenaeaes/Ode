import http from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import type { ServiceRegistry, GatewayOptions, RequestLogEntry } from './types.js';
import { aggregateHealth } from './health.js';
import { createRequestLogger } from './logger.js';

/**
 * Resolve service name from the first path segment.
 * e.g. "/mercatus/products" → { service: "mercatus", remainingPath: "/products" }
 */
function resolveService(path: string): { service: string; remainingPath: string } | null {
  // path starts with /
  const withoutLeadingSlash = path.slice(1);
  const slashIndex = withoutLeadingSlash.indexOf('/');

  if (slashIndex === -1) {
    // e.g. "/mercatus" → service is "mercatus", remaining path is "/"
    return { service: withoutLeadingSlash, remainingPath: '/' };
  }

  const service = withoutLeadingSlash.slice(0, slashIndex);
  const remainingPath = withoutLeadingSlash.slice(slashIndex);

  return service ? { service, remainingPath } : null;
}

/**
 * Proxy a request to a target twin service using raw http.request.
 */
function proxyRequest(
  req: Request,
  res: Response,
  targetHost: string,
  targetPort: number,
  targetPath: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proxyReq = http.request(
      {
        hostname: targetHost,
        port: targetPort,
        path: targetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${targetHost}:${targetPort}`,
        },
      },
      (proxyRes) => {
        // Forward status code
        res.status(proxyRes.statusCode ?? 500);

        // Forward response headers
        const headers = proxyRes.headers;
        for (const [key, value] of Object.entries(headers)) {
          if (value !== undefined && key !== 'transfer-encoding') {
            res.setHeader(key, value);
          }
        }

        // Pipe response body
        proxyRes.pipe(res);
        proxyRes.on('end', () => resolve(proxyRes.statusCode ?? 500));
      },
    );

    proxyReq.on('error', (err) => {
      reject(err);
    });

    // Forward request body
    req.pipe(proxyReq);
  });
}

/**
 * Create the API Gateway Express application.
 *
 * @param registry - Service name → { host, port } mapping
 * @param options - Optional gateway configuration
 * @returns Express application configured as a gateway
 */
export function createGateway(
  registry: ServiceRegistry,
  options?: GatewayOptions,
): express.Express {
  const app = express();
  const healthCheckTimeout = options?.healthCheckTimeout ?? 2000;
  const logEntry = options?.logger ?? createRequestLogger();

  // Health endpoint — aggregates health from all registered services
  app.get('/health', async (_req: Request, res: Response) => {
    const start = Date.now();
    const health = await aggregateHealth(registry, healthCheckTimeout);
    res.json(health);

    logEntry({
      timestamp: new Date().toISOString(),
      method: 'GET',
      path: '/health',
      service: 'gateway',
      statusCode: 200,
      responseTime: Date.now() - start,
    });
  });

  // Proxy all other requests based on first path segment
  app.use(async (req: Request, res: Response) => {
    const start = Date.now();
    const originalPath = req.originalUrl;

    const resolved = resolveService(originalPath);

    if (!resolved || !resolved.service) {
      const statusCode = 404;
      res.status(statusCode).json({ error: 'Not Found', message: 'Unknown service: ' });
      logEntry({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: originalPath,
        service: 'unknown',
        statusCode,
        responseTime: Date.now() - start,
      });
      return;
    }

    const { service, remainingPath } = resolved;
    const target = registry[service];

    if (!target) {
      const statusCode = 404;
      res.status(statusCode).json({ error: 'Not Found', message: `Unknown service: ${service}` });
      logEntry({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: originalPath,
        service,
        statusCode,
        responseTime: Date.now() - start,
      });
      return;
    }

    try {
      const statusCode = await proxyRequest(req, res, target.host, target.port, remainingPath);
      logEntry({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: originalPath,
        service,
        statusCode,
        responseTime: Date.now() - start,
      });
    } catch {
      const statusCode = 502;
      if (!res.headersSent) {
        res.status(statusCode).json({
          error: 'Bad Gateway',
          message: `Service ${service} is not available`,
        });
      }
      logEntry({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: originalPath,
        service,
        statusCode,
        responseTime: Date.now() - start,
      });
    }
  });

  return app;
}

/**
 * Start the gateway server.
 *
 * @param registry - Service name → { host, port } mapping
 * @param options - Optional gateway configuration
 * @returns The HTTP server instance
 */
export function startGateway(
  registry: ServiceRegistry,
  options?: GatewayOptions,
): http.Server {
  const app = createGateway(registry, options);
  const port = options?.port ?? (process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : 4000);

  const server = app.listen(port, () => {
    // silent by default — tests don't need console noise
  });

  return server;
}
