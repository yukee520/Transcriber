const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(prefix = 'id'): string {
  const timestamp = Date.now().toString(36);
  let random = '';
  for (let i = 0; i < 10; i += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${timestamp}${random}`;
}

export function generateCreatorId(): string {
  return generateId('cre');
}

export function generateTranscriptId(): string {
  return generateId('trs');
}