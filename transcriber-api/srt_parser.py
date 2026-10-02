import re
from dataclasses import dataclass
from typing import List

TIMESTAMP_PATTERN = re.compile(
    r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})"
)


@dataclass
class SrtSegment:
    start: float
    end: float
    text: str


def _to_seconds(hours: str, minutes: str, seconds: str, millis: str) -> float:
    h = int(hours)
    m = int(minutes)
    s = int(seconds)
    ms_str = millis.ljust(3, "0")[:3]
    ms = int(ms_str)
    return h * 3600 + m * 60 + s + ms / 1000.0


def parse_srt(content: str) -> List[SrtSegment]:
    if not content or not content.strip():
        return []

    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split(r"\n\s*\n", normalized.strip())

    segments: List[SrtSegment] = []
    for block in blocks:
        lines = [line for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        time_line_index = -1
        for i, line in enumerate(lines):
            if "-->" in line:
                time_line_index = i
                break

        if time_line_index == -1:
            continue

        time_line = lines[time_line_index]
        match = TIMESTAMP_PATTERN.search(time_line)
        if not match:
            continue

        start = _to_seconds(match.group(1), match.group(2), match.group(3), match.group(4))
        end = _to_seconds(match.group(5), match.group(6), match.group(7), match.group(8))

        text_lines = lines[time_line_index + 1:]
        text = " ".join(text_lines).strip()

        if not text:
            continue

        segments.append(SrtSegment(start=start, end=end, text=text))

    return segments


def segments_to_text(segments: List[SrtSegment]) -> str:
    if not segments:
        return ""
    joined = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
    return re.sub(r"\s+", " ", joined).strip()


def segments_to_dicts(segments: List[SrtSegment]) -> List[dict]:
    return [
        {"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text}
        for seg in segments
    ]