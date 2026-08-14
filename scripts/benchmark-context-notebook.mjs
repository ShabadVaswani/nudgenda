import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import {
  benchmarkContextNotebook,
  formatContextNotebookBenchmark,
} from '../src/context/contextNotebookBenchmark.ts';

const [, , reportPath] = process.argv;
if (!reportPath) {
  throw new Error(
    'Usage: node --experimental-strip-types scripts/benchmark-context-notebook.mjs <notebook-report.json>',
  );
}
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const result = benchmarkContextNotebook(report);
const output = formatContextNotebookBenchmark(result);
const outputPath = join(dirname(reportPath), `${basename(reportPath, '.json')}-benchmark.md`);
await writeFile(outputPath, output, 'utf8');
process.stdout.write(`${output}\nBenchmark report: ${outputPath}\n`);
