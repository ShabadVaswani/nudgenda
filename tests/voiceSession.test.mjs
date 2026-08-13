import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSpeechRestartDelay,
  isRecoverableSpeechError,
  mergeFinalTranscript,
  previewTranscript,
} from '../src/voice/voiceSession.ts';

test('accumulates final segments across recognizer restarts', () => {
  assert.equal(mergeFinalTranscript('plan my morning', 'then add lunch'), 'plan my morning then add lunch');
});

test('does not duplicate repeated or cumulative final results', () => {
  assert.equal(mergeFinalTranscript('plan my morning', 'my morning'), 'plan my morning');
  assert.equal(mergeFinalTranscript('plan my morning', 'plan my morning then add lunch'), 'plan my morning then add lunch');
});

test('previews interim speech after completed segments', () => {
  assert.equal(previewTranscript('plan my morning', 'then add'), 'plan my morning then add');
});

test('only silence and recognizer contention are recoverable', () => {
  assert.equal(isRecoverableSpeechError('no-speech'), true);
  assert.equal(isRecoverableSpeechError('speech-timeout'), true);
  assert.equal(isRecoverableSpeechError('busy'), true);
  assert.equal(isRecoverableSpeechError('network'), false);
  assert.equal(isRecoverableSpeechError('not-allowed'), false);
});

test('restart delay backs off and is capped', () => {
  assert.deepEqual([0, 1, 2, 9].map(getSpeechRestartDelay), [450, 900, 1800, 2500]);
});
