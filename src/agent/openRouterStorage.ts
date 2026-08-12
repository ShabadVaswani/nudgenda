import type { StoredAgentSettings } from '@/agent/openRouterStorage.types';

let memorySettings: StoredAgentSettings | undefined;

export async function loadAgentSettings() {
  return memorySettings;
}

export async function saveAgentSettings(settings: StoredAgentSettings) {
  memorySettings = settings;
}

export async function clearAgentSettings() {
  memorySettings = undefined;
}
