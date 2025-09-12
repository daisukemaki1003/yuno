#!/bin/bash

# Test SSE stream for transcripts

MEETING_ID=$1
USER_TOKEN=$2
API_KEY=$3

if [ -z "$MEETING_ID" ] || [ -z "$USER_TOKEN" ] || [ -z "$API_KEY" ]; then
  echo "Usage: ./test-stream.sh <MEETING_ID> <USER_TOKEN> <API_KEY>"
  echo "Example: ./test-stream.sh meeting123 your-token your-api-key"
  exit 1
fi

echo "Connecting to transcript stream for meeting: $MEETING_ID"
echo "Press Ctrl+C to stop"
echo "---"

curl -N "http://localhost:8080/v1/meetings/${MEETING_ID}/stream?userId=test&types=transcript" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "x-meeting-baas-api-key: ${API_KEY}" \
  -H "Accept: text/event-stream"