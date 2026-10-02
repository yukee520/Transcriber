import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import (
    API_KEY,
    DEFAULT_MODEL,
    DEFAULT_VIDEOS_LIMIT,
    LOG_LEVEL,
    MAX_VIDEOS_PER_LIST,
    TMP_ROOT,
    ensure_dirs,
    model_exists,
)
from srt_parser import segments_to_dicts
from whisper_runner import WhisperError, run_transcription
from ytdlp_client import (
    YtdlpError,
    download_audio,
    list_creator_videos,
    validate_creator,
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("transcriber-api")

app = FastAPI(title="Transcriber API", version="1.0.0")


class ValidateCreatorRequest(BaseModel):
    platform: str
    username: str


class ValidateCreatorResponse(BaseModel):
    valid: bool
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    errorMessage: Optional[str] = None


class ListVideosRequest(BaseModel):
    platform: str
    username: str
    limit: int = Field(default=DEFAULT_VIDEOS_LIMIT, ge=1, le=MAX_VIDEOS_PER_LIST)


class VideoItem(BaseModel):
    videoId: str
    title: str
    url: str
    thumbnailUrl: Optional[str] = None
    durationSeconds: int
    publishedAt: str


class ListVideosResponse(BaseModel):
    videos: list[VideoItem]


class TranscribeRequest(BaseModel):
    platform: str
    videoUrl: str
    videoId: str
    language: str = "auto"
    model: Optional[str] = None


class SegmentItem(BaseModel):
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    language: str
    durationSeconds: float
    text: str
    segments: list[SegmentItem]


def require_api_key(authorization: Optional[str] = Header(default=None)) -> None:
    if not API_KEY:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if token != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.on_event("startup")
def on_startup() -> None:
    ensure_dirs()
    logger.info("Transcriber API starting")
    logger.info("Default model: %s (exists=%s)", DEFAULT_MODEL, model_exists(DEFAULT_MODEL))
    logger.info("Auth required: %s", bool(API_KEY))
    logger.info("Temp root: %s", TMP_ROOT)


@app.get("/")
def health() -> dict:
    return {
        "status": "ok",
        "service": "transcriber-api",
        "auth_required": bool(API_KEY),
        "default_model": DEFAULT_MODEL,
    }


@app.post(
    "/creator/validate",
    response_model=ValidateCreatorResponse,
    dependencies=[Depends(require_api_key)],
)
def creator_validate(payload: ValidateCreatorRequest) -> ValidateCreatorResponse:
    if not payload.username.strip():
        raise HTTPException(status_code=400, detail="username is required")

    try:
        info = validate_creator(payload.platform, payload.username)
    except YtdlpError as exc:
        raise HTTPException(status_code=exc.status_hint, detail=str(exc)) from exc

    return ValidateCreatorResponse(
        valid=info.valid,
        name=info.name,
        avatarUrl=info.avatar_url,
        errorMessage=info.error_message,
    )


@app.post(
    "/videos/list",
    response_model=ListVideosResponse,
    dependencies=[Depends(require_api_key)],
)
def videos_list(payload: ListVideosRequest) -> ListVideosResponse:
    if not payload.username.strip():
        raise HTTPException(status_code=400, detail="username is required")

    try:
        entries = list_creator_videos(
            platform=payload.platform,
            username=payload.username,
            limit=payload.limit,
        )
    except YtdlpError as exc:
        raise HTTPException(status_code=exc.status_hint, detail=str(exc)) from exc

    return ListVideosResponse(
        videos=[
            VideoItem(
                videoId=v.video_id,
                title=v.title,
                url=v.url,
                thumbnailUrl=v.thumbnail_url,
                durationSeconds=v.duration_seconds,
                publishedAt=v.published_at,
            )
            for v in entries
        ]
    )


@app.post(
    "/transcribe",
    response_model=TranscribeResponse,
    dependencies=[Depends(require_api_key)],
)
def transcribe(payload: TranscribeRequest) -> TranscribeResponse:
    if not payload.videoUrl.strip():
        raise HTTPException(status_code=400, detail="videoUrl is required")

    request_id = uuid.uuid4().hex[:12]
    work_dir = TMP_ROOT / f"job-{request_id}"
    model_name = (payload.model or DEFAULT_MODEL).strip().lower()

    logger.info(
        "Transcribe job %s | platform=%s videoId=%s model=%s",
        request_id,
        payload.platform,
        payload.videoId,
        model_name,
    )

    try:
        audio_path = download_audio(
            platform=payload.platform,
            video_url=payload.videoUrl,
            dest_dir=work_dir,
        )
    except YtdlpError as exc:
        _cleanup(work_dir)
        logger.warning("Job %s download failed: %s", request_id, exc)
        raise HTTPException(status_code=exc.status_hint, detail=str(exc)) from exc
    except Exception as exc:
        _cleanup(work_dir)
        logger.exception("Job %s download crashed", request_id)
        raise HTTPException(status_code=500, detail=f"Download error: {exc}") from exc

    try:
        result = run_transcription(
            audio_path=audio_path,
            language=payload.language or "auto",
            model=model_name,
        )
    except WhisperError as exc:
        _cleanup(work_dir)
        logger.warning("Job %s whisper failed: %s", request_id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        _cleanup(work_dir)
        logger.exception("Job %s whisper crashed", request_id)
        raise HTTPException(status_code=500, detail=f"Transcription error: {exc}") from exc

    response = TranscribeResponse(
        language=result.language,
        durationSeconds=result.duration_seconds,
        text=result.text,
        segments=[SegmentItem(**seg) for seg in segments_to_dicts(result.segments)],
    )

    _cleanup(work_dir)
    logger.info(
        "Job %s done | %d segments | %.1fs audio",
        request_id,
        len(response.segments),
        response.durationSeconds,
    )
    return response


@app.exception_handler(Exception)
def unhandled_exception_handler(_request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def _cleanup(folder: Path) -> None:
    try:
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)
    except Exception as exc:
        logger.warning("Cleanup failed for %s: %s", folder, exc)