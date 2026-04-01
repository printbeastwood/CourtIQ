#!/bin/bash
# Analyze MITM capture and summarize discovered API endpoints
# Usage: ./scripts/analyze-capture.sh [capture_dir]

CAPTURE_DIR="${1:-scripts/captures}"
LOG_FILE="$CAPTURE_DIR/api_log.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "No capture log found at $LOG_FILE"
  echo "Run scripts/mitm-capture.sh first."
  exit 1
fi

echo "=== CourtIQ API Capture Analysis ==="
echo ""

echo "--- Unique Hosts ---"
cat "$LOG_FILE" | python3 -c "
import json, sys
from collections import Counter
hosts = Counter()
for line in sys.stdin:
    try:
        e = json.loads(line)
        hosts[e['host']] += 1
    except: pass
for h, c in hosts.most_common():
    print(f'  {h}: {c} requests')
"

echo ""
echo "--- Unique Endpoints (method + path) ---"
cat "$LOG_FILE" | python3 -c "
import json, sys, re
from collections import Counter
endpoints = Counter()
for line in sys.stdin:
    try:
        e = json.loads(line)
        # Normalize UUIDs and numeric IDs in paths
        path = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '{uuid}', e['path'])
        path = re.sub(r'/\d+(?=/|$|\?)', '/{id}', path)
        path = path.split('?')[0]
        endpoints[f\"{e['method']} {path}\"] += 1
    except: pass
for ep, c in sorted(endpoints.items()):
    print(f'  {ep} ({c}x)')
"

echo ""
echo "--- Auth Patterns ---"
cat "$LOG_FILE" | python3 -c "
import json, sys
auth_types = set()
for line in sys.stdin:
    try:
        e = json.loads(line)
        headers = e.get('request_headers', {})
        for k, v in headers.items():
            if k.lower() in ('authorization', 'x-api-key', 'x-auth-token'):
                auth_type = v.split(' ')[0] if ' ' in v else 'custom'
                auth_types.add(f'{k}: {auth_type}...')
    except: pass
if auth_types:
    for a in auth_types:
        print(f'  {a}')
else:
    print('  No auth headers found')
"

echo ""
echo "--- Sample Response Shapes (first occurrence per endpoint) ---"
cat "$LOG_FILE" | python3 -c "
import json, sys, re

seen = set()
for line in sys.stdin:
    try:
        e = json.loads(line)
        path = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '{uuid}', e['path'])
        path = re.sub(r'/\d+(?=/|$|\?)', '/{id}', path).split('?')[0]
        key = f\"{e['method']} {path}\"
        if key in seen:
            continue
        seen.add(key)
        body = e.get('response_body')
        if isinstance(body, dict):
            def shape(obj, depth=0):
                if depth > 2: return '...'
                if isinstance(obj, dict):
                    return {k: shape(v, depth+1) for k, v in list(obj.items())[:8]}
                if isinstance(obj, list):
                    return [shape(obj[0], depth+1)] if obj else []
                return type(obj).__name__
            print(f'\n  {key} -> {e[\"status_code\"]}')
            print(f'    {json.dumps(shape(body), indent=4)[:500]}')
    except: pass
"
