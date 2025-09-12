import { Logger } from '@/utils/logger.js';
import { internal } from '@/utils/errors.js';

/**
 * HTTP client options
 */
export interface HttpOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retryCount?: number;
}

/**
 * Simple HTTP client with timeout and retry support
 */
export class HttpClient {
  private logger: Logger;
  private static readonly SENSITIVE_HEADERS = [
    'authorization',
    'x-api-key',
    'api-key',
    'x-gladia-key',
    'x-auth-token',
    'cookie',
    'set-cookie'
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Mask sensitive headers for logging
   */
  private maskHeaders(headers: Record<string, string>): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (HttpClient.SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        masked[key] = '***';
      } else {
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
  async fetchJson<T = unknown>(
    url: string,
    options: HttpOptions
  ): Promise<T> {
    const { method, headers = {}, body, timeoutMs = 30000, retryCount = 2 } = options;

    let lastError: Error | null = null;
    
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

          throw internal(
            'HTTP_ERROR',
            `HTTP request failed: ${response.status}`,
            {
              status: response.status,
              body: responseText,
              url,
            }
          );
        }

        // Parse JSON response
        try {
          return JSON.parse(responseText) as T;
        } catch (err) {
          throw internal('PARSE_ERROR', 'Failed to parse JSON response', {
            responseText,
            url,
          });
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            lastError = internal('TIMEOUT_ERROR', `Request timeout after ${timeoutMs}ms`, { url });
          } else {
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
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: { headers?: Record<string, string>; timeoutMs?: number; retryCount?: number }
  ): Promise<T> {
    return this.fetchJson<T>(url, {
      method: 'POST',
      body,
      ...options,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

