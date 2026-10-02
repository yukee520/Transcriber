import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional

from config import (
    CHUNK_ENABLED,
    CHUNK_MIN_TAIL_SECONDS,
    CHUNK_OVERLAP_SECONDS,
    CHUNK_SIZE_SECONDS,
    CHUNK_THRESHOLD_SECONDS,
    DEFAULT_MODEL,
    FFMPEG_BIN,
    FFPROBE_BIN,
    TRANSCRIBE_TIMEOUT_SECONDS,
    WHISPER_CLI,
    model_exists,
    resolve_model_path,
)
from srt_parser import SrtSegment, parse_srt, segments_to_text

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[float, str], None]


class WhisperError(RuntimeError):
    pass


@dataclass
class TranscriptionResult:
    language: str
    duration_seconds: float
    text: str
    segments: List[SrtSegment]


def _find_output_file(folder: Path, stem: str, extension: str) -> Optional[Path]:
    candidates = [
        folder / f"{stem}{extension}",
        folder / f"{stem}_TRANSCRIPT{extension}",
        folder / f"{stem}.transcript{extension}",
    ]
    for candidate in candidates:
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate

    for candidate in folder.glob(f"{stem}*{extension}"):
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate

    return None


def _detect_language(srt_path: Path, fallback: str) -> str:
    try:
        with srt_path.open("r", encoding="utf-8", errors="ignore") as handle:
            head = handle.read(2048)
    except OSError:
        return fallback

    lowered = head.lower()
    for code in (
        "en", "es", "fr", "de", "pt", "it",
        "ja", "ko", "zh", "ar", "hi", "ru",
    ):
        if f"<{code}>" in lowered or f"[{code}]" in lowered:
            return code
    return fallback


def _require_binary(name: str, friendly_name: str) -> None:
    if shutil.which(name) is None:
        raise WhisperError(
            f"{friendly_name} ('{name}') is not on PATH. Install it or fix "
            f"the corresponding env var."
        )


def _probe_duration(audio_path: Path) -> float:
    _require_binary(FFPROBE_BIN, "ffprobe")

    try:
        result = subprocess.run(
            [
                FFPROBE_BIN,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired as exc:
        raise WhisperError(f"ffprobe timed out reading {audio_path.name}") from exc
    except OSError as exc:
        raise WhisperError(f"Failed to run ffprobe: {exc}") from exc

    if result.returncode != 0:
        raise WhisperError(
            f"ffprobe failed: {(result.stderr or '').strip()[:200]}"
        )

    raw = (result.stdout or "").strip().splitlines()
    if not raw:
        raise WhisperError("ffprobe returned no duration.")

    try:
        return float(raw[0])
    except ValueError as exc:
        raise WhisperError(f"ffprobe returned invalid duration: {raw[0]!r}") from exc


def _run_whisper_on_file(
    audio_path: Path,
    language: str,
    model: str,
    timeout_seconds: int,
    work_dir: Path,
) -> Path:
    stem = audio_path.stem
    before = {p.name for p in work_dir.iterdir() if p.is_file()}

    cli_args = [
        WHISPER_CLI,
        str(audio_path),
        "--model",
        model,
        "--no-paragraphs",
        "--subs",
    ]

    env = os.environ.copy()
    env.setdefault("TERM", "dumb")
    env.setdefault("NO_COLOR", "1")

    logger.info("Running whisper on %s", audio_path.name)

    try:
        process = subprocess.run(
            cli_args,
            input="4\n",
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=str(work_dir),
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise WhisperError(
            f"Whisper timed out after {timeout_seconds}s on {audio_path.name}"
        ) from exc
    except OSError as exc:
        raise WhisperError(f"Failed to launch whisper: {exc}") from exc

    if process.returncode not in (0, 130):
        stderr_tail = (process.stderr or "")[-500:]
        stdout_tail = (process.stdout or "")[-500:]
        raise WhisperError(
            f"Whisper exited with code {process.returncode} on {audio_path.name}. "
            f"stderr: {stderr_tail!r} stdout: {stdout_tail!r}"
        )

    after = {p.name for p in work_dir.iterdir() if p.is_file()}
    new_files = after - before

    srt_path = _find_output_file(work_dir, stem, ".srt")
    if srt_path is None:
        raise WhisperError(
            f"Whisper produced no SRT for {audio_path.name}. "
            f"New files seen: {sorted(new_files)}"
        )

    return srt_path


def _read_srt_segments(srt_path: Path) -> List[SrtSegment]:
    try:
        content = srt_path.read_text(encoding="utf-8", errors="ignore")
    except OSError as exc:
        raise WhisperError(f"Could not read {srt_path.name}: {exc}") from exc
    return parse_srt(content)


def _offset_segments(
    segments: List[SrtSegment], offset_seconds: float
) -> List[SrtSegment]:
    if offset_seconds == 0:
        return segments
    return [
        SrtSegment(
            start=seg.start + offset_seconds,
            end=seg.end + offset_seconds,
            text=seg.text,
        )
        for seg in segments
    ]


def _dedupe_overlap_segments(
    previous: List[SrtSegment],
    current: List[SrtSegment],
    overlap_seconds: float,
) -> List[SrtSegment]:
    """Drop segments from `current` that clearly duplicate the tail of `previous`."""
    if not previous or not current or overlap_seconds <= 0:
        return current

    prev_tail = previous[-1]
    trimmed: List[SrtSegment] = []

    for seg in current:
        # If the segment starts before the previous chunk's end and its
        # text overlaps significantly, we assume whisper re-transcribed
        # the overlap and skip it.
        if seg.start < prev_tail.end and seg.end <= prev_tail.end + 1.0:
            prev_text = prev_tail.text.strip().lower()
            cur_text = seg.text.strip().lower()
            if prev_text and cur_text and (
                prev_text in cur_text
                or cur_text in prev_text
                or _word_overlap_ratio(prev_text, cur_text) > 0.5
            ):
                continue
        trimmed.append(seg)

    return trimmed


def _word_overlap_ratio(a: str, b: str) -> float:
    a_words = set(a.split())
    b_words = set(b.split())
    if not a_words or not b_words:
        return 0.0
    common = a_words & b_words
    return len(common) / max(len(a_words), len(b_words))


def _build_chunks(
    audio_path: Path,
    work_dir: Path,
    duration: float,
    progress: Optional[ProgressCallback],
) -> List[tuple[Path, float]]:
    """Split audio into chunks. Returns list of (chunk_path, offset_seconds)."""
    _require_binary(FFMPEG_BIN, "ffmpeg")

    chunks_dir = work_dir / "chunks"
    if chunks_dir.exists():
        shutil.rmtree(chunks_dir, ignore_errors=True)
    chunks_dir.mkdir(parents=True, exist_ok=True)

    step = CHUNK_SIZE_SECONDS - CHUNK_OVERLAP_SECONDS
    if step <= 0:
        raise WhisperError(
            f"CHUNK_SIZE_SECONDS ({CHUNK_SIZE_SECONDS}) must be larger than "
            f"CHUNK_OVERLAP_SECONDS ({CHUNK_OVERLAP_SECONDS})."
        )

    chunk_paths: List[tuple[Path, float]] = []
    offset = 0.0
    index = 0

    while offset < duration:
        remaining = duration - offset
        if remaining <= CHUNK_MIN_TAIL_SECONDS and chunk_paths:
            break

        length = min(CHUNK_SIZE_SECONDS, remaining)
        out_path = chunks_dir / f"chunk_{index:04d}.mp3"

        try:
            result = subprocess.run(
                [
                    FFMPEG_BIN,
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    f"{offset:.3f}",
                    "-t",
                    f"{length:.3f}",
                    "-i",
                    str(audio_path),
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    "-b:a",
                    "64k",
                    str(out_path),
                ],
                capture_output=True,
                text=True,
                timeout=180,
            )
        except subprocess.TimeoutExpired as exc:
            raise WhisperError(
                f"ffmpeg timed out creating chunk {index}"
            ) from exc
        except OSError as exc:
            raise WhisperError(f"Failed to run ffmpeg: {exc}") from exc

        if result.returncode != 0 or not out_path.is_file():
            raise WhisperError(
                f"ffmpeg failed creating chunk {index}: "
                f"{(result.stderr or '').strip()[:200]}"
            )

        chunk_paths.append((out_path, offset))
        if progress:
            progress(
                25.0 + (offset / max(duration, 1.0)) * 10.0,
                f"Splitting audio ({index + 1} chunks so far)…",
            )

        index += 1
        offset += step

    if not chunk_paths:
        raise WhisperError("No chunks were produced from the audio file.")

    logger.info(
        "Split %s (%.1fs) into %d chunks",
        audio_path.name,
        duration,
        len(chunk_paths),
    )
    return chunk_paths


def _chunked_transcribe(
    audio_path: Path,
    work_dir: Path,
    duration: float,
    language: str,
    model: str,
    timeout_seconds: int,
    progress: Optional[ProgressCallback],
) -> TranscriptionResult:
    chunks = _build_chunks(audio_path, work_dir, duration, progress)

    total = len(chunks)
    all_segments: List[SrtSegment] = []
    detected_language = language if language not in ("auto", "") else "en"

    per_chunk_timeout = max(120, min(timeout_seconds, 600))

    for i, (chunk_path, offset) in enumerate(chunks):
        if progress:
            base_pct = 35.0
            span_pct = 60.0
            chunk_pct = base_pct + (i / max(total, 1)) * span_pct
            progress(
                chunk_pct,
                f"Transcribing chunk {i + 1}/{total}…",
            )

        try:
            srt_path = _run_whisper_on_file(
                audio_path=chunk_path,
                language=language,
                model=model,
                timeout_seconds=per_chunk_timeout,
                work_dir=work_dir,
            )
        except WhisperError as exc:
            raise WhisperError(
                f"Chunk {i + 1}/{total} failed: {exc}"
            ) from exc

        chunk_segments = _read_srt_segments(srt_path)
        chunk_segments = _offset_segments(chunk_segments, offset)

        if i > 0:
            chunk_segments = _dedupe_overlap_segments(
                all_segments, chunk_segments, CHUNK_OVERLAP_SECONDS
            )

        all_segments.extend(chunk_segments)

        if i == 0 and srt_path is not None:
            detected_language = _detect_language(srt_path, detected_language)

    if progress:
        progress(95.0, "Merging chunks…")

    if not all_segments:
        raise WhisperError("No segments were produced by any chunk.")

    merged_text = segments_to_text(all_segments)
    if not merged_text:
        merged_text = "[No speech detected]"

    return TranscriptionResult(
        language=detected_language,
        duration_seconds=duration,
        text=merged_text,
        segments=all_segments,
    )


def _single_pass_transcribe(
    audio_path: Path,
    work_dir: Path,
    duration: float,
    language: str,
    model: str,
    timeout_seconds: int,
    progress: Optional[ProgressCallback],
) -> TranscriptionResult:
    if progress:
        progress(35.0, "Transcribing…")

    srt_path = _run_whisper_on_file(
        audio_path=audio_path,
        language=language,
        model=model,
        timeout_seconds=timeout_seconds,
        work_dir=work_dir,
    )

    segments = _read_srt_segments(srt_path)

    txt_path = _find_output_file(work_dir, audio_path.stem, ".txt")
    text = ""
    if txt_path is not None:
        try:
            text = txt_path.read_text(encoding="utf-8", errors="ignore").strip()
        except OSError as exc:
            logger.warning("Could not read TXT file: %s", exc)

    if not text and segments:
        text = segments_to_text(segments)

    if not text:
        text = "[No speech detected]"

    detected_language = language if language not in ("auto", "") else "en"
    detected_language = _detect_language(srt_path, detected_language)

    return TranscriptionResult(
        language=detected_language,
        duration_seconds=duration,
        text=text,
        segments=segments,
    )


def run_transcription(
    audio_path: Path,
    language: str = "auto",
    model: str = DEFAULT_MODEL,
    timeout_seconds: int = TRANSCRIBE_TIMEOUT_SECONDS,
    progress: Optional[ProgressCallback] = None,
) -> TranscriptionResult:
    if not audio_path.is_file():
        raise WhisperError(f"Audio file not found: {audio_path}")

    _require_binary(WHISPER_CLI, "whisper")

    if not model_exists(model):
        resolved = resolve_model_path(model)
        raise WhisperError(
            f"Whisper model '{model}' is not available at {resolved}. "
            "Download it first with: whisper <anyfile> --model <name>"
        )

    work_dir = audio_path.parent

    duration = _probe_duration(audio_path)

    if progress:
        progress(20.0, f"Audio is {duration:.0f}s")

    should_chunk = (
        CHUNK_ENABLED
        and duration >= CHUNK_THRESHOLD_SECONDS
    )

    if should_chunk:
        logger.info(
            "Chunked transcription: %.1fs >= threshold %ss",
            duration,
            CHUNK_THRESHOLD_SECONDS,
        )
        return _chunked_transcribe(
            audio_path=audio_path,
            work_dir=work_dir,
            duration=duration,
            language=language,
            model=model,
            timeout_seconds=timeout_seconds,
            progress=progress,
        )

    logger.info(
        "Single-pass transcription: %.1fs < threshold %ss",
        duration,
        CHUNK_THRESHOLD_SECONDS,
    )
    return _single_pass_transcribe(
        audio_path=audio_path,
        work_dir=work_dir,
        duration=duration,
        language=language,
        model=model,
        timeout_seconds=timeout_seconds,
        progress=progress,
    )