let botIdCounter = 1

export function generateBotId(): number {
  return botIdCounter++
}

export function generateMeetingId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `m_${timestamp}_${random}`
}