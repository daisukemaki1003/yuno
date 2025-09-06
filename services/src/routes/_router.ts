import { Hono } from 'hono';

/**
 * Main router for aggregating all routes
 * Future routes like /bots will be mounted here
 */
export const router = new Hono();

// Health check endpoint
router.get('/healthz', (c) => {
  return c.json({ status: 'ok' });
});

// Add more route modules here as they are created
// Example:
// router.route('/bots', botsRouter);
// router.route('/meetings', meetingsRouter);