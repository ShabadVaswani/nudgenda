import type { MemoryState } from '@/memory/types';

export type MemoryStorage = {
  clearMemoryState: () => Promise<void>;
  loadMemoryState: () => Promise<MemoryState | undefined>;
  saveMemoryState: (state: MemoryState) => Promise<void>;
};
