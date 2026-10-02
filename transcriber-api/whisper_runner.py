import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from config import (
    DEFAULT_MODEL,
    TRANSCRIBE_TIMEOUT_SECONDS,
    WHISPER_CLI,
    model_exists,
    resolve_model_path,
)
from srt_parser import SrtSegment, parse_srt, segments_to_text

logger = logging.getLogger(__name__)


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
    for code in ("en", "es", "fr", "de", "pt", "it", "ja", "ko", "zh", "ar", "hi", "ru"):
        if f"<{code}>" in lowered or f"[{code}]" in lowered:
            return code
    return fallback


def run_transcription(
    audio_path: Path,
    language: str = "auto",
    model: str = DEFAULT_MODEL,
    timeout_seconds: int = TRANSCRIBE_TIMEOUT_SECONDS,
) -> TranscriptionResult:
    if not audio_path.is_file():
        raise WhisperError(f"Audio file not found: {audio_path}")

    if shutil.which(WHISPER_CLI) is None:
        raise WhisperError(
            f"Whisper CLI '{WHISPER_CLI}' is not on PATH. Install or fix WHISPER_CLI."
        )

    if not model_exists(model):
        resolved = resolve_model_path(model)
        raise WhisperError(
            f"Whisper model '{model}' is not available at {resolved}. "
            "Download it first with: whisper <anyfile> --model <name>"
        )

    folder = audio_path.parent
    stem = audio_path.stem
    before = {p.name for p in folder.iterdir() if p.is_file()}

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

    logger.info("Running whisper: %s", " ".join(cli_args))
    started = time.monotonic()

    try:
        process = subprocess.run(
            cli_args,
            input="4\n",
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=str(folder),
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise WhisperError(
            f"Transcription timed out after {timeout_seconds}s."
        ) from exc
    except OSError as exc:
        raise WhisperError(f"Failed to launch whisper: {exc}") from exc

    elapsed = time.monotonic() - started
    logger.info("Whisper finished in %.1fs (exit %s)", elapsed, process.returncode)

    if process.returncode not in (0, 130):
        stderr_tail = (process.stderr or "")[-500:]
        stdout_tail = (process.stdout or "")[-500:]
        raise WhisperError(
            f"Whisper exited with code {process.returncode}. "
            f"stderr: {stderr_tail!r} stdout: {stdout_tail!r}"
        )

    after = {p.name for p in folder.iterdir() if p.is_file()}
    new_files = after - before

    srt_path = _find_output_file(folder, stem, ".srt")
    txt_path = _find_output_file(folder, stem, ".txt")

    if srt_path is None and txt_path is None:
        raise WhisperError(
            f"Whisper produced no output files. New files seen: {sorted(new_files)}"
        )

    segments: List[SrtSegment] = []
    if srt_path is not None:
        try:
            srt_content = srt_path.read_text(encoding="utf-8", errors="ignore")
            segments = parse_srt(srt_content)
        except OSError as exc:
            logger.warning("Could not read SRT file: %s", exc)

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

    duration = 0.0
    if segments:
        duration = max(seg.end for seg in segments)

    detected_language = language if language not in ("auto", "") else "en"
    if srt_path is not None:
        detected_language = _detect_language(srt_path, detected_language)

    return TranscriptionResult(
        language=detected_language,
        duration_seconds=duration,
        text=text,
        segments=segments,
    )