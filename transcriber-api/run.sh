#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- Configuration ----
# Edit these or export them before running.
export API_KEY="${API_KEY:-change-me-please}"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8000}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"
export TRANSCRIBE_TIMEOUT="${TRANSCRIBE_TIMEOUT:-900}"
export DOWNLOAD_TIMEOUT="${DOWNLOAD_TIMEOUT:-600}"

# ---- Pre-flight checks ----
command -v python >/dev/null 2>&1 || { echo "python not found"; exit 1; }
command -v yt-dlp >/dev/null 2>&1 || { echo "yt-dlp not found"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not found"; exit 1; }
command -v whisper >/dev/null 2>&1 || { echo "whisper not found on PATH"; exit 1; }

# ---- Wake lock: keep Android from killing Termux ----
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  echo "[run.sh] wake-lock acquired"
fi

cleanup() {
  echo ""
  echo "[run.sh] shutting down…"
  if command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock || true
  fi
}
trap cleanup EXIT INT TERM

# ---- Print the URL for the phone's LAN IP ----
LAN_IP="$(ip -4 addr show 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}' | grep -v '^127\.' | head -n1 || true)"
if [ -z "${LAN_IP:-}" ]; then
  LAN_IP="<phone-lan-ip>"
fi

echo ""
echo "=============================================="
echo "  Transcriber API"
echo "=============================================="
echo "  Listen:       http://${HOST}:${PORT}"
echo "  On LAN:       http://${LAN_IP}:${PORT}"
echo "  API key:      ${API_KEY}"
echo "  Model:        ${WHISPER_MODEL}"
echo "  Log level:    ${LOG_LEVEL}"
echo "=============================================="
echo ""
echo "  In the app's Settings, set:"
echo "    Backend URL:  http://${LAN_IP}:${PORT}"
echo "    API key:      ${API_KEY}"
echo ""
echo "  Press Ctrl+C to stop."
echo "=============================================="
echo ""

# ---- Launch uvicorn ----
exec python -m uvicorn server:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers 1 \
  --log-level "$(echo "$LOG_LEVEL" | tr '[:upper:]' '[:lower:]')"