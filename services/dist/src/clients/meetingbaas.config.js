import { env } from '@/configs/env.js';
/**
 * Get Meeting BaaS configuration from environment
 * This function builds the configuration from env vars
 */
export function meetingBaasConfig() {
    return {
        baseUrl: env.MEETING_BAAS_BASE_URL,
        apiVersion: 'v1',
        auth: {
            header: 'Authorization',
            scheme: 'Bearer',
        },
        timeouts: {
            requestMs: env.MEETING_BAAS_TIMEOUT_REQUEST_MS || 15000,
            streamMs: env.MEETING_BAAS_TIMEOUT_STREAM_MS || 600000,
        },
        endpoints: {
            addBot: {
                method: 'POST',
                path: `/bots/`, // Meeting BaaS actual path
            },
            leaveBot: {
                method: 'DELETE',
                path: `/bots/:botId`, // DELETE /bots/{id}
            },
        },
        maps: {
            // Meeting BaaS status mapping
            status: {
                'created': 'joining',
                'joining': 'joining',
                'joined': 'joined',
                'ready': 'joined',
                'leaving': 'leaving',
                'left': 'left',
                'error': 'error',
                'failed': 'error',
                'unknown': 'error',
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