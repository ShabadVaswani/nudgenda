export const MAX_RESTART_ATTEMPTS = 4;

const recoverableErrors = new Set(['busy', 'no-speech', 'speech-timeout']);

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function mergeFinalTranscript(completed: string, nextSegment: string) {
  const current = clean(completed);
  const next = clean(nextSegment);
  if (!next) return current;
  if (!current) return next;

  const currentLower = current.toLocaleLowerCase();
  const nextLower = next.toLocaleLowerCase();
  if (currentLower.endsWith(nextLower)) return current;
  if (nextLower.startsWith(currentLower)) return next;
  return `${current} ${next}`;
}

export function previewTranscript(completed: string, interim: string) {
  return mergeFinalTranscript(completed, interim);
}

export function isRecoverableSpeechError(code: string) {
  return recoverableErrors.has(code);
}

export function getSpeechRestartDelay(attempt: number) {
  return Math.min(2500, 450 * 2 ** Math.max(0, attempt));
}
