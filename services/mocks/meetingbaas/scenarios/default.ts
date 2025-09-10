import type { Scenario } from './types.js'

export const defaultScenario: Scenario = {
  name: 'default',
  shouldRateLimit: () => false,
  shouldFail: () => false,
  shouldDelay: () => 0,
  shouldRequireAuth: () => false,
  getErrorResponse: () => null,
  getStreamBehavior: () => ({
    initialDelay: 0,
    shouldError: false
  })
}