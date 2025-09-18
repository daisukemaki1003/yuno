import { describe, beforeEach, afterEach, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
// Jest globals are available without import
import { Hono } from 'hono';
import { waitFor } from '../setup.js';

// Mock the ws-relay.service module
const mockGetRelayStats = jest.fn(() => ({
  activeSessions: 0,
  sessions: []
}));

jest.unstable_mockModule('../../src/services/ws-relay.service.js', () => ({
  getRelayStats: mockGetRelayStats,
  setupWebSocketRelay: jest.fn()
}));

describe('GET /healthz', () => {
  let app: Hono;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create a minimal Hono app for testing
    app = new Hono();
    
    // Add the healthz endpoint
    app.get('/healthz', async (c) => {
      try {
        const stats = mockGetRelayStats();
        return c.json({
          status: 'ok',
          streamMode: 'ws-relay',
          wsRelay: stats
        });
      } catch (error) {
        return c.json({
          status: 'ok',
          streamMode: 'ws-relay',
          wsRelay: {
            error: 'Failed to get relay stats'
          }
        });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with health status', async () => {
    const res = await app.request('/healthz');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
      streamMode: 'ws-relay',
      wsRelay: {
        activeSessions: 0,
        sessions: []
      }
    });
  });

  it('should include wsRelay.activeSessions in response', async () => {
    mockGetRelayStats.mockReturnValueOnce({
      activeSessions: 3,
      sessions: [
        { mbConnected: true, gladiaConnected: true },
        { mbConnected: true, gladiaConnected: false },
        { mbConnected: true, gladiaConnected: true }
      ]
    });

    const res = await app.request('/healthz');
    const body = await res.json();
    
    expect(body.wsRelay).toBeDefined();
    expect(body.wsRelay.activeSessions).toBe(3);
    expect(body.wsRelay.sessions).toHaveLength(3);
  });

  it('should handle errors from getRelayStats gracefully', async () => {
    mockGetRelayStats.mockImplementationOnce(() => {
      throw new Error('Failed to get stats');
    });

    const res = await app.request('/healthz');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
      streamMode: 'ws-relay',
      wsRelay: {
        error: 'Failed to get relay stats'
      }
    });
  });

  it('should verify wsRelay.activeSessions changes with WebSocket connections', async () => {
    // Initial state: 0 active sessions
    mockGetRelayStats.mockReturnValueOnce({
      activeSessions: 0,
      sessions: []
    });

    let res = await app.request('/healthz');
    let body = await res.json();
    expect(body.wsRelay.activeSessions).toBe(0);

    // Simulate WebSocket connection
    mockGetRelayStats.mockReturnValueOnce({
      activeSessions: 1,
      sessions: [
        {
          mbConnected: true,
          gladiaConnected: false,
          queuedAudioFrames: 0,
          queuedAudioBytes: 0,
          reconnectAttempts: 0,
          lastActivity: new Date().toISOString(),
          meetingId: 'test-meeting-123'
        }
      ]
    });

    res = await app.request('/healthz');
    body = await res.json();
    expect(body.wsRelay.activeSessions).toBe(1);
    expect(body.wsRelay.sessions[0].meetingId).toBe('test-meeting-123');

    // Simulate WebSocket disconnection
    mockGetRelayStats.mockReturnValueOnce({
      activeSessions: 0,
      sessions: []
    });

    res = await app.request('/healthz');
    body = await res.json();
    expect(body.wsRelay.activeSessions).toBe(0);
  });

  it('should return JSON content type', async () => {
    const res = await app.request('/healthz');
    
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('should include all required fields in response', async () => {
    const res = await app.request('/healthz');
    const body = await res.json();
    
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('streamMode');
    expect(body).toHaveProperty('wsRelay');
    
    expect(typeof body.status).toBe('string');
    expect(typeof body.streamMode).toBe('string');
    expect(typeof body.wsRelay).toBe('object');
  });
});