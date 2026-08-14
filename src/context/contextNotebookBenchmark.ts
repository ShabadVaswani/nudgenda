import type { ContextNotebookReport } from './contextNotebookPipeline.ts';

export type BenchmarkCheck = {
  earned: number;
  label: string;
  maximum: number;
  note: string;
};

export type BenchmarkSection = {
  checks: BenchmarkCheck[];
  earned: number;
  maximum: number;
  name: string;
};

export type ContextNotebookBenchmarkResult = {
  benchmark: string;
  sections: BenchmarkSection[];
  score: number;
  verdict: string;
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionText(notebook: string, heading: string) {
  const marker = `## ${heading}`;
  const start = notebook.indexOf(marker);
  if (start < 0) return '';
  const contentStart = start + marker.length;
  const remaining = notebook.slice(contentStart);
  const nextHeading = remaining.search(/\r?\n## /);
  return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
}

function proportionalCheck(label: string, maximum: number, checks: boolean[], note: string) {
  const earned = checks.length ? (maximum * checks.filter(Boolean).length) / checks.length : 0;
  return { earned, label, maximum, note } satisfies BenchmarkCheck;
}

function allInOrder(text: string, values: string[]) {
  let position = -1;
  for (const value of values) {
    const next = text.indexOf(value, position + 1);
    if (next < 0) return false;
    position = next;
  }
  return true;
}

function section(name: string, maximum: number, checks: BenchmarkCheck[]): BenchmarkSection {
  return {
    checks,
    earned: checks.reduce((total, check) => total + check.earned, 0),
    maximum,
    name,
  };
}

export function benchmarkContextNotebook(
  report: ContextNotebookReport,
): ContextNotebookBenchmarkResult {
  const notebook = normalize(report.notebook);
  const stable = normalize(sectionText(report.notebook, 'Stable preferences'));
  const conditional = normalize(sectionText(report.notebook, 'Conditional scheduling behavior'));
  const historical = normalize(sectionText(report.notebook, 'Historical or one-off context'));
  const unresolved = normalize(sectionText(report.notebook, 'Unresolved or ambiguous'));

  const coverageChecks: BenchmarkCheck[] = [
    proportionalCheck(
      'Positive action framing',
      4,
      [notebook.includes('what to do'), notebook.includes('what not to do')],
      'user-004: tell the user what to do instead of centering prohibitions.',
    ),
    proportionalCheck(
      'Always report total work/study time',
      4,
      [notebook.includes('total study work time'), notebook.includes('always')],
      'user-010.',
    ),
    proportionalCheck(
      'Work target and minimum',
      4,
      [
        notebook.includes('8 hours of work') ||
          notebook.includes('8 hour work target') ||
          notebook.includes('work target of 8 hours'),
        notebook.includes('at least 7 hours'),
      ],
      'user-005 gives an 8-hour target; user-011 establishes a 7-hour minimum.',
    ),
    proportionalCheck(
      'Protect cooking and eating',
      4,
      [
        notebook.includes('not cooking eating time') ||
          notebook.includes('not sacrifice') && notebook.includes('cooking eating'),
      ],
      'user-011.',
    ),
    proportionalCheck(
      'Late-wakeup behavior',
      4,
      [
        notebook.includes('waking up late'),
        notebook.includes('reduce study time'),
        notebook.includes('prioritize it'),
        notebook.includes('brunch'),
      ],
      'user-013: preserve the complete conditional behavior.',
    ),
    proportionalCheck(
      'Meditation priority and minimum',
      4,
      [notebook.includes('meditation is high priority'), notebook.includes('at least 20 minutes')],
      'user-013.',
    ),
    proportionalCheck(
      'Night chill time is low priority',
      4,
      [notebook.includes('chill'), notebook.includes('night'), notebook.includes('deprioritized')],
      'user-015.',
    ),
    proportionalCheck(
      'Home/office conditional rule',
      4,
      [
        notebook.includes('more than 8 hours'),
        notebook.includes('previous day'),
        notebook.includes('wfh'),
        notebook.includes('otherwise') || notebook.includes('if not'),
        notebook.includes('office is 1 hour away'),
        notebook.includes('run can be removed'),
      ],
      'user-015: both branches, commute, and removable run matter.',
    ),
    proportionalCheck(
      'Current career priorities in order',
      4,
      [
        allInOrder(notebook, [
          'data structures and algorithms',
          'system design',
          'interview call preparation',
          'job applications',
        ]),
      ],
      'user-005.',
    ),
    proportionalCheck(
      'Direct calendar scheduling every time',
      4,
      [
        notebook.includes('directly to calendar') || notebook.includes('calendar entries'),
        notebook.includes('every time'),
      ],
      'user-024, user-026, and user-028.',
    ),
    proportionalCheck(
      'Detailed descriptions in every block',
      4,
      [notebook.includes('detailed description'), notebook.includes('each')],
      'user-027.',
    ),
    proportionalCheck(
      'Four-hour statement remains unresolved',
      4,
      [unresolved.includes('four hours'), unresolved.includes('unclear')],
      'user-031 is garbled and must not be resolved by guessing.',
    ),
  ];

  const typingChecks: BenchmarkCheck[] = [
    proportionalCheck('5:45 wake time is not stable', 4, [!stable.includes('5 45')], 'user-005 was a one-day plan.'),
    proportionalCheck('9 PM lights-out is not stable', 4, [!stable.includes('9 pm')], 'The statement occurred inside dated plans.'),
    proportionalCheck('30-minute meditation is not stable', 4, [!stable.includes('30 minutes')], 'The later durable rule is at least 20 minutes.'),
    proportionalCheck('Home/office rule is conditional', 4, [conditional.includes('more than 8 hours') && conditional.includes('wfh')], 'user-015 is explicitly if/then.'),
    proportionalCheck('Interview-only day is historical', 4, [historical.includes('just interview prep') || historical.includes('only interview prep')], 'user-008 refers only to tomorrow.'),
    proportionalCheck('One-time outing/run stays historical', 4, [historical.includes('didn t go out') || historical.includes('want to go out')], 'user-019 describes one day, not a standing rule.'),
  ];

  const bulletLines = report.notebook.split(/\r?\n/).filter((line) => /^\s*-\s+/.test(line));
  const citedBullets = bulletLines.filter((line) => /\[source:\s*[^\]]+\][.!?]?\s*$/.test(line));
  const citedIds = [...report.notebook.matchAll(/(?:user|assistant)-\d{3}/gi)].map((match) =>
    match[0].toLocaleLowerCase(),
  );
  const knownUserIds = new Set(report.selectedEvidence.map((item) => item.id));
  const invalidIds = citedIds.filter((id) => !knownUserIds.has(id));
  const broadClaims = [
    'priorities can shift daily',
    'may want to go out if',
    'include all scheduled activities',
  ].filter((phrase) => notebook.includes(phrase));
  const groundingChecks: BenchmarkCheck[] = [
    proportionalCheck('Every notebook bullet is cited', 6, [bulletLines.length > 0 && citedBullets.length === bulletLines.length], `${citedBullets.length}/${bulletLines.length} bullets end with a source citation.`),
    proportionalCheck('All citations resolve to selected user evidence', 6, [invalidIds.length === 0], invalidIds.length ? `Invalid: ${[...new Set(invalidIds)].join(', ')}.` : 'No invalid citations.'),
    proportionalCheck('No assistant evidence is cited as user memory', 3, [!citedIds.some((id) => id.startsWith('assistant-'))], 'Assistant prose must not establish preferences.'),
    proportionalCheck('No known one-off generalizations', 3, [broadClaims.length === 0], broadClaims.length ? `Overgeneralized: ${broadClaims.join('; ')}.` : 'No benchmarked overgeneralizations.'),
  ];

  const requiredHeadings = [
    'Stable preferences',
    'Conditional scheduling behavior',
    'Current priorities',
    'Calendar behavior',
    'Unresolved or ambiguous',
    'Historical or one-off context',
  ];
  const compression =
    report.originalCharacters > 0 ? 1 - report.notebook.length / report.originalCharacters : 0;
  const usabilityChecks: BenchmarkCheck[] = [
    proportionalCheck('At least 90% shorter than the source', 5, [compression >= 0.9], `${Math.round(compression * 10_000) / 100}% shorter.`),
    proportionalCheck('Notebook has all required readable sections', 5, [requiredHeadings.every((heading) => sectionText(report.notebook, heading).trim())], 'Natural-language Markdown sections, not a JSON preference profile.'),
  ];

  const sections = [
    section('Important-context coverage', 48, coverageChecks),
    section('Correct memory placement', 24, typingChecks),
    section('Grounding and non-generalization', 18, groundingChecks),
    section('Compression and readability', 10, usabilityChecks),
  ];
  const score = Math.round(sections.reduce((total, item) => total + item.earned, 0) * 10) / 10;
  const verdict =
    score >= 90
      ? 'Strong enough for a guarded pilot.'
      : score >= 80
        ? 'Promising, but placement and precision still need work.'
        : score >= 70
          ? 'Useful prototype, not reliable enough for persistent memory.'
          : 'Not ready for persistent memory.';
  return { benchmark: 'social-media-diet-context-v1', score, sections, verdict };
}

export function formatContextNotebookBenchmark(result: ContextNotebookBenchmarkResult) {
  const output = [
    `# Context notebook benchmark: ${result.benchmark}`,
    '',
    `**Score: ${result.score}/100**`,
    '',
    result.verdict,
  ];
  for (const sectionResult of result.sections) {
    output.push('', `## ${sectionResult.name}: ${sectionResult.earned}/${sectionResult.maximum}`, '');
    for (const check of sectionResult.checks) {
      const status = check.earned === check.maximum ? 'PASS' : check.earned > 0 ? 'PARTIAL' : 'FAIL';
      output.push(
        `- ${status} — ${check.label}: ${Math.round(check.earned * 10) / 10}/${check.maximum}. ${check.note}`,
      );
    }
  }
  return `${output.join('\n')}\n`;
}
