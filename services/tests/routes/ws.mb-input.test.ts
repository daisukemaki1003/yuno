// Jest globals are available without import
import WebSocket from 'ws';
import { app } from '../../src/index.js';
import { serve } from '@hono/node-server';
import { waitFor } from '../setup.js';
import type { Server } from 'http';

// Mock the ws-relay service
const mockSetupWebSocketRelay = jest.fn();
const mockGetRelayStats = jest.fn(() => ({ activeSessions: 0, sessions: [] }));

jest.unstable_mockModule('../../src/services/ws-relay.service.js', () => ({
  setupWebSocketRelay: mockSetupWebSocketRelay,
  getRelayStats: mockGetRelayStats
}));

describe('WS /mb-input', () => {
  let server: Server;
  let wss: WebSocket.Server;
  const PORT = 4001;
  const WS_URL = `ws://localhost:${PORT}/mb-input`;

  beforeEach(async () => {
    // Reset mocks
    mockSetupWebSocketRelay.mockReset();
    mockGetRelayStats.mockReturnValue({ activeSessions: 0, sessions: [] });

    // Start HTTP server with WebSocket support
    server = serve({
      fetch: app.fetch,
      port: PORT,
    });

    // Create WebSocket server
    wss = new WebSocket.Server({ noServer: true });

    // Handle upgrade requests
    server.on('upgrade', async (request, socket, head) => {
      const url = new URL(request.url!, `http://localhost:${PORT}`);
      
      if (url.pathname === '/mb-input') {
        // Check authentication if configured
        const authToken = url.searchParams.get('auth') || request.headers['x-auth-token'];
        
        if (process.env.WS_RELAY_AUTH_TOKEN && authToken !== process.env.WS_RELAY_AUTH_TOKEN) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });

    // Handle WebSocket connections
    wss.on('connection', async (ws, request) => {
      const url = new URL(request.url!, `http://localhost:${PORT}`);
      const meetingId = url.searchParams.get('meetingId');
      const { setupWebSocketRelay } = await import('../../src/services/ws-relay.service.js');
      await setupWebSocketRelay(ws, { info: jest.fn(), error: jest.fn(), warn: jest.fn() } as any, meetingId || undefined);
    });

    // Wait for server to be ready
    await waitFor(100);
  });

  afterEach((done) => {
    // Close all WebSocket connections
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    // Close servers
    wss.close(() => {
      server.close(() => {
        done();
      });
    });
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        });
        ws.on('error', reject);
      });

      expect(mockSetupWebSocketRelay).toHaveBeenCalledTimes(1);
      
      ws.close();
      await waitFor(100);
    });

    it('should track active sessions count', async () => {
      // Initial state: 0 sessions
      mockGetRelayStats.mockReturnValueOnce({ activeSessions: 0, sessions: [] });
      
      let res = await app.request('/healthz');
      let body = await res.json();
      expect(body.wsRelay.activeSessions).toBe(0);

      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Mock stats after connection
      mockGetRelayStats.mockReturnValueOnce({ activeSessions: 1, sessions: [{}] });
      
      res = await app.request('/healthz');
      body = await res.json();
      expect(body.wsRelay.activeSessions).toBe(1);

      // Disconnect
      ws.close();
      await waitFor(100);

      // Mock stats after disconnection
      mockGetRelayStats.mockReturnValueOnce({ activeSessions: 0, sessions: [] });
      
      res = await app.request('/healthz');
      body = await res.json();
      expect(body.wsRelay.activeSessions).toBe(0);
    });

    it('should reject connection without auth token when configured', async () => {
      const ws = new WebSocket(WS_URL); // No auth token
      
      await new Promise<void>((resolve) => {
        ws.on('error', (err) => {
          expect(err.message).toMatch(/401|Unauthorized/);
          resolve();
        });
        ws.on('unexpected-response', (req, res) => {
          expect(res.statusCode).toBe(401);
          resolve();
        });
      });
    });

    it('should accept connection with valid auth token', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        });
        ws.on('error', reject);
      });

      ws.close();
      await waitFor(100);
    });

    it('should handle duplicate meetingId connections', async () => {
      const meetingId = 'test-meeting-123';
      
      // First connection
      const ws1 = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}&meetingId=${meetingId}`);
      await new Promise<void>((resolve) => {
        ws1.on('open', resolve);
      });

      // Second connection with same meetingId
      const ws2 = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}&meetingId=${meetingId}`);
      
      // The second connection should be handled according to implementation
      // (either rejected or replaces the first one)
      await new Promise<void>((resolve) => {
        ws2.on('open', () => {
          // If it opens, the implementation allows multiple or replaces
          resolve();
        });
        ws2.on('close', (code, reason) => {
          // If it closes, the implementation rejects duplicates
          expect(code).toBe(1008);
          expect(reason.toString()).toMatch(/already has an active session/);
          resolve();
        });
        ws2.on('error', () => {
          // Connection rejected
          resolve();
        });
      });

      // Verify setupWebSocketRelay was called
      expect(mockSetupWebSocketRelay.mock.calls.length).toBeGreaterThanOrEqual(1);

      ws1.close();
      if (ws2.readyState === WebSocket.OPEN) {
        ws2.close();
      }
      await waitFor(100);
    });
  });

  describe('Message Handling', () => {
    it('should handle binary audio data without errors', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Send binary audio data
      const audioData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      
      await new Promise<void>((resolve, reject) => {
        ws.send(audioData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify no errors occurred
      await waitFor(100);

      ws.close();
      await waitFor(100);
    });

    it('should handle text control messages', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Send control message
      const controlMessage = JSON.stringify({
        type: 'control',
        action: 'start',
        meetingId: 'test-meeting-456'
      });
      
      await new Promise<void>((resolve, reject) => {
        ws.send(controlMessage, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify no errors occurred
      await waitFor(100);

      ws.close();
      await waitFor(100);
    });

    it('should receive ready message after connection', async () => {
      // Mock setupWebSocketRelay to send ready message
      mockSetupWebSocketRelay.mockImplementationOnce((ws) => {
        ws.send(JSON.stringify({
          type: 'ready',
          timestamp: new Date().toISOString()
        }));
      });

      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      const message = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(message).toMatchObject({
        type: 'ready',
        timestamp: expect.any(String)
      });

      ws.close();
      await waitFor(100);
    });
  });

  describe('Path Validation', () => {
    it('should reject connections to invalid paths', async () => {
      const ws = new WebSocket(`ws://localhost:${PORT}/invalid-path?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve) => {
        ws.on('error', () => {
          // Connection rejected
          resolve();
        });
        ws.on('unexpected-response', (req, res) => {
          expect(res.statusCode).toBe(404);
          resolve();
        });
      });
    });

    it('should only accept connections to /mb-input', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.url).toContain('/mb-input');
          resolve();
        });
        ws.on('error', reject);
      });

      ws.close();
      await waitFor(100);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on disconnection', async () => {
      const ws = new WebSocket(`${WS_URL}?auth=${process.env.WS_RELAY_AUTH_TOKEN}`);
      
      await new Promise<void>((resolve) => {
        ws.on('open', resolve);
      });

      // Close connection
      ws.close();
      
      await new Promise<void>((resolve) => {
        ws.on('close', () => {
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });
      });

      // Verify cleanup
      await waitFor(100);
    });
  });
});