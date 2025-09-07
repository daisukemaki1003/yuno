export interface Scenario {
  name: string
  shouldRateLimit: (requestCount: number) => boolean
  shouldFail: (requestCount: number) => boolean
  shouldDelay: () => number
  shouldRequireAuth: () => boolean
  getErrorResponse: (requestCount: number) => {
    status: number
    body: any
    headers?: Record<string, string>
  } | null
  getStreamBehavior: () => {
    initialDelay: number
    shouldError: boolean
    errorAfterMs?: number
  }
}