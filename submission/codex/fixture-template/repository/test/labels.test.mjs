import assert from 'node:assert/strict';
import test from 'node:test';

import { isReleaseLabel } from '../src/labels.mjs';

test('recognizes release labels without depending on letter case', () => {
  assert.equal(isReleaseLabel('release:beta'), true);
  assert.equal(isReleaseLabel('  RELEASE:stable'), true);
});

test('rejects unrelated and non-string labels', () => {
  assert.equal(isReleaseLabel('documentation'), false);
  assert.equal(isReleaseLabel(null), false);
});
