import { createMeetingBaasAdapter } from '@/clients/meetingbaas.adapter.v1.js';
// Mock fetch globally
global.fetch = jest.fn();
global.WebSocket = jest.fn();
describe('MeetingBaasAdapterV1', () => {
    let adapter;
    let mockFetch;
    const testConfig = {
        baseUrl: 'https://api.test.com',
        apiVersion: 'v1',
        auth: {
            header: 'Authorization',
            scheme: 'Bearer',
        },
        timeouts: {
            requestMs: 5000,
            streamMs: 60000,
        },
        endpoints: {
            addBot: { method: 'POST', path: '/v1/bots' },
            leaveBot: { method: 'POST', path: '/v1/bots/:botId/leave' },
        },
        maps: {
            status: {
                'JOINING': 'joining',
                'ACTIVE': 'joined',
                'LEAVING': 'leaving',
                'DISCONNECTED': 'left',
                'ERROR': 'error',
            },
        },
    };
    const testApiKey = 'test-api-key';
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = global.fetch;
        adapter = createMeetingBaasAdapter(testConfig, testApiKey);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('addBot', () => {
        test('should add bot with correct request and normalize response', async () => {
            // Mock vendor response with different field name
            const vendorResponse = { id: 'bot-123', created_at: '2025-01-01' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(vendorResponse),
            });
            const result = await adapter.addBot('meeting-456');
            // Check request
            expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/v1/bots', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-api-key',
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({ meetingId: 'meeting-456' }),
            }));
            // Check normalized response
            expect(result).toEqual({ botId: 'bot-123' });
        });
        test('should handle different bot ID field names', async () => {
            // Test with different vendor field names
            const testCases = [
                { botId: 'bot-1' },
                { bot_id: 'bot-2' },
                { id: 'bot-3' },
            ];
            for (const vendorResponse of testCases) {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    text: async () => JSON.stringify(vendorResponse),
                });
                const result = await adapter.addBot('meeting-test');
                expect(result.botId).toMatch(/^bot-\d$/);
            }
        });
        test('should handle API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => 'Bad Request',
            });
            await expect(adapter.addBot('meeting-456')).rejects.toThrow();
        });
    });
    describe('leaveBot', () => {
        test('should send leave request with correct parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => '{}',
            });
            await adapter.leaveBot('meeting-456', 'bot-123');
            expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/v1/bots/bot-123/leave', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ meetingId: 'meeting-456' }),
            }));
        });
    });
    describe('configuration flexibility', () => {
        test('should support different auth schemes', async () => {
            const configs = [
                { scheme: 'ApiKey', expected: 'ApiKey test-api-key' },
                { scheme: 'Basic', expected: 'Basic test-api-key' },
                { scheme: 'None', expected: 'test-api-key' },
            ];
            for (const { scheme, expected } of configs) {
                const customConfig = {
                    ...testConfig,
                    auth: { ...testConfig.auth, scheme },
                };
                const customAdapter = createMeetingBaasAdapter(customConfig, testApiKey);
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    text: async () => JSON.stringify({ id: 'bot-123' }),
                });
                await customAdapter.addBot('meeting-456');
                expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': expected,
                    }),
                }));
            }
        });
        test('should support query param auth', async () => {
            const customConfig = {
                ...testConfig,
                auth: {
                    header: 'x-api-key',
                    queryParam: 'apikey',
                },
            };
            const customAdapter = createMeetingBaasAdapter(customConfig, testApiKey);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ id: 'bot-123' }),
            });
            await customAdapter.addBot('meeting-456');
            const calledUrl = mockFetch.mock.calls[0][0];
            expect(calledUrl).toContain('apikey=test-api-key');
            const calledOptions = mockFetch.mock.calls[0][1];
            expect(calledOptions.headers).not.toHaveProperty('x-api-key');
        });
    });
    describe('configuration', () => {
        test('should support different status mappings', async () => {
            const customConfig = {
                ...testConfig,
                maps: {
                    status: {
                        'PENDING': 'joining',
                        'CONNECTED': 'joined',
                        'TERMINATING': 'leaving',
                        'TERMINATED': 'left',
                        'FAILED': 'error',
                    },
                },
            };
            const customAdapter = createMeetingBaasAdapter(customConfig, testApiKey);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ bot_id: 'bot-123' }),
            });
            const result = await customAdapter.addBot('test-meeting');
            expect(result).toEqual({ botId: 'bot-123' });
        });
    });
});
//# sourceMappingURL=meetingbaas.adapter.v1.test.js.map