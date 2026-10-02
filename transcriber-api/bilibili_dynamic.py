import hashlib
import logging
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from config import COOKIES_FILE

logger = logging.getLogger(__name__)

NAV_URL = "https://api.bilibili.com/x/web-interface/nav"
DYNAMIC_FEED_URL = "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space"

USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]


class BilibiliDynamicError(RuntimeError):
    pass


@dataclass
class DynamicVideo:
    video_id: str
    url: str
    title: str
    thumbnail_url: Optional[str]
    duration_seconds: int
    published_at: str
    dynamic_type: str


_wbi_keys_cache: Dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_WBI_TTL_SECONDS = 3600


def _load_cookies() -> Dict[str, str]:
    cookies: Dict[str, str] = {}
    if not COOKIES_FILE.is_file():
        return cookies
    try:
        for raw_line in COOKIES_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 7:
                continue
            domain = parts[0]
            name = parts[5]
            value = parts[6]
            if "bilibili" in domain or "bilibili" in COOKIES_FILE.name:
                cookies[name] = value
    except OSError as exc:
        logger.warning("Failed to read cookies file: %s", exc)
    return cookies


def _common_headers() -> Dict[str, str]:
    return {
        "User-Agent": USER_AGENT,
        "Referer": "https://www.bilibili.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Origin": "https://space.bilibili.com",
    }


def _fetch_wbi_keys(force: bool = False) -> tuple[str, str]:
    now = time.time()
    cached = _wbi_keys_cache.get("keys")
    age = now - _wbi_keys_cache.get("fetched_at", 0)
    if cached is not None and not force and age < _WBI_TTL_SECONDS:
        return cached  # type: ignore[return-value]

    try:
        response = requests.get(
            NAV_URL,
            headers=_common_headers(),
            cookies=_load_cookies(),
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise BilibiliDynamicError(f"Failed to fetch WBI keys: {exc}") from exc
    except ValueError as exc:
        raise BilibiliDynamicError(f"WBI keys response was not JSON: {exc}") from exc

    data = payload.get("data") or {}
    wbi_img = data.get("wbi_img") or {}
    img_url = str(wbi_img.get("img_url") or "")
    sub_url = str(wbi_img.get("sub_url") or "")

    img_key = img_url.rsplit("/", 1)[-1].split(".")[0] if img_url else ""
    sub_key = sub_url.rsplit("/", 1)[-1].split(".")[0] if sub_url else ""

    if not img_key or not sub_key:
        raise BilibiliDynamicError(
            "Bilibili did not return WBI keys. Cookies may be missing or invalid."
        )

    keys = (img_key, sub_key)
    _wbi_keys_cache["keys"] = keys
    _wbi_keys_cache["fetched_at"] = now
    return keys


def _mixin_key(img_key: str, sub_key: str) -> str:
    raw = img_key + sub_key
    return "".join(raw[i] for i in MIXIN_KEY_ENC_TAB if i < len(raw))[:32]


def _sign_params(params: Dict[str, Any]) -> str:
    img_key, sub_key = _fetch_wbi_keys()
    mixin = _mixin_key(img_key, sub_key)

    cleaned: Dict[str, str] = {}
    for key, value in params.items():
        if value is None:
            continue
        cleaned[key] = str(value).replace("!", "").replace("'", "").replace("(", "").replace(")", "").replace("*", "")

    cleaned["wts"] = str(int(time.time()))
    sorted_keys = sorted(cleaned.keys())
    query = urllib.parse.urlencode([(k, cleaned[k]) for k in sorted_keys])
    w_rid = hashlib.md5((query + mixin).encode("utf-8")).hexdigest()
    return f"{query}&w_rid={w_rid}"


def fetch_dynamic_page(uid: str, offset: str = "") -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "host_mid": uid,
        "timezone_offset": -480,
        "platform": "web",
        "features": "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote",
        "web_location": "333.1387",
    }
    if offset:
        params["offset"] = offset

    try:
        signed = _sign_params(params)
    except BilibiliDynamicError:
        raise

    url = f"{DYNAMIC_FEED_URL}?{signed}"

    try:
        response = requests.get(
            url,
            headers=_common_headers(),
            cookies=_load_cookies(),
            timeout=30,
        )
    except requests.RequestException as exc:
        raise BilibiliDynamicError(f"Dynamic feed request failed: {exc}") from exc

    if response.status_code != 200:
        raise BilibiliDynamicError(
            f"Bilibili returned HTTP {response.status_code} for dynamic feed."
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise BilibiliDynamicError(
            "Dynamic feed response was not JSON. Bilibili may be rate-limiting."
        ) from exc

    code = payload.get("code")
    if code != 0:
        message = payload.get("message") or payload.get("msg") or "unknown error"
        if code in (-352, -412, -799):
            # WBI keys may have rotated; force refresh and retry once.
            _fetch_wbi_keys(force=True)
            raise BilibiliDynamicError(
                f"Bilibili rejected the request (code {code}: {message}). "
                "Cookies may need refreshing."
            )
        raise BilibiliDynamicError(f"Bilibili API error {code}: {message}")

    return payload.get("data") or {}


def _extract_video_from_item(item: Dict[str, Any]) -> Optional[DynamicVideo]:
    item_type = str(item.get("type") or "")

    if item_type == "DYNAMIC_TYPE_AV":
        modules = item.get("modules") or {}
        dynamic = modules.get("module_dynamic") or {}
        major = dynamic.get("major") or {}
        archive = major.get("archive") or {}
        bvid = str(archive.get("bvid") or "")
        if not bvid:
            return None

        title = str(archive.get("title") or "").strip()
        cover = str(archive.get("cover") or "")
        duration_text = str(archive.get("duration_text") or "")
        duration_seconds = _parse_duration_text(duration_text)

        pub_ts = int(item.get("pub_ts") or 0)
        published = _ts_to_iso(pub_ts)

        return DynamicVideo(
            video_id=bvid,
            url=f"https://www.bilibili.com/video/{bvid}",
            title=title,
            thumbnail_url=cover or None,
            duration_seconds=duration_seconds,
            published_at=published,
            dynamic_type=item_type,
        )

    if item_type == "DYNAMIC_TYPE_FORWARD":
        original = item.get("orig") or {}
        if isinstance(original, dict):
            return _extract_video_from_item(original)
        return None

    return None


def _parse_duration_text(value: str) -> int:
    if not value:
        return 0
    parts = value.strip().split(":")
    try:
        numbers = [int(p) for p in parts]
    except ValueError:
        return 0
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    if len(numbers) == 3:
        return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    return 0


def _ts_to_iso(ts: int) -> str:
    if not ts:
        return ""
    try:
        return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(ts))
    except (ValueError, OSError):
        return ""


def fetch_dynamic_videos(
    uid: str,
    limit: int = 100,
    max_pages: int = 20,
) -> List[DynamicVideo]:
    results: List[DynamicVideo] = []
    seen = set()
    offset = ""
    pages = 0

    while pages < max_pages and len(results) < limit:
        pages += 1
        try:
            data = fetch_dynamic_page(uid, offset=offset)
        except BilibiliDynamicError as exc:
            if pages == 1:
                raise
            logger.warning("Dynamic page %d failed: %s", pages, exc)
            break

        items = data.get("items") or []
        for item in items:
            if not isinstance(item, dict):
                continue
            video = _extract_video_from_item(item)
            if video is None:
                continue
            if video.video_id in seen:
                continue
            seen.add(video.video_id)
            results.append(video)
            if len(results) >= limit:
                break

        if not data.get("has_more"):
            break

        next_offset = str(data.get("offset") or "")
        if not next_offset or next_offset == offset:
            break
        offset = next_offset

    return results[:limit]