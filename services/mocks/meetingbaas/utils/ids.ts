export function generateBotId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `bot_${timestamp}_${random}`
}

export function generateMeetingId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `m_${timestamp}_${random}`
}