import type { Context } from 'hono';

/**
 * Custom HTTP error class
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Helper functions to create specific HTTP errors
 */
export const badRequest = (code: string, message: string, details?: unknown): HttpError => {
  return new HttpError(400, code, message, details);
};

export const unauthorized = (code: string, message: string, details?: unknown): HttpError => {
  return new HttpError(401, code, message, details);
};

export const forbidden = (code: string, message: string, details?: unknown): HttpError => {
  return new HttpError(403, code, message, details);
};

export const notFound = (code: string, message: string, details?: unknown): HttpError => {
  return new HttpError(404, code, message, details);
};

export const internal = (code: string, message: string, details?: unknown): HttpError => {
  return new HttpError(500, code, message, details);
};

/**
 * Convert an error to HTTP response format
 */
export const toHttpResponse = (err: unknown): { status: number; body: ErrorResponse } => {
  if (err instanceof HttpError) {
    const errorObj: ErrorResponse['error'] = {
      code: err.code,
      message: err.message,
    };
    if (err.details !== undefined) {
      errorObj.details = err.details;
    }
    return {
      status: err.status,
      body: { error: errorObj },
    };
  }

  // Default to internal server error for unexpected errors
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    },
  };
};

/**
 * Hono error handler middleware
 */
export const errorHandler = (err: Error, ctx: Context): Response => {
  const { status, body } = toHttpResponse(err);
  
  // Log error details (including stack for 500 errors)
  const logger = ctx.get('logger' as never);
  if (logger && typeof logger === 'object' && 'error' in logger && 'warn' in logger) {
    if (status === 500) {
      const logData: any = { 
        error: err.message,
        stack: err.stack,
      };
      if (err instanceof HttpError && err.details) {
        logData.details = err.details;
      }
      (logger as any).error('Internal server error', logData);
    } else {
      (logger as any).warn('HTTP error', {
        status,
        code: body.error.code,
        message: body.error.message,
      });
    }
  }

  return ctx.json(body, status as any);
};