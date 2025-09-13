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

describe('DELETE /v1/bots/:botId', () => {
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
      const res = await app.request('/v1/bots/bot-123?userId=user123', {
        method: 'DELETE',
        headers: {
          'x-meeting-baas-api-key': 'test-key'
        }
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
      const res = await app.request('/v1/bots/bot-123?userId=user123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'InvalidScheme token',
          'x-meeting-baas-api-key': 'test-key'
        }
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
      const res = await app.request('/v1/bots/bot-123?userId=user123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
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
      'x-meeting-baas-api-key': 'test-key'
    };

    it('should return 400 when userId query parameter is missing', async () => {
      const res = await app.request('/v1/bots/bot-123', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_ARGUMENT');
    });

    it('should validate botId parameter format', async () => {
      mockBaasClient.leaveBot.mockResolvedValueOnce(undefined);

      const res = await app.request('/v1/bots/bot-456?userId=user123', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(204);
      expect(mockBaasClient.leaveBot).toHaveBeenCalledWith('', 'bot-456');
    });
  });

  describe('Meeting BaaS Integration', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'x-meeting-baas-api-key': 'test-api-key'
    };

    it('should successfully delete bot and return 204', async () => {
      mockBaasClient.leaveBot.mockResolvedValueOnce(undefined);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(204);
      expect(res.body).toBe(null);

      expect(getMeetingBaasForUser).toHaveBeenCalledWith('user456', 'test-api-key');
      expect(mockBaasClient.leaveBot).toHaveBeenCalledWith('', 'bot-123');
    });

    it('should handle Meeting BaaS 401 error', async () => {
      const error = new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
      mockBaasClient.leaveBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to remove bot from meeting'
        }
      });
    });

    it('should handle Meeting BaaS 403 error', async () => {
      const error = new HttpError(403, 'FORBIDDEN', 'Access denied');
      mockBaasClient.leaveBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to remove bot from meeting'
        }
      });
    });

    it('should handle Meeting BaaS 5xx error', async () => {
      const error = new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');
      mockBaasClient.leaveBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to remove bot from meeting'
        }
      });
    });

    it('should handle bot not found error', async () => {
      const error = new Error('Bot not found');
      mockBaasClient.leaveBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: {
          code: 'BOT_NOT_FOUND',
          message: 'Bot not found'
        }
      });
    });
  });

  describe('Parameter Handling', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'x-meeting-baas-api-key': 'test-api-key'
    };

    it('should correctly extract botId from URL parameter', async () => {
      mockBaasClient.leaveBot.mockResolvedValueOnce(undefined);

      const testBotIds = ['bot-123', 'bot_456', 'bot.789', '12345'];

      for (const botId of testBotIds) {
        const res = await app.request(`/v1/bots/${botId}?userId=user123`, {
          method: 'DELETE',
          headers: validHeaders
        });

        expect(res.status).toBe(204);
        expect(mockBaasClient.leaveBot).toHaveBeenCalledWith('', botId);
      }
    });

    it('should correctly extract userId from query parameter', async () => {
      mockBaasClient.leaveBot.mockResolvedValueOnce(undefined);

      const testUserIds = ['user123', 'user_456', 'user.789@example.com'];

      for (const userId of testUserIds) {
        const res = await app.request(`/v1/bots/bot-123?userId=${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: validHeaders
        });

        expect(res.status).toBe(204);
        expect(getMeetingBaasForUser).toHaveBeenCalledWith(userId, 'test-api-key');
      }
    });
  });

  describe('Error Response Format', () => {
    const validHeaders = {
      'Authorization': 'Bearer test-token',
      'x-meeting-baas-api-key': 'test-api-key'
    };

    it('should return standardized error response format', async () => {
      const error = new Error('Unexpected error');
      mockBaasClient.leaveBot.mockRejectedValueOnce(error);

      const res = await app.request('/v1/bots/bot-123?userId=user456', {
        method: 'DELETE',
        headers: validHeaders
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error.code).toBe('UPSTREAM_ERROR');
      expect(body.error.message).toBe('Failed to remove bot from meeting');
    });
  });
});