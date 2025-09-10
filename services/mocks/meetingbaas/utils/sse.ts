import type { Context } from 'hono'

export async function* createSSEStream(
  events: AsyncGenerator<SSEEvent>
): AsyncGenerator<string> {
  for await (const event of events) {
    yield formatSSEEvent(event)
  }
}

export interface SSEEvent {
  event?: string
  data: any
  id?: string
  retry?: number
}

export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = []
  
  if (event.id) {
    lines.push(`id: ${event.id}`)
  }
  
  if (event.event) {
    lines.push(`event: ${event.event}`)
  }
  
  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`)
  }
  
  const data = typeof event.data === 'string' 
    ? event.data 
    : JSON.stringify(event.data)
    
  lines.push(`data: ${data}`)
  lines.push('', '')
  
  return lines.join('\n')
}

export async function sendSSE(
  c: Context,
  eventStream: AsyncGenerator<SSEEvent>
): Promise<Response> {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of eventStream) {
          const formatted = formatSSEEvent(event)
          controller.enqueue(encoder.encode(formatted))
        }
      } catch (error) {
        console.error('SSE stream error:', error)
      } finally {
        controller.close()
      }
    }
  })
  
  return c.newResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}