#!/usr/bin/env sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
set -eu

PORT="${1:-38765}"
ROOT_DIR="$(CDPATH="" cd -- "$(dirname -- "$0")" && pwd)/webroot"
URL="http://127.0.0.1:$PORT/"
SIMULATOR_URL="${URL}simulator.html"

echo "Starting FloppyCompanion WebUI server"
echo "Root: $ROOT_DIR"
echo "WebUI: $URL"
echo "Simulator: $SIMULATOR_URL"

if command -v python3 >/dev/null 2>&1; then
    exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR"
fi

if command -v python >/dev/null 2>&1; then
    exec python -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR"
fi

echo "Error: Python 3 is required to run the local web server." >&2
exit 1
