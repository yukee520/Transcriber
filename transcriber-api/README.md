# Transcriber API

Local HTTP transcription backend that powers the **Transcriber** Android app. Runs inside Termux on the same phone (or any other machine with the required binaries), wraps your existing `termux-whisper` CLI, and returns structured transcripts the app can store.

## What it does

- `POST /creator/validate` — check that a creator exists and get their display name
- `POST /videos/list` — list a creator's recent videos (fast, paginated)
- `POST /videos/titles` — fetch full titles + thumbnails + durations for a batch of videos
- `POST /transcribe` — download a video's audio, run Whisper, return the transcript with timestamps
- `GET /` — health check

All POST endpoints require `Authorization: Bearer <API_KEY>` when `API_KEY` is set.

## Requirements

Already installed on the reference device:

- Termux (Android 10+)
- `python` (3.11+), `python-pip`
- `ffmpeg`, `git`
- `python-yt-dlp` (via `pkg`)
- `deno` (for yt-dlp JS challenges)
- The `termux-whisper` project built at `~/termux-whisper`, with `whisper` on `PATH`
- Whisper models under `~/termux-whisper/whisper.cpp/models/` (at least `ggml-base.bin`)

Python packages (see `requirements.txt`):

```bash
pip install -r requirements.txt