import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {PAIRS_PER_SESSION, selectPairs, summary} from '../web/study-preview/core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const imageDir = process.env.CAC_ART_IMAGE_DIR || resolve(root, 'web/met-art');
const pairs = JSON.parse(readFileSync(resolve(root, 'web/study-preview/pairs.json'), 'utf8'));

test('preview uses exactly 50 fixed candidate pairs and 15 distinct positions', () => {
  assert.equal(pairs.length, 50);
  assert.equal(new Set(pairs.map(p => p.pair_id)).size, 50);
  assert.equal(new Set(pairs.flatMap(p => [p.a, p.b])).size, 100);
  for (const p of pairs) {
    for (const id of [p.a, p.b]) assert.ok(existsSync(resolve(imageDir, `${id}.jpg`)), `missing ${id}`);
  }
  const deck = selectPairs(pairs, () => 0.4);
  assert.equal(deck.length, PAIRS_PER_SESSION);
  assert.equal(new Set(deck.map(p => p.pair_id)).size, PAIRS_PER_SESSION);
  assert.deepEqual(deck.map(p => p.position), Array.from({length: 15}, (_, i) => i + 1));
});

test('visually flagged pairs are replaced with the reviewed same-period candidates', () => {
  assert.deepEqual([pairs[30].pair_id, pairs[30].a, pairs[30].b],
    ['met-671032-671008', '671032', '671008']);
  assert.deepEqual([pairs[43].pair_id, pairs[43].a, pairs[43].b],
    ['met-54712-54644', '54712', '54644']);
  const ids = new Set(pairs.flatMap(p => [p.a, p.b]));
  for (const excluded of ['37930', '37929', '440727', '439631']) {
    assert.equal(ids.has(excluded), false, `flagged artwork ${excluded} remains in the preview`);
  }
});

test('skips and unavailable predictions cannot produce a made-up agreement rate', () => {
  assert.deepEqual(summary([{pair_id: pairs[0].pair_id, choice: 'skip'}]), {comparable: 0, same: 0, percent: null});
  assert.deepEqual(summary([{pair_id: pairs[0].pair_id, choice: 'a'}]), {comparable: 0, same: 0, percent: null});
});

test('preview is marked noindex and contains no answer-upload or persistence path', () => {
  const html = readFileSync(resolve(root, 'web/study-preview/index.html'), 'utf8');
  const app = readFileSync(resolve(root, 'web/study-preview/preview.mjs'), 'utf8');
  assert.match(html, /noindex, nofollow/);
  assert.match(app, /fetch\('\.\/pairs\.json'\)/);
  assert.doesNotMatch(app, /localStorage|sessionStorage|sendBeacon|XMLHttpRequest|fetch\([^)]*,\s*\{\s*method/);
});
