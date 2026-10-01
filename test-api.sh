#!/data/data/com.termux/files/usr/bin/bash
set -e
BASE="${TRACECORE_URL:-http://127.0.0.1:3000}"
echo "Health:"; curl -fsS "$BASE/api/health"; echo
echo "Plans:"; curl -fsS "$BASE/api/plans"; echo
