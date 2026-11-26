import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReturnPaths} from '../web/study-preview/return-paths.mjs';

const previewId = '0123456789abcdef01234567';
const base = `https://vincentliu.ai/study-preview/?route=prolific&PROLIFIC_PID=${previewId}`;
const good = 'https://app.prolific.com/submissions/complete?cc=AB12CD34';
const href = (path, id = previewId) => `${base}#preview_pid=${id}&return_mismatch=${encodeURIComponent(path)}`;

test('test return is available only to the matching synthetic preview ID', () => {
  assert.deepEqual(previewReturnPaths(href(good)), {mismatch: good});
  assert.deepEqual(previewReturnPaths(href(good, 'abcdef0123456789abcdef01')), {});
  assert.deepEqual(previewReturnPaths(`https://vincentliu.ai/study-preview/?route=social&PROLIFIC_PID=${previewId}#preview_pid=${previewId}&return_mismatch=${encodeURIComponent(good)}`), {});
});

test('rejects non-Prolific, malformed, and augmented return targets', () => {
  for (const target of [
    'https://other.example/submissions/complete?cc=AB12CD34',
    'http://app.prolific.com/submissions/complete?cc=AB12CD34',
    'https://app.prolific.com/submissions/complete?cc=AB12CD34&next=evil',
    'https://app.prolific.com/submissions/complete?cc=AB12CD34#extra',
    'https://app.prolific.com/submissions/complete?cc=bad',
  ]) assert.deepEqual(previewReturnPaths(href(target)), {});
});
