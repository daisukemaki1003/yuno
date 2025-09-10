import type { Scenario } from './types.js'

export const authRequiredScenario: Scenario = {
  name: 'auth_required',
  shouldRateLimit: () => false,
  shouldFail: () => false,
  shouldDelay: () => 0,
  shouldRequireAuth: () => true,
  getErrorResponse: () => null,
  getStreamBehavior: () => ({
    initialDelay: 0,
    shouldError: false
  })
}