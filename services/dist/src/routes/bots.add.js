import { Hono } from 'hono';
import { bearerAuth, extractMeetingBaasApiKey } from '@/middlewares/auth.js';
import { addBot } from '@/controllers/bots.controller.js';
const app = new Hono();
// POST /v1/bots
app.post('/', bearerAuth, extractMeetingBaasApiKey, addBot);
export default app;
//# sourceMappingURL=bots.add.js.map