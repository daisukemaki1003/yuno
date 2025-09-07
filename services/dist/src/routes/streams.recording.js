import { Hono } from 'hono';
import { bearerAuth, extractMeetingBaasApiKey } from '@/middlewares/auth.js';
import { recordingSse } from '@/controllers/streams.controller.js';
const app = new Hono();
// GET /v1/meetings/:meetingId/stream
app.get('/:meetingId/stream', bearerAuth, extractMeetingBaasApiKey, recordingSse);
export default app;
//# sourceMappingURL=streams.recording.js.map