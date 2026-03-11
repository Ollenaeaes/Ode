import type { Request, Response, NextFunction } from 'express';

const DEFAULT_SUBSCRIPTION_KEY = 'test-subscription-key';
const DEFAULT_TB_KEY = 'test-tb-key';

export interface TidsbankenAuthOptions {
  subscriptionKey?: string;
  tbKey?: string;
}

/**
 * Tidsbanken uses subscription-key + tb-key headers (NOT Bearer tokens).
 */
export function createTidsbankenAuth(options: TidsbankenAuthOptions = {}) {
  const expectedSubKey = options.subscriptionKey || process.env.TB_SUBSCRIPTION_KEY || DEFAULT_SUBSCRIPTION_KEY;
  const expectedTbKey = options.tbKey || process.env.TB_KEY || DEFAULT_TB_KEY;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth for admin routes
    if (req.path.startsWith('/admin')) {
      next();
      return;
    }

    const subKey = req.headers['subscription-key'] as string | undefined;
    const tbKey = req.headers['tb-key'] as string | undefined;

    if (!subKey || !tbKey) {
      res.status(401).json({
        statusCode: 401,
        message: 'Missing required authentication headers: subscription-key and tb-key',
      });
      return;
    }

    if (subKey !== expectedSubKey || tbKey !== expectedTbKey) {
      res.status(403).json({
        statusCode: 403,
        message: 'Invalid authentication credentials',
      });
      return;
    }

    next();
  };
}
