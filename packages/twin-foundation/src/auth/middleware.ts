import type { Request, Response, NextFunction } from 'express';
import type { AuthOptions, AuthMiddleware, UserContext } from './types.js';
import { decodeToken } from './token.js';

/**
 * Create an Express auth middleware that validates Bearer tokens.
 *
 * @param options - Optional configuration for custom validation, required roles, and public routes
 * @returns Express middleware function
 */
export function createAuthMiddleware(options?: AuthOptions): AuthMiddleware {
  const validateToken = options?.validateToken ?? decodeToken;
  const requiredRoles = options?.requiredRoles ?? [];
  const publicRoutes = options?.publicRoutes ?? [];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if the route is public
    if (publicRoutes.includes(req.path)) {
      next();
      return;
    }

    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Unauthorized', message: 'No authorization header' });
      return;
    }

    // Check for Bearer scheme
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Bearer token required' });
      return;
    }

    // Extract and validate token
    const token = authHeader.slice(7);
    let user: UserContext;
    try {
      user = validateToken(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      res.status(401).json({ error: 'Unauthorized', message });
      return;
    }

    // Check required roles
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        res.status(401).json({
          error: 'Unauthorized',
          message: `Required role: ${requiredRoles.join(' or ')}`,
        });
        return;
      }
    }

    // Attach user context to request
    (req as Request & { user: UserContext }).user = user;
    next();
  };
}
