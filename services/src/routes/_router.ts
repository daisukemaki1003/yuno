import { Hono } from 'hono';
import { env } from '@/configs/env.js';

/**
 * Main router for aggregating all routes
 * Future routes like /bots will be mounted here
 */
export const router = new Hono();

// Health check endpoint
router.get('/healthz', async (c) => {
  const health: any = {
    status: 'ok',
    streamMode: env.MEETING_BAAS_STREAM_PROTOCOL,
  };

  // Include WebSocket relay stats if in ws-relay mode
  if (env.MEETING_BAAS_STREAM_PROTOCOL === 'ws-relay') {
    try {
      const { getRelayStats } = await import('@/realtime/ws-relay.js');
      health.wsRelay = getRelayStats();
    } catch (error) {
      health.wsRelay = { error: 'Failed to get relay stats' };
    }
  }

  return c.json(health);
});

// Add more route modules here as they are created
// Example:
// router.route('/bots', botsRouter);
// router.route('/meetings', meetingsRouter);