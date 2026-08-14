import assert from 'node:assert/strict';
import test from 'node:test';

import { isRetryableOpenRouterStatus } from '../src/agent/openRouterRequest.ts';

test('retries transient OpenRouter and provider status codes', () => {
  for (const status of [408, 409, 425, 429, 500, 502, 503]) {
    assert.equal(isRetryableOpenRouterStatus(status), true, String(status));
  }
});

test('does not retry authentication, payment, or bad-model errors', () => {
  for (const status of [400, 401, 402, 403, 404, 422]) {
    assert.equal(isRetryableOpenRouterStatus(status), false, String(status));
  }
});
