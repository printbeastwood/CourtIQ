#!/bin/bash
# CourtIQ MITM Proxy Capture Script
# Captures API traffic from Book & Go (Kross Padel) and Padel Society apps
#
# Prerequisites:
#   brew install mitmproxy
#   iOS: Install mitmproxy CA cert (http://mitm.it after proxy config)
#   Android: Requires rooted device or app with networkSecurityConfig allowing user CAs
#
# Usage:
#   1. Start this script
#   2. Configure phone WiFi proxy to <your-ip>:8080
#   3. Open each target app and browse availability
#   4. Results saved to scripts/captures/

set -euo pipefail

CAPTURE_DIR="$(dirname "$0")/captures"
mkdir -p "$CAPTURE_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Filter for only our target domains
FILTER_DOMAINS="bookandgo|krosspadel|thepadelsociety|padelsociety"

echo "=== CourtIQ MITM Capture ==="
echo "Capture dir: $CAPTURE_DIR"
echo "Filtering domains matching: $FILTER_DOMAINS"
echo ""
echo "Setup:"
echo "  1. Connect your phone to the same WiFi as this machine"
echo "  2. Set phone HTTP proxy to $(ipconfig getifaddr en0 2>/dev/null || echo '<your-ip>'):8080"
echo "  3. Visit http://mitm.it on phone browser to install CA cert"
echo "  4. Open Kross Padel app → browse courts → check availability for multiple dates"
echo "  5. Open Padel Society app → same flow"
echo "  6. Press Ctrl+C when done"
echo ""

# Run mitmproxy in dump mode, saving all flows and also writing a human-readable log
mitmdump \
  --set flow_detail=3 \
  --set console_eventlog_verbosity=info \
  -w "$CAPTURE_DIR/flows_${TIMESTAMP}.mitm" \
  --set stream_large_bodies=1m \
  -s "$(cat <<'PYTHON' > "$CAPTURE_DIR/filter_${TIMESTAMP}.py" && echo "$CAPTURE_DIR/filter_${TIMESTAMP}.py"
import re
import json
from mitmproxy import http

TARGET_PATTERN = re.compile(r"bookandgo|krosspadel|thepadelsociety|padelsociety", re.IGNORECASE)
LOG_FILE = None

def get_log_file(timestamp):
    global LOG_FILE
    if LOG_FILE is None:
        import os
        capture_dir = os.path.dirname(os.path.abspath(__file__))
        LOG_FILE = open(os.path.join(capture_dir, f"api_log.jsonl"), "a")
    return LOG_FILE

def response(flow: http.HTTPFlow):
    if not TARGET_PATTERN.search(flow.request.pretty_host):
        return

    entry = {
        "method": flow.request.method,
        "url": flow.request.pretty_url,
        "host": flow.request.pretty_host,
        "path": flow.request.path,
        "request_headers": dict(flow.request.headers),
        "request_body": None,
        "status_code": flow.response.status_code if flow.response else None,
        "response_headers": dict(flow.response.headers) if flow.response else None,
        "response_body": None,
    }

    # Capture request body
    if flow.request.content:
        try:
            entry["request_body"] = json.loads(flow.request.content)
        except (json.JSONDecodeError, UnicodeDecodeError):
            entry["request_body"] = flow.request.content.decode("utf-8", errors="replace")[:2000]

    # Capture response body
    if flow.response and flow.response.content:
        try:
            entry["response_body"] = json.loads(flow.response.content)
        except (json.JSONDecodeError, UnicodeDecodeError):
            entry["response_body"] = flow.response.content.decode("utf-8", errors="replace")[:5000]

    log = get_log_file(None)
    log.write(json.dumps(entry, default=str) + "\n")
    log.flush()

    # Print summary to console
    print(f"\n{'='*60}")
    print(f"[{entry['method']}] {entry['url']}")
    print(f"  Status: {entry['status_code']}")
    if entry['request_headers'].get('Authorization') or entry['request_headers'].get('authorization'):
        auth = entry['request_headers'].get('Authorization') or entry['request_headers'].get('authorization')
        print(f"  Auth: {auth[:50]}...")
    if entry['response_body'] and isinstance(entry['response_body'], dict):
        print(f"  Response keys: {list(entry['response_body'].keys())[:10]}")
    print(f"{'='*60}")
PYTHON
)"

echo ""
echo "Done! Check $CAPTURE_DIR for:"
echo "  - flows_${TIMESTAMP}.mitm (binary replay file)"
echo "  - api_log.jsonl (structured API log)"
