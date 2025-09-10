import type { Scenario } from './types.js'

const flakyK = parseInt(process.env.MOCK_FLAKY_K || '1', 10)

export const flakyScenario: Scenario = {
  name: 'flaky',
  shouldRateLimit: () => false,
  shouldFail: (requestCount) => requestCount <= flakyK,
  shouldDelay: () => 0,
  shouldRequireAuth: () => false,
  getErrorResponse: (requestCount) => {
    if (requestCount <= flakyK) {
      return {
        status: 503,
        body: { error: 'Service temporarily unavailable' }
      }
    }
    return null
  },
  getStreamBehavior: () => ({
    initialDelay: 0,
    shouldError: true,
    errorAfterMs: 15000
  })
}