import type { ImportedContext } from '@/context/types';

const STORAGE_KEY = 'nudgenda.imported-context.v1';

export async function loadImportedContext(): Promise<ImportedContext | undefined> {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as ImportedContext) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveImportedContext(context: ImportedContext) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export async function clearImportedContext() {
  window.localStorage.removeItem(STORAGE_KEY);
}
