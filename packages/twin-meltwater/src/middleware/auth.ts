import { Request, Response, NextFunction } from 'express';

export interface AuthOptions {
  /** Valid API keys. If not provided, any non-empty key is accepted. */
  validKeys?: string[];
}

/**
 * Meltwater uses an `apikey` header for authentication (not Bearer tokens).
 */
export function createAuthMiddleware(options: AuthOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['apikey'] as string | undefined;

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing apikey header',
        code: 401,
      });
      return;
    }

    if (options.validKeys && !options.validKeys.includes(apiKey)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid API key',
        code: 403,
      });
      return;
    }

    // Attach key to request for downstream use
    (req as any).apiKey = apiKey;
    next();
  };
}
