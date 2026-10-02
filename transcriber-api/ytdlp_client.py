import json
import logging
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from config import (
    DOWNLOAD_TIMEOUT_SECONDS,
    MAX_VIDEOS_PER_LIST,
    TITLE_PARALLELISM,
    TITLES_TIMEOUT_SECONDS,
    VALIDATE_TIMEOUT_SECONDS,
    VIDEOS_LIST_TIMEOUT_SECONDS,
    build_ytdlp_args,
)

logger = logging.getLogger(__name__)


class YtdlpError(RuntimeError):
    def __init__(self, message: str, status_hint: int = 502) -> None:
        super().__init__(message)
        self.status_hint = status_hint


@dataclass
class VideoEntry:
    video_id: str
    title: str
    url: str
    thumbnail_url: Optional[str]
    duration_seconds: int
    published_at: str


@dataclass
class CreatorInfo:
    valid: bool
    name: Optional[str]
    avatar_url: Optional[str]
    error_message: Optional[str]


@dataclass
class VideoDetails:
    video_id: str
    title: str
    thumbnail_url: Optional[str]
    duration_seconds: int
    published_at: str
    error: Optional[str]


@dataclass
class DownloadResult:
    audio_path: Path
    title: str


def _run_ytdlp(args: List[str], timeout: int) -> subprocess.CompletedProcess:
    base = build_ytdlp_args()
    full_args = base + args
    logger.info("Running yt-dlp: %s", " ".join(full_args))
    try:
        return subprocess.run(
            full_args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise YtdlpError(f"yt-dlp timed out after {timeout}s.") from exc
    except OSError as exc:
        raise YtdlpError(f"Failed to launch yt-dlp: {exc}") from exc


def _classify_error(stderr: str, stdout: str) -> str:
    combined = f"{stderr}\n{stdout}".lower()

    if "sign in to confirm" in combined or ("bot" in combined and "sign" in combined):
        return (
            "The platform is blocking this download (bot detection). "
            "Add a valid cookies.txt file to the Termux home directory."
        )
    if "http error 412" in combined or "412 precondition failed" in combined:
        return (
            "Bilibili rejected the request (HTTP 412). "
            "Your cookies.txt may be missing, expired, or the session was invalidated."
        )
    if "http error 403" in combined:
        return (
            "The platform refused the download (HTTP 403). "
            "An updated yt-dlp or fresh cookies may be required."
        )
    if "video unavailable" in combined or "video is unavailable" in combined:
        return "The video is unavailable or has been removed."
    if "private video" in combined:
        return "The video is private."
    if "members-only" in combined or "premium" in combined:
        return "This video requires a paid account and cannot be downloaded."
    if "geo" in combined and "block" in combined:
        return "The video is geo-blocked in your region."
    if "not found" in combined or "404" in combined:
        return "The creator or video could not be found."
    if "unsupported url" in combined:
        return "This URL is not supported by the downloader."
    if "unable to extract" in combined:
        return "yt-dlp could not parse this page. Try updating yt-dlp."
    if "timed out" in combined:
        return "The download timed out. Try again."
    return "yt-dlp failed to fetch the requested resource."


def _looks_like_url(value: str) -> bool:
    v = value.strip().lower()
    return v.startswith("http://") or v.startswith("https://")


def _normalize_platform_url(platform: str, username: str) -> str:
    raw = username.strip()

    if _looks_like_url(raw):
        return raw

    handle = raw.lstrip("@").strip()

    mapping = {
        "youtube": f"https://www.youtube.com/@{handle}",
        "tiktok": f"https://www.tiktok.com/@{handle}",
        "instagram": f"https://www.instagram.com/{handle}/",
        "twitter": f"https://x.com/{handle}",
        "facebook": f"https://www.facebook.com/{handle}",
        "bilibili": f"https://space.bilibili.com/{handle}",
    }
    return mapping.get(platform, handle)


def _build_video_url(platform: str, video_id: str) -> str:
    if platform == "bilibili":
        return f"https://www.bilibili.com/video/{video_id}"
    if platform == "youtube":
        return f"https://www.youtube.com/watch?v={video_id}"
    if platform == "tiktok":
        return f"https://www.tiktok.com/video/{video_id}"
    return video_id


def _parse_published(upload_date: str) -> str:
    if upload_date and len(upload_date) == 8:
        return f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00.000Z"
    return upload_date or ""


def _parse_duration(value) -> int:
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def _pick_thumbnail(data: dict) -> Optional[str]:
    thumbnails = data.get("thumbnails") or []
    if isinstance(thumbnails, list) and thumbnails:
        return thumbnails[-1].get("url")
    return data.get("thumbnail")


def list_creator_videos(
    platform: str,
    username: str,
    limit: int,
    start_index: int = 0,
) -> List[VideoEntry]:
    limit = max(1, min(limit, MAX_VIDEOS_PER_LIST))
    start_index = max(0, start_index)
    end_index = start_index + limit - 1

    url = _normalize_platform_url(platform, username)

    args = [
        "--flat-playlist",
        "--playlist-start",
        str(start_index + 1),
        "--playlist-end",
        str(end_index + 1),
        "--dump-json",
        "--skip-download",
        "--no-warnings",
        url,
    ]

    result = _run_ytdlp(args, VIDEOS_LIST_TIMEOUT_SECONDS)

    if result.returncode != 0 and not result.stdout.strip():
        raise YtdlpError(_classify_error(result.stderr, result.stdout))

    videos: List[VideoEntry] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        video_id = str(data.get("id") or "")
        title = str(data.get("title") or "").strip()
        video_url = str(data.get("webpage_url") or data.get("url") or "")
        if not video_id:
            continue
        if not video_url:
            video_url = _build_video_url(platform, video_id)

        videos.append(
            VideoEntry(
                video_id=video_id,
                title=title,
                url=video_url,
                thumbnail_url=_pick_thumbnail(data),
                duration_seconds=_parse_duration(data.get("duration")),
                published_at=_parse_published(str(data.get("upload_date") or "")),
            )
        )

    return videos[:limit]


def fetch_title_for_video(
    platform: str,
    video_url: str,
    timeout: int = TITLES_TIMEOUT_SECONDS,
) -> VideoDetails:
    video_id = ""
    try:
        # Cheap trick: extract id from url tail
        tail = video_url.rstrip("/").split("/")[-1]
        if "watch?v=" in video_url:
            tail = video_url.split("watch?v=")[-1].split("&")[0]
        video_id = tail
    except Exception:
        video_id = ""

    args = [
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        "--no-playlist",
        video_url,
    ]

    try:
        result = _run_ytdlp(args, timeout)
    except YtdlpError as exc:
        return VideoDetails(
            video_id=video_id,
            title="",
            thumbnail_url=None,
            duration_seconds=0,
            published_at="",
            error=str(exc),
        )

    if result.returncode != 0 or not result.stdout.strip():
        return VideoDetails(
            video_id=video_id,
            title="",
            thumbnail_url=None,
            duration_seconds=0,
            published_at="",
            error=_classify_error(result.stderr, result.stdout),
        )

    try:
        data = json.loads(result.stdout.strip().splitlines()[0])
    except (json.JSONDecodeError, IndexError):
        data = {}

    return VideoDetails(
        video_id=str(data.get("id") or video_id),
        title=str(data.get("title") or "").strip(),
        thumbnail_url=_pick_thumbnail(data),
        duration_seconds=_parse_duration(data.get("duration")),
        published_at=_parse_published(str(data.get("upload_date") or "")),
        error=None,
    )


def fetch_titles_batch(
    platform: str,
    items: List[Tuple[str, str]],
    timeout: int = TITLES_TIMEOUT_SECONDS,
) -> Dict[str, VideoDetails]:
    """items: list of (videoId, videoUrl). Returns videoId -> VideoDetails."""
    results: Dict[str, VideoDetails] = {}

    if not items:
        return results

    def work(item: Tuple[str, str]) -> VideoDetails:
        _, url = item
        return fetch_title_for_video(platform, url, timeout=timeout)

    workers = max(1, min(TITLE_PARALLELISM, len(items)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {
            executor.submit(work, item): item[0]
            for item in items
        }
        for future in as_completed(future_map):
            req_id = future_map[future]
            try:
                details = future.result()
            except Exception as exc:
                details = VideoDetails(
                    video_id=req_id,
                    title="",
                    thumbnail_url=None,
                    duration_seconds=0,
                    published_at="",
                    error=str(exc),
                )
            results[req_id] = details

    return results


def validate_creator(platform: str, username: str) -> CreatorInfo:
    url = _normalize_platform_url(platform, username)
    args = [
        "--flat-playlist",
        "--playlist-end",
        "1",
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        url,
    ]

    try:
        result = _run_ytdlp(args, VALIDATE_TIMEOUT_SECONDS)
    except YtdlpError as exc:
        return CreatorInfo(valid=False, name=None, avatar_url=None, error_message=str(exc))

    if result.returncode != 0 or not result.stdout.strip():
        message = _classify_error(result.stderr, result.stdout)
        return CreatorInfo(valid=False, name=None, avatar_url=None, error_message=message)

    try:
        data = json.loads(result.stdout.strip().splitlines()[0])
    except (json.JSONDecodeError, IndexError):
        data = {}

    # Only trust a channel name that looks like a real display name.
    # yt-dlp's flat extraction often returns the numeric UID for Bilibili,
    # which is not useful as a display name.
    name = (
        data.get("channel")
        or data.get("uploader")
        or ""
    )
    name = str(name).strip() if name else ""

    # Reject pure-numeric names (Bilibili UIDs) and clearly placeholder values.
    if name:
        digits_only = name.lstrip("@").isdigit()
        if digits_only or name.lower() in ("unknown", "n/a", "null", "none"):
            name = ""

    avatar_url = _pick_thumbnail(data)

    return CreatorInfo(
        valid=True,
        name=name or None,
        avatar_url=avatar_url,
        error_message=None,
    )


def download_audio(
    platform: str,
    video_url: str,
    dest_dir: Path,
    timeout_seconds: int = DOWNLOAD_TIMEOUT_SECONDS,
) -> DownloadResult:
    dest_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(dest_dir / "audio.%(ext)s")

    args = [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "5",
        "--no-playlist",
        "--no-warnings",
        "--no-cache-dir",
        "--print",
        "before_dl:%(title)s",
        "-o",
        output_template,
        video_url,
    ]

    started = time.monotonic()
    result = _run_ytdlp(args, timeout_seconds)
    elapsed = time.monotonic() - started
    logger.info("yt-dlp download finished in %.1fs (exit %s)", elapsed, result.returncode)

    if result.returncode != 0:
        message = _classify_error(result.stderr, result.stdout)
        raise YtdlpError(message, status_hint=502)

    title = ""
    for line in (result.stdout or "").splitlines():
        line = line.strip()
        if line:
            title = line
            break

    candidates = sorted(dest_dir.glob("audio.*"))
    for candidate in candidates:
        if candidate.suffix.lower() in (
            ".mp3",
            ".m4a",
            ".wav",
            ".ogg",
            ".opus",
            ".webm",
            ".aac",
            ".flac",
        ):
            return DownloadResult(audio_path=candidate, title=title)

    raise YtdlpError(
        f"Download finished but no audio file was found in {dest_dir}.",
        status_hint=500,
    )


def detect_platform_from_url(url: str) -> str:
    value = url.lower()
    if "youtube.com" in value or "youtu.be" in value:
        return "youtube"
    if "tiktok.com" in value:
        return "tiktok"
    if "instagram.com" in value:
        return "instagram"
    if "twitter.com" in value or "x.com" in value:
        return "twitter"
    if "facebook.com" in value or "fb.com" in value:
        return "facebook"
    if "bilibili.com" in value or "b23.tv" in value or "bilibili.tv" in value:
        return "bilibili"
    return "other"