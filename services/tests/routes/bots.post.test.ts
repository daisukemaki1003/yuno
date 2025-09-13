// Jest globals are available without import
import { app } from '@/index.js';
import type { MeetingBaasPort } from '@/clients/meetingbaas.client.port.js';
import { HttpError } from '@/utils/errors.js';

// Mock the Meeting BaaS service
const mockBaasClient: jest.Mocked<MeetingBaasPort> = {
  addBot: jest.fn(),
  leaveBot: jest.fn()
};

jest.unstable_mockModule('@/services/meetingbaas.service.js', () => ({
  getMeetingBaasForUser: jest.fn(() => mockBaasClient)
}));

jest.unstable_mockModule('@/services/ws-relay.service.js', () => ({
  getRelayStats: jest.fn(() => ({ activeSessions: 0, sessions: [] })),
  setupWebSocketRelay: jest.fn()
}));

describe('POST /v1/bots', () => {
  let getMeetingBaasForUser: jest.MockedFunction<any>;

  beforeEach(async () => {
    const meetingBaasModule = await import('@/services/meetingbaas.service.js');
    getMeetingBaasForUser = meetingBaasModule.getMeetingBaasForUser as jest.MockedFunction<any>;
    getMeetingBaasForUser.mockReturnValue(mockBaasClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
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