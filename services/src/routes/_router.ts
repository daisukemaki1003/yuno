import { Hono } from 'hono';

/**
 * Main router for aggregating all routes
 * Future routes like /bots will be mounted here
 */
export const router = new Hono();

// Health check endpoint
router.get('/healthz', async (c) => {
  const health: any = {
    status: 'ok',
    streamMode: 'ws-relay',
  };

  // Include WebSocket relay stats
  try {
    const { getRelayStats } = await import('@/services/ws-relay.service.js');
    health.wsRelay = getRelayStats();
  } catch (error) {
    health.wsRelay = { error: 'Failed to get relay stats' };
  }

  return c.json(health);
});

// Add more route modules here as they are created
// Example:
// router.route('/bots', botsRouter);
// router.route('/meetings', meetingsRouter);