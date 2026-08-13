import type { DocumentPickerAsset } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { extractPdfText } from '@/context/pdfText';
import {
  extractJsonText,
  MAX_IMPORT_BYTES,
  normalizeImportedText,
} from '@/context/structure';

const supportedExtensions = new Set(['json', 'md', 'pdf', 'txt']);

function extensionOf(name: string) {
  return name.split('.').pop()?.toLocaleLowerCase() ?? '';
}

async function readText(asset: DocumentPickerAsset) {
  if (asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

async function readBytes(asset: DocumentPickerAsset) {
  if (asset.file) return asset.file.arrayBuffer();
  return new File(asset.uri).arrayBuffer();
}

async function discardTemporaryCopy(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web') return;
  try {
    const file = new File(asset.uri);
    if (file.exists) file.delete();
  } catch {
    // The picker copy is already in the app cache; cleanup is best effort.
  }
}

export async function extractPickedDocument(asset: DocumentPickerAsset) {
  const extension = extensionOf(asset.name);
  if (!supportedExtensions.has(extension)) {
    throw new Error('Choose a TXT, Markdown, JSON, or PDF file.');
  }
  if (asset.size && asset.size > MAX_IMPORT_BYTES) {
    throw new Error('This file is too large. Choose one under 5 MB.');
  }

  try {
    if (extension === 'pdf') {
      const text = await extractPdfText(asset.uri, await readBytes(asset));
      try {
        return normalizeImportedText(text);
      } catch {
        throw new Error('No readable text was found. Image-only PDFs need OCR and are not supported yet.');
      }
    }

    const raw = await readText(asset);
    return extension === 'json' ? extractJsonText(raw) : normalizeImportedText(raw);
  } finally {
    await discardTemporaryCopy(asset);
  }
}
