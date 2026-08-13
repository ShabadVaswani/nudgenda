import { File, Paths } from 'expo-file-system';

import type { ImportedContext } from '@/context/types';

const contextFile = () => new File(Paths.document, 'nudgenda-imported-context.json');

export async function loadImportedContext(): Promise<ImportedContext | undefined> {
  const file = contextFile();
  if (!file.exists) return undefined;
  try {
    return JSON.parse(await file.text()) as ImportedContext;
  } catch {
    return undefined;
  }
}

export async function saveImportedContext(context: ImportedContext) {
  const file = contextFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(context));
}

export async function clearImportedContext() {
  const file = contextFile();
  if (file.exists) file.delete();
}
