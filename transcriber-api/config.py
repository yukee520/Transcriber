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

TRANSCRIBE_TIMEOUT_SECONDS = int(os.environ.get("TRANSCRIBE_TIMEOUT", "900"))
VIDEOS_LIST_TIMEOUT_SECONDS = int(os.environ.get("VIDEOS_LIST_TIMEOUT", "60"))
VALIDATE_TIMEOUT_SECONDS = int(os.environ.get("VALIDATE_TIMEOUT", "30"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.environ.get("DOWNLOAD_TIMEOUT", "600"))

MAX_VIDEOS_PER_LIST = int(os.environ.get("MAX_VIDEOS_PER_LIST", "25"))
DEFAULT_VIDEOS_LIMIT = int(os.environ.get("DEFAULT_VIDEOS_LIMIT", "10"))

YTDLP_BIN = os.environ.get("YTDLP_BIN", "yt-dlp")
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")

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