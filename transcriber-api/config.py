import os
from pathlib import Path

HOME = Path(os.path.expanduser("~"))
API_DIR = HOME / "transcriber-api"
TMP_ROOT = HOME / "transcriber-tmp"
YTDLP_CONFIG = HOME / ".config" / "yt-dlp" / "config"
COOKIES_FILE = HOME / "cookies.txt"

WHISPER_CLI = os.environ.get("WHISPER_CLI", "whisper")

WHISPER_MODELS = {
    "tiny": HOME / "termux-whisper" / "whisper.cpp" / "models" / "ggml-tiny.bin",
    "base": HOME / "termux-whisper" / "whisper.cpp" / "models" / "ggml-base.bin",
    "small": HOME / "termux-whisper" / "whisper.cpp" / "models" / "ggml-small.bin",
    "medium": HOME / "termux-whisper" / "whisper.cpp" / "models" / "ggml-medium.bin",
}
DEFAULT_MODEL = os.environ.get("WHISPER_MODEL", "base")

API_KEY = os.environ.get("API_KEY", "")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))

TRANSCRIBE_TIMEOUT_SECONDS = int(os.environ.get("TRANSCRIBE_TIMEOUT", "7200"))
VIDEOS_LIST_TIMEOUT_SECONDS = int(os.environ.get("VIDEOS_LIST_TIMEOUT", "60"))
TITLES_TIMEOUT_SECONDS = int(os.environ.get("TITLES_TIMEOUT", "180"))
VALIDATE_TIMEOUT_SECONDS = int(os.environ.get("VALIDATE_TIMEOUT", "30"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.environ.get("DOWNLOAD_TIMEOUT", "1800"))

TITLE_PARALLELISM = int(os.environ.get("TITLE_PARALLELISM", "4"))
TITLES_MAX_BATCH = int(os.environ.get("TITLES_MAX_BATCH", "50"))

MAX_VIDEOS_PER_LIST = int(os.environ.get("MAX_VIDEOS_PER_LIST", "100"))
DEFAULT_VIDEOS_LIMIT = int(os.environ.get("DEFAULT_VIDEOS_LIMIT", "50"))
PAGE_SIZE = int(os.environ.get("PAGE_SIZE", "25"))

# ---- Chunking settings ----
# Videos longer than CHUNK_THRESHOLD_SECONDS will be split into
# CHUNK_SIZE_SECONDS chunks (with CHUNK_OVERLAP_SECONDS of overlap
# between adjacent chunks for context preservation).
CHUNK_ENABLED = os.environ.get("CHUNK_ENABLED", "1") not in ("0", "false", "False")
CHUNK_THRESHOLD_SECONDS = int(os.environ.get("CHUNK_THRESHOLD_SECONDS", "600"))
CHUNK_SIZE_SECONDS = int(os.environ.get("CHUNK_SIZE_SECONDS", "300"))
CHUNK_OVERLAP_SECONDS = int(os.environ.get("CHUNK_OVERLAP_SECONDS", "5"))
CHUNK_MIN_TAIL_SECONDS = int(os.environ.get("CHUNK_MIN_TAIL_SECONDS", "10"))

YTDLP_BIN = os.environ.get("YTDLP_BIN", "yt-dlp")
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.environ.get("FFPROBE_BIN", "ffprobe")

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")


def ensure_dirs() -> None:
    TMP_ROOT.mkdir(parents=True, exist_ok=True)
    YTDLP_CONFIG.parent.mkdir(parents=True, exist_ok=True)


def resolve_model_path(name: str) -> Path:
    key = (name or DEFAULT_MODEL).strip().lower()
    if key == "auto":
        key = DEFAULT_MODEL
    if key == "large":
        key = "large-v3-turbo"
    path = WHISPER_MODELS.get(key)
    if path is None:
        path = WHISPER_MODELS[DEFAULT_MODEL]
    return path


def model_exists(name: str) -> bool:
    return resolve_model_path(name).is_file()


def build_ytdlp_args() -> list[str]:
    args: list[str] = [YTDLP_BIN]
    if YTDLP_CONFIG.is_file():
        args.append("--config-locations")
        args.append(str(YTDLP_CONFIG))
    if COOKIES_FILE.is_file():
        args.append("--cookies")
        args.append(str(COOKIES_FILE))
    args.append("--no-warnings")
    args.append("--no-cache-dir")
    return args