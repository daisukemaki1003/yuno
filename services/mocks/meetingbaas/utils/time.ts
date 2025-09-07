export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getCurrentTimestamp(): number {
  return Date.now()
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}