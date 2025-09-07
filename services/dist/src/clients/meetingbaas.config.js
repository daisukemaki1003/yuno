import { env } from '@/configs/env.js';
/**
 * Get Meeting BaaS configuration from environment
 * This function builds the configuration from env vars
 */
export function meetingBaasConfig() {
    const authHeader = env.MEETING_BAAS_AUTH_HEADER || 'Authorization';
    const authScheme = env.MEETING_BAAS_AUTH_SCHEME || 'Bearer';
    const apiVersion = env.MEETING_BAAS_API_VERSION || 'v1';
    const streamProtocol = env.MEETING_BAAS_STREAM_PROTOCOL || 'sse';
    return {
        baseUrl: env.MEETING_BAAS_BASE_URL,
        apiVersion,
        auth: {
            header: authHeader,
            scheme: authScheme,
            // queryParam: env.MEETING_BAAS_AUTH_QUERY_PARAM, // Uncomment if needed
        },
        timeouts: {
            requestMs: env.MEETING_BAAS_TIMEOUT_REQUEST_MS || 15000,
            streamMs: env.MEETING_BAAS_TIMEOUT_STREAM_MS || 600000,
        },
        endpoints: {
            addBot: {
                method: 'POST',
                path: `/${apiVersion}/bots`, // Default path, vendor may differ
            },
            leaveBot: {
                method: 'POST',
                path: `/${apiVersion}/bots/:botId/leave`, // :botId will be replaced
            },
            botStatus: {
                method: 'GET',
                path: `/${apiVersion}/bots/:botId`,
            },
            stream: {
                protocol: streamProtocol,
                path: `/${apiVersion}/meetings/:meetingId/recording`,
            },
        },
        maps: {
            // Default vendor status mapping (adjust per vendor)
            status: {
                'JOINING': 'joining',
                'ACTIVE': 'joined',
                'CONNECTED': 'joined',
                'LEAVING': 'leaving',
                'DISCONNECTED': 'left',
                'LEFT': 'left',
                'ERROR': 'error',
                'FAILED': 'error',
            },
            // Stream event field mappings (adjust per vendor)
            streamEvent: {
                kindField: 'type',
                dataField: 'data',
                audioField: 'audio',
                textField: 'text',
                tsField: 'timestamp',
            },
        },
    };
}
//# sourceMappingURL=meetingbaas.config.js.map