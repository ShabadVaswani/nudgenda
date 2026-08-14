import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import { runContextNotebookPipeline } from '../src/context/contextNotebookPipeline.ts';

const [
  ,
  ,
  sourcePath,
  filterModel = 'qwen/qwen3.7-flash',
  writerModel = 'deepseek/deepseek-v3.2',
] = process.argv;

if (!sourcePath) {
  throw new Error(
    'Usage: node --experimental-strip-types scripts/evaluate-context-notebook.mjs <source> [filter-model] [writer-model]',
  );
}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('Set OPENROUTER_API_KEY for this one evaluation process.');

const text = await readFile(sourcePath, 'utf8');
const report = await runContextNotebookPipeline({
  apiKey,
  filterModel,
  onProgress: (message) => process.stderr.write(`${message}\n`),
  sourceName: basename(sourcePath),
  text,
  writerModel,
});
const safeModelName = filterModel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
const reportPath = join(tmpdir(), `nudgenda-notebook-${safeModelName}-${Date.now()}.json`);
const notebookPath = join(tmpdir(), `nudgenda-notebook-${safeModelName}-${Date.now()}.md`);
await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
await writeFile(notebookPath, report.notebook, 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      costUsd: (report.filterUsage.costUsd ?? 0) + (report.writerUsage.costUsd ?? 0),
      filterModel: report.filterModel,
      filterUsage: report.filterUsage,
      notebookPath,
      originalCharacters: report.originalCharacters,
      reportPath,
      selectedEvidenceCount: report.selectedEvidenceCount,
      writerModel: report.writerModel,
      writerUsage: report.writerUsage,
    },
    null,
    2,
  )}\n\n${report.notebook}\n`,
);
