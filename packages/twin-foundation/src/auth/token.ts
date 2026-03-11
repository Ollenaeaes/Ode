import type { TokenPayload, UserContext } from './types.js';

/**
 * Base64url encode a string (no padding, URL-safe).
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64url decode a string back to UTF-8.
 */
function base64urlDecode(str: string): string {
  // Restore standard base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Create a mock JWT-like token from a payload.
 *
 * Structure: header.payload.signature (three base64url segments separated by dots).
 * The header is a fixed `{"alg":"none","typ":"JWT"}`.
 * The signature is a fixed placeholder (no real signing — this is simulation).
 */
export function createTestToken(payload: Partial<TokenPayload> & { sub: string; tid: string; roles: string[]; name: string }): string {
  const header = base64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));

  const fullPayload: TokenPayload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ...payload,
  };

  const body = base64urlEncode(JSON.stringify(fullPayload));
  const signature = base64urlEncode('mock-signature');

  return `${header}.${body}.${signature}`;
}

/**
 * Decode a mock JWT-like token and extract the UserContext.
 *
 * Validates:
 * - Token has exactly three dot-separated segments
 * - Payload is valid base64url-encoded JSON
 * - Payload contains required fields: sub, tid, roles, name
 *
 * @throws Error with descriptive message on invalid tokens
 */
export function decodeToken(token: string): UserContext {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid token format: expected three segments');
  }

  let payload: Record<string, unknown>;
  try {
    const decoded = base64urlDecode(segments[1]);
    payload = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid token: payload is not valid base64url-encoded JSON');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid token: payload is not an object');
  }

  const missing: string[] = [];
  if (typeof payload.sub !== 'string') missing.push('sub');
  if (typeof payload.tid !== 'string') missing.push('tid');
  if (!Array.isArray(payload.roles)) missing.push('roles');
  if (typeof payload.name !== 'string') missing.push('name');

  if (missing.length > 0) {
    throw new Error(`Invalid token: missing required fields: ${missing.join(', ')}`);
  }

  return {
    userId: payload.sub as string,
    tenantId: payload.tid as string,
    roles: payload.roles as string[],
    name: payload.name as string,
  };
}
