import type { Scenario } from './types.js'

const rateLimitN = parseInt(process.env.MOCK_RATE_LIMIT_N || '2', 10)

export const rateLimitScenario: Scenario = {
  name: 'rate_limit',
  shouldRateLimit: (requestCount) => requestCount <= rateLimitN,
  shouldFail: () => false,
  shouldDelay: () => 0,
  shouldRequireAuth: () => false,
  getErrorResponse: (requestCount) => {
    if (requestCount <= rateLimitN) {
      return {
        status: 429,
        body: { error: 'Rate limit exceeded' },
        headers: { 'Retry-After': '5' }
      }
    }
    return null
  },
  getStreamBehavior: () => ({
    initialDelay: 0,
    shouldError: false
  })
}