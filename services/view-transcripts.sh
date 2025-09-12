#!/bin/bash

# View transcript logs

LOG_DIR="logs"
TODAY=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/transcripts-$TODAY.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "No transcript log file found for today: $LOG_FILE"
  echo "Available log files:"
  ls -la $LOG_DIR/transcripts-*.jsonl 2>/dev/null || echo "No transcript logs found"
  exit 1
fi

echo "Viewing transcripts from: $LOG_FILE"
echo "---"

# Show only final transcripts with formatting
cat "$LOG_FILE" | jq -r 'select(.isFinal == true) | "\(.loggedAt) [\(.language)] \(.text)"' 2>/dev/null || \
  echo "Error: jq not installed. Install with: brew install jq"

echo "---"
echo "To view all transcripts (including partial): cat $LOG_FILE | jq"
echo "To view errors: cat $LOG_FILE | jq 'select(.type == \"error\")'"