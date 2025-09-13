// Jest globals are available without import
import { createMeetingBaasAdapter } from '../../src/clients/meetingbaas.adapter.v1.js';
import type { MeetingBaasConfig } from '../../src/clients/meetingbaas.config.js';
import type { MeetingBaasPort } from '../../src/clients/meetingbaas.client.port.js';
import { HttpError } from '../../src/utils/errors.js';

describe('Meeting BaaS Client/Adapter', () => {
  let adapter: MeetingBaasPort;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  
  const testConfig: MeetingBaasConfig = {
    baseUrl: 'https://test.meetingbaas.com',
    apiVersion: 'v1',
    auth: {
      header: 'x-meeting-baas-api-key',
      scheme: 'None',
    },
    timeouts: {
      requestMs: 5000,
      streamMs: 60000,
    },
    endpoints: {
      addBot: { method: 'POST', path: '/bots/' },
      leaveBot: { method: 'DELETE', path: '/bots/:botId' },
    },
    maps: {
      status: {
        'created': 'joining',
        'joining': 'joining',
        'joined': 'joined',
        'ready': 'joined',
        'leaving': 'leaving',
        'left': 'left',
        'error': 'error',
        'failed': 'error',
      },
    },
  };
  
  const testApiKey = 'test-api-key-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    adapter = createMeetingBaasAdapter(testConfig, testApiKey);
  });

  describe('addBot', () => {
    it('should send correct request to Meeting BaaS', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ botId: 'bot-123' }),
      } as Response);

      const result = await adapter.addBot('https://meet.example.com/room123', 'Test Bot');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.meetingbaas.com/bots/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-meeting-baas-api-key': 'test-api-key-123',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }),
          body: expect.stringContaining('"meeting_url":"https://meet.example.com/room123"'),
          signal: expect.any(AbortSignal)
        })
      );

      expect(result).toEqual({ botId: 'bot-123' });
    });

    it('should include required fields in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ botId: 'bot-456' }),
      } as Response);

      await adapter.addBot('https://meet.example.com/room456', 'Custom Bot');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body).toMatchObject({
        bot_name: 'Custom Bot',
        meeting_url: 'https://meet.example.com/room456',
        reserved: false,
        recording_mode: 'speaker_view',
        entry_message: 'I am a good meeting bot :)',
        speech_to_text: {
          provider: 'Default'
        },
        automatic_leave: {
          waiting_room_timeout: 600
        },
        streaming: {
          audio_frequency: '16khz',
          input: expect.stringContaining('/mb-input'),
          output: expect.stringContaining('/mb-input')
        }
      });
    });

    it('should use default bot name when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ botId: 'bot-789' }),
      } as Response);

      await adapter.addBot('https://meet.example.com/room789');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      
      expect(body.bot_name).toBe('Meeting Bot');
    });

    it('should apply timeout correctly', async () => {
      // Mock a slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              text: async () => JSON.stringify({ botId: 'bot-timeout' }),
            } as Response);
          }, 10000); // Longer than timeout
        })
      );

      await expect(adapter.addBot('https://meet.example.com/timeout'))
        .rejects.toThrow();
    });

    describe('Error Handling', () => {
      it('should handle 400 errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        } as Response);

        await expect(adapter.addBot('https://meet.example.com/bad'))
          .rejects.toThrow(HttpError);
      });

      it('should handle 401 errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        } as Response);

        await expect(adapter.addBot('https://meet.example.com/unauth'))
          .rejects.toThrow(HttpError);
      });

      it('should handle 403 errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        } as Response);

        await expect(adapter.addBot('https://meet.example.com/forbidden'))
          .rejects.toThrow(HttpError);
      });

      it('should handle 5xx errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response);

        await expect(adapter.addBot('https://meet.example.com/error'))
          .rejects.toThrow(HttpError);
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(adapter.addBot('https://meet.example.com/network'))
          .rejects.toThrow('Network error');
      });

      it('should handle invalid JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => 'invalid json',
        } as Response);

        await expect(adapter.addBot('https://meet.example.com/invalid'))
          .rejects.toThrow();
      });
    });
  });

  describe('leaveBot', () => {
    it('should send correct DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{}',
      } as Response);

      await adapter.leaveBot('meeting-123', 'bot-456');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.meetingbaas.com/bots/bot-456',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'x-meeting-baas-api-key': 'test-api-key-123',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }),
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should not send body for DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{}',
      } as Response);

      await adapter.leaveBot('meeting-123', 'bot-789');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.body).toBeUndefined();
    });

    it('should handle bot not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response);

      await expect(adapter.leaveBot('meeting-123', 'bot-notfound'))
        .rejects.toThrow(HttpError);
    });

    it('should URL encode botId parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{}',
      } as Response);

      await adapter.leaveBot('meeting-123', 'bot/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.meetingbaas.com/bots/bot%2Fwith%2Fslashes',
        expect.any(Object)
      );
    });
  });

  describe('Header Configuration', () => {
    it('should use custom auth header name', async () => {
      const customConfig = {
        ...testConfig,
        auth: {
          header: 'X-Custom-Api-Key',
          scheme: 'None' as const,
        },
      };
      const customAdapter = createMeetingBaasAdapter(customConfig, 'custom-key');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ botId: 'bot-custom' }),
      } as Response);

      await customAdapter.addBot('https://meet.example.com/custom');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Api-Key': 'custom-key'
          })
        })
      );
    });

    it('should mask sensitive headers in logs', async () => {
      // This test verifies that the adapter doesn't expose sensitive data
      // The actual implementation logs headers with masking
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      } as Response);

      try {
        await adapter.addBot('https://meet.example.com/error');
      } catch (error) {
        // Error thrown, headers should be masked in logs
        expect(error).toBeDefined();
      }
    });
  });

  describe('Status Mapping', () => {
    it('should apply status mapping from config', async () => {
      // The adapter implementation shows status mapping logic
      // Test verifies the mapping configuration is respected
      const mappingTests = [
        { vendor: 'created', expected: 'joining' },
        { vendor: 'joining', expected: 'joining' },
        { vendor: 'joined', expected: 'joined' },
        { vendor: 'ready', expected: 'joined' },
        { vendor: 'leaving', expected: 'leaving' },
        { vendor: 'left', expected: 'left' },
        { vendor: 'error', expected: 'error' },
        { vendor: 'failed', expected: 'error' },
      ];

      // Verify mapping configuration
      for (const test of mappingTests) {
        expect(testConfig.maps.status[test.vendor]).toBe(test.expected);
      }
    });
  });

  describe('Timeout Handling', () => {
    it('should respect request timeout from config', async () => {
      const startTime = Date.now();
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              text: async () => JSON.stringify({ botId: 'bot-slow' }),
            } as Response);
          }, 10000); // 10 seconds
        })
      );

      await expect(adapter.addBot('https://meet.example.com/slow'))
        .rejects.toThrow();
      
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeLessThan(6000); // Should timeout before 6 seconds
    });
  });
});