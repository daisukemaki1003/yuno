import { defaultScenario } from './default.js'
import { rateLimitScenario } from './rate_limit.js'
import { flakyScenario } from './flaky.js'
import { slowScenario } from './slow.js'
import { authRequiredScenario } from './auth_required.js'
import type { Scenario } from './types.js'

const scenarios: Record<string, Scenario> = {
  default: defaultScenario,
  rate_limit: rateLimitScenario,
  flaky: flakyScenario,
  slow: slowScenario,
  auth_required: authRequiredScenario
}

export function getScenario(name: string): Scenario {
  return scenarios[name] || defaultScenario
}