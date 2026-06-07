#!/usr/bin/env bash
set -euo pipefail

PORTS=(3000 4001)

for port in "${PORTS[@]}"; do
  pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠ Port $port is in use by PID(s): $(echo "$pids" | tr '\n' ' ')"
    for pid in $pids; do
      kill "$pid" 2>/dev/null && echo "  ✓ Killed process $pid" || echo "  ✗ Failed to kill process $pid"
    done
    # Wait briefly for ports to be released
    sleep 0.5
  fi
done

# 清理 Turbopack 缓存（防止缓存膨胀导致内存过高）
TURBO_CACHE=".next/dev/cache/turbopack"
if [ -d "$TURBO_CACHE" ]; then
  CACHE_SIZE=$(du -sm "$TURBO_CACHE" 2>/dev/null | cut -f1 || echo "0")
  if [ "$CACHE_SIZE" -gt 2048 ]; then
    echo "⚠ Turbopack cache is ${CACHE_SIZE}MB (>2GB), clearing..."
    rm -rf "$TURBO_CACHE"
    echo "  ✓ Cleared"
  fi
fi

# 支持 --webpack 参数降级到 webpack 模式（内存更低）
if [ "${1:-}" = "--webpack" ]; then
  echo "⚡ Starting with webpack (lower memory mode)..."
  exec npx next dev --webpack
else
  exec npx next dev
fi
