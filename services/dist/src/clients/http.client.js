import { internal } from '@/utils/errors.js';
/**
 * Simple HTTP client with timeout and retry support
 */
export class HttpClient {
    logger;
    static SENSITIVE_HEADERS = [
        'authorization',
        'x-api-key',
        'api-key',
        'x-gladia-key',
        'x-auth-token',
        'cookie',
        'set-cookie'
    ];
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Mask sensitive headers for logging
     */
    maskHeaders(headers) {
        const masked = {};
        for (const [key, value] of Object.entries(headers)) {
            if (HttpClient.SENSITIVE_HEADERS.includes(key.toLowerCase())) {
                masked[key] = '***';
            }
            else {
                masked[key] = value;
            }
        }
        return masked;
    }
    /**
     * Fetch JSON from an endpoint
     * @param url - Full URL to fetch
     * @param options - Request options
     * @returns Parsed JSON response
     */
    async fetchJson(url, options) {
        const { method, headers = {}, body, timeoutMs = 30000, retryCount = 2 } = options;
        let lastError = null;
        for (let attempt = 0; attempt < retryCount; attempt++) {
            try {
                this.logger.debug('HTTP request', {
                    url,
                    method,
                    attempt,
                    headers: this.maskHeaders(headers)
                });
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMs);
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers,
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                const responseText = await response.text();
                if (!response.ok) {
                    // Log error response
                    this.logger.warn('HTTP error response', {
                        url,
                        status: response.status,
                        body: responseText,
                        headers: this.maskHeaders(headers)
                    });
                    // Retry on 5xx errors
                    if (response.status >= 500 && attempt < retryCount - 1) {
                        lastError = new Error(`HTTP ${response.status}: ${responseText}`);
                        await this.sleep(1000 * (attempt + 1)); // Exponential backoff
                        continue;
                    }
                    throw internal('HTTP_ERROR', `HTTP request failed: ${response.status}`, {
                        status: response.status,
                        body: responseText,
                        url,
                    });
                }
                // Parse JSON response
                try {
                    return JSON.parse(responseText);
                }
                catch (err) {
                    throw internal('PARSE_ERROR', 'Failed to parse JSON response', {
                        responseText,
                        url,
                    });
                }
            }
            catch (err) {
                if (err instanceof Error) {
                    if (err.name === 'AbortError') {
                        lastError = internal('TIMEOUT_ERROR', `Request timeout after ${timeoutMs}ms`, { url });
                    }
                    else {
                        lastError = err;
                    }
                    // Retry on network errors
                    if (attempt < retryCount - 1) {
                        this.logger.warn('HTTP request failed, retrying', {
                            url,
                            attempt,
                            error: err.message,
                            headers: this.maskHeaders(headers)
                        });
                        await this.sleep(1000 * (attempt + 1));
                        continue;
                    }
                }
                throw err;
            }
        }
        throw lastError || internal('HTTP_ERROR', 'All retry attempts failed');
    }
    /**
     * POST request helper
     */
    async post(url, body, options) {
        return this.fetchJson(url, {
            method: 'POST',
            body,
            ...options,
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=http.client.js.map