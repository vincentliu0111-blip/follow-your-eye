import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {PAIRS_PER_SESSION, eligibleForProlificPreview, selectPairs, summary} from '../web/study-preview/core.mjs';

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

test('every displayed artwork is a Met European oil painting', () => {
  const catalog = JSON.parse(readFileSync(resolve(root, 'web/met_catalog.json'), 'utf8'));
  const departments = JSON.parse(readFileSync(resolve(root, 'Data/met_department_snapshot_v1.json'), 'utf8')).departmentById;
  const byId = new Map(catalog.artworks.map(art => [String(art.id), art]));
  for (const pair of pairs) {
    for (const id of [pair.a, pair.b]) {
      const art = byId.get(id);
      assert.ok(art, `missing Met catalog record ${id}`);
      assert.equal(departments[id], 'European Paintings', `wrong department ${id}`);
      assert.match(art.medium, /^Oil on /i, `not a pure oil painting ${id}`);
      assert.doesNotMatch(art.medium, /gold/i, `mixed oil and gold medium ${id}`);
    }
  }
});

test('skips and unavailable predictions cannot produce a made-up agreement rate', () => {
  assert.deepEqual(summary([{pair_id: pairs[0].pair_id, choice: 'skip'}]), {comparable: 0, same: 0, percent: null});
  assert.deepEqual(summary([{pair_id: pairs[0].pair_id, choice: 'a'}]), {comparable: 0, same: 0, percent: null});
});

test('Prolific preview eligibility matches the saved adult age and U.S. filters', () => {
  for (const age of ['18', '100']) assert.equal(eligibleForProlificPreview(age, 'United States'), true);
  for (const age of ['', '17', '18.5', '101', '121']) assert.equal(eligibleForProlificPreview(age, 'US'), false);
  assert.equal(eligibleForProlificPreview('25', 'CA'), false);
  assert.equal(eligibleForProlificPreview('25', ' us '), true);
});

test('preview is marked noindex and contains no answer-upload or persistence path', () => {
  const html = readFileSync(resolve(root, 'web/study-preview/index.html'), 'utf8');
  const app = readFileSync(resolve(root, 'web/study-preview/preview.mjs'), 'utf8');
  assert.match(html, /noindex, nofollow/);
  assert.match(app, /fetch\('\.\/pairs\.json'\)/);
  assert.doesNotMatch(app, /localStorage|sessionStorage|sendBeacon|XMLHttpRequest|fetch\([^)]*,\s*\{\s*method/);
});
