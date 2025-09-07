#!/bin/bash

# Test script for Meeting BaaS Mock Server

echo "Testing Meeting BaaS Mock Server"
echo "================================"

# Test 1: Create a bot
echo -e "\n1. Creating a bot..."
curl -X POST "http://localhost:4010/v1/bots" \
  -H "Authorization: Bearer test-token" \
  -H "X-API-Key: test-key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-123" \
  -d '{"meetingId":"m_test","userId":"u_123"}'

# Test 2: Test rate limiting
echo -e "\n\n2. Testing rate limiting (run with MOCK_SCENARIO=rate_limit)..."
for i in {1..3}; do
  echo -e "\nRequest $i:"
  curl -X POST "http://localhost:4010/v1/bots" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: test-$i" \
    -d '{"meetingId":"m_test","userId":"u_123"}' \
    -w "\nStatus: %{http_code}\n"
done

# Test 3: SSE stream
echo -e "\n\n3. Testing SSE stream (will run for 5 seconds)..."
timeout 5 curl -N "http://localhost:4010/v1/meetings/m_test/recording" \
  -H "Authorization: Bearer test-token" \
  -H "Accept: text/event-stream"