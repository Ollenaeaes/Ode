import type { Request, Response, NextFunction } from 'express';

/** Standard JWT-like token payload shape */
export interface TokenPayload {
  /** Subject — maps to userId */
  sub: string;
  /** Tenant ID — maps to tenantId */
  tid: string;
  /** User roles */
  roles: string[];
  /** Display name */
  name: string;
  /** Issued at (unix timestamp) */
  iat: number;
  /** Expiration (unix timestamp) */
  exp: number;
}

/** User context attached to request after auth */
export interface UserContext {
  userId: string;
  tenantId: string;
  roles: string[];
  name: string;
}

/** Custom token validator — return UserContext or throw */
export type TokenValidator = (token: string) => UserContext;

/** Options for configuring the auth middleware */
export interface AuthOptions {
  /** Custom token validation logic (overrides default) */
  validateToken?: TokenValidator;
  /** Roles required for all routes (unless overridden) */
  requiredRoles?: string[];
  /** Routes that skip authentication entirely (matched by path) */
  publicRoutes?: string[];
}

/** Express request with user context attached */
export interface AuthenticatedRequest extends Request {
  user: UserContext;
}

/** Express middleware function type */
export type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;
