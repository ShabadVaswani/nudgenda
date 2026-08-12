import type { StoredAgentSettings } from '@/agent/openRouterStorage.types';

const STORAGE_KEY = 'nudgenda.openrouter.settings';

export async function loadAgentSettings(): Promise<StoredAgentSettings | undefined> {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as StoredAgentSettings) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveAgentSettings(settings: StoredAgentSettings) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function clearAgentSettings() {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}
