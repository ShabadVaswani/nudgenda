export async function extractPdfText(_uri: string, data: ArrayBuffer) {
  const { getDocument } = await import('pdfjs-dist/webpack.mjs');
  const task = getDocument({ data: new Uint8Array(data) });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        pageText += item.str;
        pageText += item.hasEOL ? '\n' : ' ';
      }
      pages.push(pageText.trim());
      page.cleanup();
    }
    return pages.filter(Boolean).join('\n\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) {
      throw new Error('Encrypted or password-protected PDFs are not supported.');
    }
    throw new Error('This PDF could not be read. It may be damaged or use unsupported encoding.');
  } finally {
    await task.destroy();
  }
}
