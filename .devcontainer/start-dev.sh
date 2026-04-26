#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_DIR}"

mkdir -p .codespaces

if pgrep -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1; then
  echo "Next dev server already running on port 3000."
  exit 0
fi

nohup pnpm dev --hostname 0.0.0.0 --port 3000 > .codespaces/next-dev.log 2>&1 &
echo "Started Next dev server on port 3000."
