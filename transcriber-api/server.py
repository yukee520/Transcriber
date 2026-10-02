import logging
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import (
    API_KEY,
    DEFAULT_MODEL,
    DEFAULT_VIDEOS_LIMIT,
    LOG_LEVEL,
    MAX_VIDEOS_PER_LIST,
    TITLES_MAX_BATCH,
    TMP_ROOT,
    TRANSCRIBE_TIMEOUT_SECONDS,
    ensure_dirs,
    model_exists,
)
from srt_parser import segments_to_dicts
from whisper_runner import WhisperError, run_transcription
from ytdlp_client import (
    YtdlpError,
    download_audio,
    fetch_titles_batch,
    list_creator_videos,
    validate_creator,
)
from bilibili_dynamic import BilibiliDynamicError, fetch_dynamic_videos

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("transcriber-api")

app = FastAPI(title="Transcriber API", version="1.4.0")

JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()
JOB_MAX_AGE_SECONDS = 60 * 60 * 24


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
    startIndex: int = Field(default=0, ge=0)


class VideoItem(BaseModel):
    videoId: str
    title: str
    url: str
    thumbnailUrl: Optional[str] = None
    durationSeconds: int
    publishedAt: str


class ListVideosResponse(BaseModel):
    videos: list[VideoItem]


class TitlesRequestItem(BaseModel):
    videoId: str
    url: str


class TitlesRequest(BaseModel):
    platform: str
    videos: list[TitlesRequestItem] = Field(..., max_length=TITLES_MAX_BATCH)


class VideoTitleItem(BaseModel):
    videoId: str
    title: str
    thumbnailUrl: Optional[str] = None
    durationSeconds: int
    publishedAt: str
    error: Optional[str] = None


class TitlesResponse(BaseModel):
    titles: list[VideoTitleItem]


class DynamicVideosRequest(BaseModel):
    uid: str = Field(..., min_length=1)
    limit: int = Field(default=100, ge=1, le=500)
    offset: Optional[str] = None


class DynamicVideosResponse(BaseModel):
    videos: list[VideoItem]
    nextOffset: Optional[str] = None
    hasMore: bool = False


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
    title: Optional[str] = None
    text: str
    segments: list[SegmentItem]


class TranscribeStartRequest(BaseModel):
    platform: str
    videoUrl: str
    videoId: str
    language: str = "auto"
    model: Optional[str] = None


class TranscribeStartResponse(BaseModel):
    jobId: str
    status: str


class TranscribeStatusResponse(BaseModel):
    jobId: str
    status: str
    phase: Optional[str] = None
    progress: float = 0.0
    message: Optional[str] = None
    startedAt: Optional[float] = None
    finishedAt: Optional[float] = None
    language: Optional[str] = None
    durationSeconds: Optional[float] = None
    title: Optional[str] = None
    text: Optional[str] = None
    segments: Optional[list[SegmentItem]] = None
    error: Optional[str] = None


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


def _now() -> float:
    return time.time()


def _make_job(payload: TranscribeStartRequest) -> str:
    job_id = uuid.uuid4().hex[:12]
    with JOBS_LOCK:
        JOBS[job_id] = {
            "jobId": job_id,
            "status": "queued",
            "phase": "queued",
            "progress": 0.0,
            "message": "Queued",
            "startedAt": None,
            "finishedAt": None,
            "language": None,
            "durationSeconds": None,
            "title": None,
            "text": None,
            "segments": None,
            "error": None,
            "request": payload.dict(),
        }
    return job_id


def _update_job(job_id: str, **fields: Any) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return
        job.update(fields)


def _finalize_job(job_id: str, status: str, **fields: Any) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return
        job.update(fields)
        job["status"] = status
        if job.get("startedAt") and not job.get("finishedAt"):
            job["finishedAt"] = _now()


def _purge_old_jobs() -> None:
    cutoff = _now() - JOB_MAX_AGE_SECONDS
    with JOBS_LOCK:
        stale = [
            jid
            for jid, job in JOBS.items()
            if (job.get("finishedAt") or job.get("startedAt") or _now()) < cutoff
        ]
        for jid in stale:
            JOBS.pop(jid, None)


def _run_job(job_id: str) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return
        payload = dict(job.get("request") or {})

    platform = str(payload.get("platform") or "")
    video_url = str(payload.get("videoUrl") or "")
    video_id = str(payload.get("videoId") or "")
    language = str(payload.get("language") or "auto")
    model_name = (payload.get("model") or DEFAULT_MODEL).strip().lower()

    work_dir = TMP_ROOT / f"job-{job_id}"
    started = _now()

    _update_job(
        job_id,
        status="running",
        phase="download",
        progress=5.0,
        message="Downloading audio…",
        startedAt=started,
    )

    logger.info(
        "Async job %s | platform=%s videoId=%s model=%s",
        job_id,
        platform,
        video_id,
        model_name,
    )

    try:
        download = download_audio(
            platform=platform,
            video_url=video_url,
            dest_dir=work_dir,
        )
    except YtdlpError as exc:
        _cleanup(work_dir)
        _finalize_job(
            job_id,
            "failed",
            phase="download",
            progress=0.0,
            message="Download failed",
            error=str(exc),
            finishedAt=_now(),
        )
        logger.warning("Async job %s download failed: %s", job_id, exc)
        return
    except Exception as exc:
        _cleanup(work_dir)
        _finalize_job(
            job_id,
            "failed",
            phase="download",
            progress=0.0,
            message="Download error",
            error=str(exc),
            finishedAt=_now(),
        )
        logger.exception("Async job %s download crashed", job_id)
        return

    _update_job(
        job_id,
        phase="transcribe",
        progress=25.0,
        message="Transcribing…",
        title=download.title or None,
    )

    try:
        result = run_transcription(
            audio_path=download.audio_path,
            language=language,
            model=model_name,
            timeout_seconds=TRANSCRIBE_TIMEOUT_SECONDS,
        )
    except WhisperError as exc:
        _cleanup(work_dir)
        _finalize_job(
            job_id,
            "failed",
            phase="transcribe",
            progress=25.0,
            message="Whisper failed",
            error=str(exc),
            finishedAt=_now(),
        )
        logger.warning("Async job %s whisper failed: %s", job_id, exc)
        return
    except Exception as exc:
        _cleanup(work_dir)
        _finalize_job(
            job_id,
            "failed",
            phase="transcribe",
            progress=25.0,
            message="Transcription error",
            error=str(exc),
            finishedAt=_now(),
        )
        logger.exception("Async job %s whisper crashed", job_id)
        return

    segments = segments_to_dicts(result.segments)

    _cleanup(work_dir)

    _finalize_job(
        job_id,
        "done",
        phase="done",
        progress=100.0,
        message="Complete",
        language=result.language,
        durationSeconds=result.duration_seconds,
        title=download.title or None,
        text=result.text,
        segments=segments,
        finishedAt=_now(),
    )

    logger.info(
        "Async job %s done | %d segments | %.1fs audio | title=%r",
        job_id,
        len(segments),
        result.duration_seconds,
        (download.title or "")[:60],
    )


def _job_public_view(job: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "jobId": job.get("jobId"),
        "status": job.get("status"),
        "phase": job.get("phase"),
        "progress": float(job.get("progress") or 0.0),
        "message": job.get("message"),
        "startedAt": job.get("startedAt"),
        "finishedAt": job.get("finishedAt"),
        "language": job.get("language"),
        "durationSeconds": job.get("durationSeconds"),
        "title": job.get("title"),
        "text": job.get("text"),
        "segments": job.get("segments"),
        "error": job.get("error"),
    }


@app.on_event("startup")
def on_startup() -> None:
    ensure_dirs()
    logger.info("Transcriber API starting (async-enabled)")
    logger.info("Default model: %s (exists=%s)", DEFAULT_MODEL, model_exists(DEFAULT_MODEL))
    logger.info("Auth required: %s", bool(API_KEY))
    logger.info("Temp root: %s", TMP_ROOT)


@app.get("/")
def health() -> dict:
    with JOBS_LOCK:
        active = sum(1 for j in JOBS.values() if j.get("status") == "running")
        queued = sum(1 for j in JOBS.values() if j.get("status") == "queued")
    return {
        "status": "ok",
        "service": "transcriber-api",
        "version": "1.4.0",
        "auth_required": bool(API_KEY),
        "default_model": DEFAULT_MODEL,
        "active_jobs": active,
        "queued_jobs": queued,
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
            start_index=payload.startIndex,
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
    "/videos/titles",
    response_model=TitlesResponse,
    dependencies=[Depends(require_api_key)],
)
def videos_titles(payload: TitlesRequest) -> TitlesResponse:
    if not payload.videos:
        return TitlesResponse(titles=[])

    items = [(v.videoId, v.url) for v in payload.videos]

    try:
        details_map = fetch_titles_batch(payload.platform, items)
    except Exception as exc:
        logger.exception("Batch title fetch crashed")
        raise HTTPException(status_code=502, detail=f"Title fetch failed: {exc}") from exc

    out: list[VideoTitleItem] = []
    for video_id, _ in items:
        d = details_map.get(video_id)
        if d is None:
            out.append(
                VideoTitleItem(
                    videoId=video_id,
                    title="",
                    thumbnailUrl=None,
                    durationSeconds=0,
                    publishedAt="",
                    error="no result",
                )
            )
            continue
        out.append(
            VideoTitleItem(
                videoId=d.video_id or video_id,
                title=d.title or "",
                thumbnailUrl=d.thumbnail_url,
                durationSeconds=d.duration_seconds,
                publishedAt=d.published_at,
                error=d.error,
            )
        )

    return TitlesResponse(titles=out)


@app.post(
    "/videos/dynamic",
    response_model=DynamicVideosResponse,
    dependencies=[Depends(require_api_key)],
)
def videos_dynamic(payload: DynamicVideosRequest) -> DynamicVideosResponse:
    if not payload.uid.strip():
        raise HTTPException(status_code=400, detail="uid is required")

    start_offset = (payload.offset or "").strip()

    try:
        result = fetch_dynamic_videos(
            uid=payload.uid.strip(),
            limit=payload.limit,
            start_offset=start_offset,
        )
    except BilibiliDynamicError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Dynamic feed crashed")
        raise HTTPException(
            status_code=500,
            detail=f"Dynamic feed error: {exc}",
        ) from exc

    return DynamicVideosResponse(
        videos=[
            VideoItem(
                videoId=v.video_id,
                title=v.title,
                url=v.url,
                thumbnailUrl=v.thumbnail_url,
                durationSeconds=v.duration_seconds,
                publishedAt=v.published_at,
            )
            for v in result.videos
        ],
        nextOffset=result.next_offset,
        hasMore=result.has_more,
    )


@app.post(
    "/transcribe/start",
    response_model=TranscribeStartResponse,
    dependencies=[Depends(require_api_key)],
)
def transcribe_start(payload: TranscribeStartRequest) -> TranscribeStartResponse:
    if not payload.videoUrl.strip():
        raise HTTPException(status_code=400, detail="videoUrl is required")
    if not payload.videoId.strip():
        raise HTTPException(status_code=400, detail="videoId is required")

    _purge_old_jobs()

    job_id = _make_job(payload)
    thread = threading.Thread(
        target=_run_job,
        args=(job_id,),
        daemon=True,
        name=f"transcribe-{job_id}",
    )
    thread.start()

    logger.info("Queued job %s | videoId=%s", job_id, payload.videoId)

    return TranscribeStartResponse(jobId=job_id, status="queued")


@app.get(
    "/transcribe/status/{job_id}",
    response_model=TranscribeStatusResponse,
    dependencies=[Depends(require_api_key)],
)
def transcribe_status(job_id: str) -> TranscribeStatusResponse:
    with JOBS_LOCK:
        job = JOBS.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    view = _job_public_view(job)

    segments_raw = view.get("segments")
    segments = None
    if isinstance(segments_raw, list):
        segments = [SegmentItem(**seg) for seg in segments_raw]

    return TranscribeStatusResponse(
        jobId=str(view.get("jobId") or job_id),
        status=str(view.get("status") or "unknown"),
        phase=view.get("phase"),
        progress=float(view.get("progress") or 0.0),
        message=view.get("message"),
        startedAt=view.get("startedAt"),
        finishedAt=view.get("finishedAt"),
        language=view.get("language"),
        durationSeconds=view.get("durationSeconds"),
        title=view.get("title"),
        text=view.get("text"),
        segments=segments,
        error=view.get("error"),
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
        "Sync transcribe job %s | platform=%s videoId=%s model=%s",
        request_id,
        payload.platform,
        payload.videoId,
        model_name,
    )

    try:
        download = download_audio(
            platform=payload.platform,
            video_url=payload.videoUrl,
            dest_dir=work_dir,
        )
    except YtdlpError as exc:
        _cleanup(work_dir)
        raise HTTPException(status_code=exc.status_hint, detail=str(exc)) from exc
    except Exception as exc:
        _cleanup(work_dir)
        raise HTTPException(status_code=500, detail=f"Download error: {exc}") from exc

    try:
        result = run_transcription(
            audio_path=download.audio_path,
            language=payload.language or "auto",
            model=model_name,
        )
    except WhisperError as exc:
        _cleanup(work_dir)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        _cleanup(work_dir)
        raise HTTPException(status_code=500, detail=f"Transcription error: {exc}") from exc

    response = TranscribeResponse(
        language=result.language,
        durationSeconds=result.duration_seconds,
        title=download.title or None,
        text=result.text,
        segments=[SegmentItem(**seg) for seg in segments_to_dicts(result.segments)],
    )

    _cleanup(work_dir)
    logger.info(
        "Sync job %s done | %d segments | %.1fs audio",
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