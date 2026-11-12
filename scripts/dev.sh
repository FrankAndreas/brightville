#!/bin/bash
# The whole game on this machine: the server on :8000 (its database in backend/data) and Vite on :5173, which
# forwards /api to it. Without HUB_URL there is no family login: the page asks who plays (LOCAL_PEOPLE, default
# "Kind:CHILD,Eltern:PARENT"). With HUB_URL (and HUB_PUBLIC_URL) set, the family hub's login is used instead.
#
#   npm run dev                                   # no hub
#   LOCAL_PEOPLE="Mia:CHILD,Ben:CHILD,Papa:PARENT" npm run dev
#
# Needs the Python venv once: python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [ ! -x venv/bin/uvicorn ]; then
    echo "No Python venv yet. Once: python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt" >&2
    exit 1
fi
export DATA_DIR="${DATA_DIR:-$root/backend/data}"
# Without a hub the server lets nobody in unless asked to: here that is the point
[ -z "${HUB_URL:-}" ] && export LOCAL_MODE=1
(cd backend && exec ../venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT INT TERM
npx vite "$@"
