import { Hono } from 'hono';
import { bearerAuth, extractMeetingBaasApiKey } from '@/middlewares/auth.js';
import { leaveBot } from '@/controllers/bots.controller.js';

const app = new Hono();

// DELETE /v1/bots/:botId
app.delete(
  '/:botId',
  bearerAuth,
  extractMeetingBaasApiKey,
  leaveBot
);

export default app;