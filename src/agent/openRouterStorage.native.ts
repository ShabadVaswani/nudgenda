import * as SecureStore from 'expo-secure-store';

import type { StoredAgentSettings } from '@/agent/openRouterStorage.types';

const STORAGE_KEY = 'nudgenda.openrouter.settings';

export async function loadAgentSettings(): Promise<StoredAgentSettings | undefined> {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  return value ? (JSON.parse(value) as StoredAgentSettings) : undefined;
}

export async function saveAgentSettings(settings: StoredAgentSettings) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings));
}

export async function clearAgentSettings() {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
