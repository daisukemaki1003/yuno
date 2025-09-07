# Meeting BaaS v1 API Test Commands

## Prerequisites

1. Start the development server:
```bash
pnpm dev
```

2. Make sure you have a valid Meeting BaaS API key.

## Test Commands

### 1. Add Bot to Meeting

```bash
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u_123","meetingId":"m_abc","options":{"language":"ja-JP"}}'
```

Expected response:
```json
{
  "botId": "bot_456",
  "meetingId": "m_abc",
  "status": "joining"
}
```

### 2. Get Bot Status

```bash
curl "http://localhost:8080/v1/bots/bot_456/status?userId=u_123" \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY"
```

Expected response:
```json
{
  "botId": "bot_456",
  "status": "joined",
  "meetingId": "m_abc",
  "vendorRaw": {}
}
```

### 3. Remove Bot from Meeting

```bash
curl -X DELETE "http://localhost:8080/v1/bots/bot_456?userId=u_123" \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY"
```

Expected response: 204 No Content

### 4. Recording Stream (SSE)

Raw mode (default):
```bash
curl -N "http://localhost:8080/v1/meetings/m_abc/stream?userId=u_123" \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY"
```

Normalized mode with specific event types:
```bash
curl -N "http://localhost:8080/v1/meetings/m_abc/stream?userId=u_123&mode=normalized&types=audio,transcript" \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY"
```

Expected SSE events:
```
event: ping
data: {"timestamp":1704067200000}

event: audio
data: {"type":"audio","data":...,"timestamp":1704067201000}

event: transcript
data: {"type":"transcript","data":...,"timestamp":1704067202000}

event: end
data: {"type":"end","timestamp":1704067203000}
```

## Error Testing

### Missing Authorization:
```bash
curl -X POST http://localhost:8080/v1/bots \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u_123","meetingId":"m_abc"}'
```

Expected: 401 Unauthorized

### Missing API Key:
```bash
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u_123","meetingId":"m_abc"}'
```

Expected: 401 Unauthorized

### Invalid Request Body:
```bash
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":""}'
```

Expected: 400 Bad Request with validation error

## Idempotency Test

```bash
# First request
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u_123","meetingId":"m_abc"}'

# Second request with same Idempotency-Key (within 5 minutes)
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer test" \
  -H "X-MeetingBaas-ApiKey: YOUR_API_KEY" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u_123","meetingId":"m_abc"}'
```

Expected: Same response for both requests