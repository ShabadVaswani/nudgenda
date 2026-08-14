import type { MemoryState } from '@/memory/types';

const STORAGE_KEY = 'nudgenda.memory.v1';

export async function loadMemoryState(): Promise<MemoryState | undefined> {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as MemoryState) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveMemoryState(state: MemoryState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearMemoryState() {
  window.localStorage.removeItem(STORAGE_KEY);
}
