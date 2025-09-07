import { Hono } from 'hono';
import { bearerAuth, extractMeetingBaasApiKey } from '@/middlewares/auth.js';
import { getStatus } from '@/controllers/bots.controller.js';
const app = new Hono();
// GET /v1/bots/:botId/status
app.get('/:botId/status', bearerAuth, extractMeetingBaasApiKey, getStatus);
export default app;
//# sourceMappingURL=bots.status.js.map