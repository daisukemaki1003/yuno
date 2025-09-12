import { unauthorized } from '@/utils/errors.js';
/**
 * Simple Bearer token authentication middleware
 * Only checks for the presence of Bearer token, not its validity
 */
export async function bearerAuth(c, next) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        throw unauthorized('MISSING_AUTH', 'Authorization header is required');
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        throw unauthorized('INVALID_AUTH', 'Bearer token is required');
    }
    // For now, we just check if token exists
    // In production, this would validate the token
    await next();
}
/**
 * Middleware to extract Meeting BaaS API key from header
 * This is temporary - will be replaced with Key Store integration
 */
export async function extractMeetingBaasApiKey(c, next) {
    // Try both header name variations (case-insensitive)
    const apiKey = c.req.header('x-meeting-baas-api-key') || c.req.header('X-MeetingBaas-ApiKey');
    if (!apiKey) {
        throw unauthorized('MISSING_API_KEY', 'x-meeting-baas-api-key header is required');
    }
    // Store in context for later use
    c.set('meetingBaasApiKey', apiKey);
    await next();
}
//# sourceMappingURL=auth.js.map