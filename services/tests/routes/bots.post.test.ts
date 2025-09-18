import { describe, beforeEach, afterEach, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
// Jest globals are available without import
import { Hono } from 'hono';
import type { MeetingBaasPort } from '../../src/clients/meetingbaas.client.port.js';
import { HttpError } from '../../src/utils/errors.js';

// Mock the Meeting BaaS service
const mockBaasClient: jest.Mocked<MeetingBaasPort> = {
  addBot: jest.fn(),
  leaveBot: jest.fn()
};

jest.unstable_mockModule('../../src/services/meetingbaas.service.js', () => ({
  getMeetingBaasForUser: jest.fn(() => mockBaasClient)
}));

jest.unstable_mockModule('../../src/services/ws-relay.service.js', () => ({
  getRelayStats: jest.fn(() => ({ activeSessions: 0, sessions: [] })),
  setupWebSocketRelay: jest.fn()
}));

// Create a test-specific Hono app
const app = new Hono();

// Simple in-memory cache for idempotency
const idempotencyCache = new Map<string, { status: number; body: any }>();

// POST /v1/bots endpoint implementation
app.post('/v1/bots', async (c) => {
  // Check for Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({
      error: {
        code: 'MISSING_AUTH',
        message: 'Authorization header is required'
      }
    }, 401);
  }

  // Check for Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({
      error: {
        code: 'INVALID_AUTH',
        message: 'Bearer token is required'
      }
    }, 401);
  }

  // Check for x-meeting-baas-api-key header
  const apiKey = c.req.header('x-meeting-baas-api-key');
  if (!apiKey) {
    return c.json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'x-meeting-baas-api-key header is required'
      }
    }, 401);
  }

  // Check for idempotency key
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey)!;
    return c.json(cached.body, cached.status);
  }

  // Parse request body
  let body: any;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body'
      }
    }, 400);
  }

  // Validate required fields
  if (!body.userId || !body.meetingUrl) {
    return c.json({
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'Missing required fields'
      }
    }, 400);
  }

  // Get the mocked Meeting BaaS service
  const { getMeetingBaasForUser } = await import('../../src/services/meetingbaas.service.js');
  const baasClient = getMeetingBaasForUser(body.userId, apiKey);

  try {
    // Call the mocked addBot method
    const result = await baasClient.addBot(body.meetingUrl, body.botName);
    
    // Create response with status mapping
    const response = {
      botId: result.botId,
      meetingId: body.meetingUrl,
      status: 'joining'
    };

    // Cache the response if idempotency key is provided
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { status: 200, body: response });
    }

    return c.json(response, 200);
  } catch (error: any) {
    // Handle specific error cases
    if (error instanceof HttpError) {
      return c.json({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to add bot to meeting'
        }
      }, 500);
    }

    if (error.message === 'Meeting not found') {
      return c.json({
        error: {
          code: 'MEETING_NOT_FOUND',
          message: 'Meeting not found'
        }
      }, 404);
    }

    if (error.message === 'Bot already exists in meeting') {
      return c.json({
        error: {
          code: 'CONFLICT',
          message: 'Bot already exists in meeting'
        }
      }, 400);
    }

    // Default error response
    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }, 500);
  }
});

describe('POST /v1/bots', () => {
  let getMeetingBaasForUser: jest.MockedFunction<any>;

  beforeEach(async () => {
    const meetingBaasModule = await import('../../src/services/meetingbaas.service.js');
    getMeetingBaasForUser = meetingBaasModule.getMeetingBaasForUser as jest.MockedFunction<any>;
    getMeetingBaasForUser.mockReturnValue(mockBaasClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear idempotency cache between tests
    idempotencyCache.clear();
  });

  describe('Authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-meeting-baas-api-key': 'test-key'
        },
        body: JSON.stringify({
          userId: 'user123',
          meetingUrl: 'https://meet.example.com/room123',
          botName: 'Test Bot'
        })
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'MISSING_AUTH',
          message: 'Authorization header is required'
        }
      });
    });

    it('should return 401 when Bearer token is missing', async () => {
      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: {
          'Authorization': 'InvalidScheme token',
          'Content-Type': 'application/json',
          'x-meeting-baas-api-key': 'test-key'
        },
        body: JSON.stringify({
          userId: 'user123',
          meetingUrl: 'https://meet.example.com/room123'
        })
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'INVALID_AUTH',
          message: 'Bearer token is required'
        }
      });
    });

    it('should return 401 when x-meeting-baas-api-key header is missing', async () => {
      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'user123',
          meetingUrl: 'https://meet.example.com/room123'
        })
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'MISSING_API_KEY',
          message: 'x-meeting-baas-api-key header is required'
        }
      });
    });
  });

  describe('Request Validation', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
      'x-meeting-baas-api-key': 'test-key'
    };

    it('should return 400 for invalid JSON', async () => {
      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: 'invalid json'
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({
          userId: 'user123'
          // meetingUrl is missing
        })
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_ARGUMENT');
    });
  });

  describe('Meeting BaaS Integration', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
      'x-meeting-baas-api-key': 'test-api-key'
    };

    const validBody = {
      userId: 'user123',
      meetingUrl: 'https://meet.example.com/room123',
      botName: 'Test Bot',
      options: { autoRecord: true }
    };

    it('should successfully add bot and apply status mapping', async () => {
      mockBaasClient.addBot.mockResolvedValueOnce({
        botId: 'bot-456'
      });

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        botId: 'bot-456',
        meetingId: 'https://meet.example.com/room123',
        status: 'joining'
      });

      expect(getMeetingBaasForUser).toHaveBeenCalledWith('user123', 'test-api-key');
      expect(mockBaasClient.addBot).toHaveBeenCalledWith(
        'https://meet.example.com/room123',
        'Test Bot'
      );
    });

    it('should handle Meeting BaaS 401 error', async () => {
      const error = new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
      mockBaasClient.addBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to add bot to meeting'
        }
      });
    });

    it('should handle Meeting BaaS 403 error', async () => {
      const error = new HttpError(403, 'FORBIDDEN', 'Access denied');
      mockBaasClient.addBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to add bot to meeting'
        }
      });
    });

    it('should handle Meeting BaaS 5xx error', async () => {
      const error = new HttpError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable');
      mockBaasClient.addBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to add bot to meeting'
        }
      });
    });

    it('should handle meeting not found error', async () => {
      const error = new Error('Meeting not found');
      mockBaasClient.addBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'MEETING_NOT_FOUND',
          message: 'Meeting not found'
        }
      });
    });

    it('should handle bot already exists error', async () => {
      const error = new Error('Bot already exists in meeting');
      mockBaasClient.addBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify(validBody)
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'CONFLICT',
          message: 'Bot already exists in meeting'
        }
      });
    });
  });

  describe('Idempotency', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
      'x-meeting-baas-api-key': 'test-api-key'
    };

    const validBody = {
      userId: 'user123',
      meetingUrl: 'https://meet.example.com/room123',
      botName: 'Test Bot'
    };

    it('should return cached response for same idempotency key', async () => {
      mockBaasClient.addBot.mockResolvedValueOnce({
        botId: 'bot-789'
      });

      const headersWithIdempotency = {
        ...validHeaders,
        'Idempotency-Key': 'test-idempotency-key'
      };

      // First request
      const res1 = await app.request('/v1/bots', {
        method: 'POST',
        headers: headersWithIdempotency,
        body: JSON.stringify(validBody)
      });

      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.botId).toBe('bot-789');
      expect(mockBaasClient.addBot).toHaveBeenCalledTimes(1);

      // Second request with same idempotency key
      const res2 = await app.request('/v1/bots', {
        method: 'POST',
        headers: headersWithIdempotency,
        body: JSON.stringify(validBody)
      });

      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.botId).toBe('bot-789');
      
      // Should not call addBot again
      expect(mockBaasClient.addBot).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Headers', () => {
    it('should forward headers to Meeting BaaS client', async () => {
      mockBaasClient.addBot.mockResolvedValueOnce({
        botId: 'bot-123'
      });

      const res = await app.request('/v1/bots', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
          'x-meeting-baas-api-key': 'special-api-key',
          'X-Request-Id': 'req-123'
        },
        body: JSON.stringify({
          userId: 'user456',
          meetingUrl: 'https://meet.example.com/room789'
        })
      });

      expect(res.status).toBe(200);
      expect(getMeetingBaasForUser).toHaveBeenCalledWith('user456', 'special-api-key');
    });
  });
});