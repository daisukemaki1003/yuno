/**
 * Custom HTTP error class
 */
export class HttpError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'HttpError';
    }
}
/**
 * Helper functions to create specific HTTP errors
 */
export const badRequest = (code, message, details) => {
    return new HttpError(400, code, message, details);
};
export const unauthorized = (code, message, details) => {
    return new HttpError(401, code, message, details);
};
export const forbidden = (code, message, details) => {
    return new HttpError(403, code, message, details);
};
export const notFound = (code, message, details) => {
    return new HttpError(404, code, message, details);
};
export const internal = (code, message, details) => {
    return new HttpError(500, code, message, details);
};
/**
 * Convert an error to HTTP response format
 */
export const toHttpResponse = (err) => {
    if (err instanceof HttpError) {
        const errorObj = {
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
export const errorHandler = (err, ctx) => {
    const { status, body } = toHttpResponse(err);
    // Log error details (including stack for 500 errors)
    const logger = ctx.get('logger');
    if (logger && typeof logger === 'object' && 'error' in logger && 'warn' in logger) {
        if (status === 500) {
            const logData = {
                error: err.message,
                stack: err.stack,
            };
            if (err instanceof HttpError && err.details) {
                logData.details = err.details;
            }
            logger.error('Internal server error', logData);
        }
        else {
            logger.warn('HTTP error', {
                status,
                code: body.error.code,
                message: body.error.message,
            });
        }
    }
    return ctx.json(body, status);
};
//# sourceMappingURL=errors.js.map