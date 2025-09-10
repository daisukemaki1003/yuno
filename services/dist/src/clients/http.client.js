import { internal } from '@/utils/errors.js';
/**
 * Simple HTTP client with timeout and retry support
 */
export class HttpClient {
    logger;
    constructor(logger) {
        this.logger = logger;
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
                this.logger.debug('HTTP request', { url, method, attempt });
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
     * Open a Server-Sent Events stream
     * @param url - Full URL for SSE endpoint
     * @param headers - Request headers
     * @param timeoutMs - Stream timeout
     * @returns EventSource-like interface
     */
    async openSse(url, headers, timeoutMs) {
        this.logger.debug('Opening SSE stream', { url });
        const controller = new AbortController();
        const timeout = timeoutMs
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/event-stream',
                ...headers,
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            if (timeout)
                clearTimeout(timeout);
            throw internal('SSE_ERROR', `SSE connection failed: ${response.status}`, {
                status: response.status,
                url,
            });
        }
        if (!response.body) {
            if (timeout)
                clearTimeout(timeout);
            throw internal('SSE_ERROR', 'No response body for SSE stream');
        }
        return new SseStream(response.body, controller, timeout);
    }
    /**
     * Open a WebSocket connection
     * @param url - WebSocket URL (ws:// or wss://)
     * @param headers - Request headers
     * @returns WebSocket wrapper
     */
    async openWebSocket(url, headers) {
        this.logger.debug('Opening WebSocket', { url });
        // Node.js built-in WebSocket support (Node 21+)
        // For older versions, you might need to install 'ws' package
        const ws = new WebSocket(url, {
            headers,
        });
        return new WsStream(ws);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * SSE stream wrapper
 */
export class SseStream {
    reader;
    decoder = new TextDecoder();
    buffer = '';
    controller;
    timeout;
    handlers = { data: [], error: [], close: [] };
    constructor(stream, controller, timeout) {
        this.reader = stream.getReader();
        this.controller = controller;
        this.timeout = timeout;
        this.processStream();
    }
    on(event, handler) {
        if (event === 'data' || event === 'error' || event === 'close') {
            this.handlers[event].push(handler);
        }
    }
    close() {
        this.controller.abort();
        if (this.timeout)
            clearTimeout(this.timeout);
        this.handlers.close.forEach(h => h());
    }
    async processStream() {
        try {
            while (true) {
                const { done, value } = await this.reader.read();
                if (done)
                    break;
                const text = this.decoder.decode(value, { stream: true });
                this.buffer += text;
                // Process complete SSE messages
                const lines = this.buffer.split('\n');
                this.buffer = lines[lines.length - 1];
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        this.handlers.data.forEach(h => h(data));
                    }
                }
            }
        }
        catch (err) {
            if (err instanceof Error) {
                this.handlers.error.forEach(h => h(err));
            }
        }
        finally {
            this.close();
        }
    }
}
/**
 * WebSocket stream wrapper
 */
export class WsStream {
    ws;
    handlers = { data: [], error: [], close: [] };
    constructor(ws) {
        this.ws = ws;
        ws.onmessage = (event) => {
            const data = typeof event.data === 'string'
                ? event.data
                : JSON.stringify(event.data);
            this.handlers.data.forEach(h => h(data));
        };
        ws.onerror = (event) => {
            const error = new Error('WebSocket error');
            this.handlers.error.forEach(h => h(error));
        };
        ws.onclose = () => {
            this.handlers.close.forEach(h => h());
        };
    }
    on(event, handler) {
        if (event === 'data' || event === 'error' || event === 'close') {
            this.handlers[event].push(handler);
        }
    }
    close() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }
    async waitForOpen() {
        if (this.ws.readyState === WebSocket.OPEN)
            return;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 30000);
            this.ws.onopen = () => {
                clearTimeout(timeout);
                resolve();
            };
            this.ws.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket connection failed'));
            };
        });
    }
}
//# sourceMappingURL=http.client.js.map