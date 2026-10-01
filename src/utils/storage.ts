import RNFS from 'react-native-fs';
import type { Transcript } from '@/types/transcript';

const TRANSCRIPTS_DIR = `${RNFS.DocumentDirectoryPath}/transcripts`;

export async function ensureTranscriptsDir(): Promise<void> {
  const exists = await RNFS.exists(TRANSCRIPTS_DIR);
  if (!exists) {
    await RNFS.mkdir(TRANSCRIPTS_DIR);
  }
}

export function getTranscriptPath(transcriptId: string): string {
  return `${TRANSCRIPTS_DIR}/${transcriptId}.txt`;
}

export function getTranscriptPathRaw(transcriptId: string): string {
  return getTranscriptPath(transcriptId);
}

export async function saveTranscriptFile(
  transcript: Transcript,
): Promise<string> {
  await ensureTranscriptsDir();
  const path = getTranscriptPath(transcript.id);
  const header = [
    `Title: ${transcript.videoTitle}`,
    `Creator: ${transcript.creatorName} (@${transcript.creatorUsername})`,
    `Platform: ${transcript.platform}`,
    `Video URL: ${transcript.videoUrl}`,
    `Language: ${transcript.language}`,
    `Duration: ${transcript.durationSeconds}s`,
    `Created: ${transcript.createdAt}`,
    '',
    '--- Transcript ---',
    '',
  ].join('\n');
  const body = transcript.segments.length
    ? transcript.segments
        .map((seg) => `[${formatStamp(seg.start)}] ${seg.text}`)
        .join('\n')
    : transcript.text;
  await RNFS.writeFile(path, `${header}${body}\n`, 'utf8');
  return path;
}

export async function readTranscriptFile(
  transcriptId: string,
): Promise<string | null> {
  const path = getTranscriptPath(transcriptId);
  const exists = await RNFS.exists(path);
  if (!exists) return null;
  return RNFS.readFile(path, 'utf8');
}

export async function deleteTranscriptFile(transcriptId: string): Promise<void> {
  const path = getTranscriptPath(transcriptId);
  const exists = await RNFS.exists(path);
  if (exists) {
    await RNFS.unlink(path);
  }
}

export async function deleteAllTranscriptFiles(): Promise<void> {
  const exists = await RNFS.exists(TRANSCRIPTS_DIR);
  if (exists) {
    await RNFS.unlink(TRANSCRIPTS_DIR);
  }
}

export async function getTranscriptsDirSize(): Promise<number> {
  const exists = await RNFS.exists(TRANSCRIPTS_DIR);
  if (!exists) return 0;
  try {
    const files = await RNFS.readDir(TRANSCRIPTS_DIR);
    let total = 0;
    for (const file of files) {
      if (file.isFile()) {
        const stat = await RNFS.stat(file.path);
        const size = Number(stat.size);
        if (Number.isFinite(size)) total += size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function formatStamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}