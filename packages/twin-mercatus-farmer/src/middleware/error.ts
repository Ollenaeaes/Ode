import type { Request, Response, NextFunction } from 'express';

/**
 * Application error with status code and optional details.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Middleware to check for X-Twin-Simulate-Error header.
 * Allows clients to trigger specific HTTP errors for testing.
 */
export function simulateErrorMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const simulateError = req.headers['x-twin-simulate-error'];
  if (simulateError) {
    const statusCode = parseInt(String(simulateError), 10);
    if (!isNaN(statusCode) && statusCode >= 400 && statusCode < 600) {
      throw new AppError(statusCode, 'SimulatedError', `Simulated ${statusCode} error via X-Twin-Simulate-Error header`);
    }
  }
  next();
}

/**
 * Global error handling middleware.
 * Must be registered last (after all routes).
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.error,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid JSON in request body',
      details: [],
    });
    return;
  }

  // Fallback for unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    details: [],
  });
}
