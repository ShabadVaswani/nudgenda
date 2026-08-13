import NudgendaPdfText from '../../modules/nudgenda-pdf-text';

export async function extractPdfText(uri: string, _data: ArrayBuffer) {
  try {
    return await NudgendaPdfText.extractTextAsync(uri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypted/i.test(message)) {
      throw new Error('Encrypted or password-protected PDFs are not supported.');
    }
    throw new Error('This PDF could not be read. It may be damaged or use unsupported encoding.');
  }
}
