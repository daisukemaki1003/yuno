import type { Scenario } from './types.js'

export const slowScenario: Scenario = {
  name: 'slow',
  shouldRateLimit: () => false,
  shouldFail: () => false,
  shouldDelay: () => 3000,
  shouldRequireAuth: () => false,
  getErrorResponse: () => null,
  getStreamBehavior: () => ({
    initialDelay: 3000,
    shouldError: false
  })
}