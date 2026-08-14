import { File, Paths } from 'expo-file-system';

import type { MemoryState } from '@/memory/types';

const memoryFile = () => new File(Paths.document, 'nudgenda-memory-v1.json');

export async function loadMemoryState(): Promise<MemoryState | undefined> {
  const file = memoryFile();
  if (!file.exists) return undefined;
  try {
    return JSON.parse(await file.text()) as MemoryState;
  } catch {
    return undefined;
  }
}

export async function saveMemoryState(state: MemoryState) {
  const file = memoryFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(state));
}

export async function clearMemoryState() {
  const file = memoryFile();
  if (file.exists) file.delete();
}
