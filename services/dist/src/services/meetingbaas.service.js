import { createMeetingBaasAdapter } from '@/clients/meetingbaas.adapter.v1.js';
import { meetingBaasConfig } from '@/clients/meetingbaas.config.js';
/**
 * Get Meeting BaaS client for a specific user
 *
 * Currently this is a dummy implementation that takes the API key directly.
 * In the future, this will integrate with key-store service to:
 * 1. Fetch encrypted API key for the user
 * 2. Decrypt it using KMS
 * 3. Create and return the adapter
 *
 * @param userId - User identifier
 * @param apiKeyPlain - Plain API key (temporary - will be removed when key-store is integrated)
 * @returns Meeting BaaS port instance
 */
export async function getMeetingBaasForUser(userId, apiKeyPlain) {
    // TODO: Replace with key-store integration
    // Example future implementation:
    // const keyStore = await getKeyStoreService();
    // const encryptedKey = await keyStore.getApiKey(userId, 'meeting-baas');
    // const apiKey = await keyStore.decrypt(encryptedKey);
    // For now, use the provided API key directly
    const config = meetingBaasConfig();
    return createMeetingBaasAdapter(config, apiKeyPlain);
}
/**
 * Validate if a user has Meeting BaaS access
 *
 * @param userId - User identifier
 * @returns true if user has valid Meeting BaaS credentials
 */
export async function hasUserMeetingBaasAccess(userId) {
    // TODO: Check with key-store if user has Meeting BaaS API key
    // For now, always return true for development
    return true;
}
//# sourceMappingURL=meetingbaas.service.js.map