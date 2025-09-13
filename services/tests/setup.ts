import { jest, beforeAll, afterAll } from '@jest/globals';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MEETING_BAAS_BASE_URL = 'https://test.meetingbaas.com';
process.env.MEETING_BAAS_TIMEOUT_REQUEST_MS = '5000';
process.env.STREAM_RECONNECT_BASE_MS = '1000';
process.env.STREAM_BACKPRESSURE_MAX_BUFFER = '1048576'; // 1MB
process.env.PUBLIC_WS_BASE = 'wss://test.api.com';
process.env.GLADIA_API_KEY = 'test-gladia-key';
process.env.WS_RELAY_AUTH_TOKEN = 'test-auth-token';
process.env.PROJECT_ID = 'test-project';
process.env.REGION = 'test-region';

// Global test directory for temporary files
export const TEST_DIR = join(process.cwd(), '.test-tmp');

// Setup before all tests
beforeAll(() => {
  // Create test directory
  mkdirSync(TEST_DIR, { recursive: true });
  
  // Mock console methods to reduce noise during tests
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.debug = jest.fn();
  
  // Keep error and warn for debugging
  const originalError = console.error;
  const originalWarn = console.warn;
  
  global.console.error = jest.fn((...args: any[]) => {
    // Only log actual errors, not expected ones
    if (!args[0]?.toString().includes('Expected')) {
      originalError(...args);
    }
  });
  
  global.console.warn = jest.fn((...args: any[]) => {
    // Only log actual warnings
    originalWarn(...args);
  });
});

// Cleanup after all tests
afterAll(() => {
  // Clean up test directory
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Mock fetch globally
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('{}'),
    headers: new Headers(),
  } as Response)
) as jest.Mock;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }
  
  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }
  
  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }
}

(global as any).WebSocket = MockWebSocket;

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create mock request
export const createMockRequest = (options: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
} = {}) => {
  const url = new URL(`http://localhost:3000${options.path || '/'}`);
  
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return {
    method: options.method || 'GET',
    url: url.toString(),
    headers: new Headers(options.headers || {}),
    body: options.body ? JSON.stringify(options.body) : undefined,
    params: options.params || {},
  };
};

// Helper to suppress console output during a test
export const suppressConsole = () => {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

// Jest is available globally in test files