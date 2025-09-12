import { env } from '@/configs/env.js';
import type { BotStatus } from './meetingbaas.client.types.js';

/**
 * Meeting BaaS configuration type
 * This allows vendor-specific details to be configured externally
 */
export type MeetingBaasConfig = {
  /**
   * Base URL for the Meeting BaaS API
   */
  baseUrl: string;

  /**
   * API version (e.g., 'v1', '2025-09-01')
   */
  apiVersion?: string;

  /**
   * Authentication configuration
   */
  auth: {
    /**
     * Header name for authentication (e.g., 'Authorization', 'x-api-key')
     */
    header: string;
    
    /**
     * Authentication scheme
     */
    scheme?: 'Bearer' | 'ApiKey' | 'Basic' | 'None';
    
    /**
     * Query parameter name if auth is passed as query param
     */
    queryParam?: string;
  };

  /**
   * Timeout configurations
   */
  timeouts: {
    /**
     * Request timeout in milliseconds
     */
    requestMs: number;
    
    /**
     * Stream timeout in milliseconds
     */
    streamMs: number;
  };

  /**
   * Endpoint configurations
   */
  endpoints: {
    /**
     * Add bot endpoint
     */
    addBot: { method: 'POST'; path: string };
    
    /**
     * Leave bot endpoint
     */
    leaveBot: { method: 'POST' | 'DELETE'; path: string };
    
  };

  /**
   * Field mappings for normalization
   */
  maps: {
    /**
     * Map vendor status values to domain status
     */
    status: Record<string, BotStatus>;
    
    /**
     * Stream event field mappings (for normalized mode)
     */
    streamEvent?: {
      kindField?: string;      // e.g., 'type', 'event'
      dataField?: string;      // e.g., 'data', 'payload'
      audioField?: string;     // e.g., 'audio'
      textField?: string;      // e.g., 'text'
      tsField?: string;        // e.g., 'timestamp'
    };
  };
};

/**
 * Get Meeting BaaS configuration from environment
 * This function builds the configuration from env vars
 */
export function meetingBaasConfig(): MeetingBaasConfig {
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