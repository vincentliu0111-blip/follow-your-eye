import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isValidState} from '../web/experience-core.mjs';

// Run the application's real persistence functions with a storage failure,
// not a second implementation of their behavior.
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function save() {');
const end = source.indexOf('function updateStorageWarning() {', start);
const storageHandler = source.split('\n').find(line => line.startsWith("window.addEventListener('storage',"));
const restoreStart = source.indexOf('function restore() {');
const restoreEnd = source.indexOf('function validateData(', restoreStart);
assert.ok(start >= 0 && end > start && storageHandler);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart);
const data = JSON.parse(readFileSync(new URL('../web/experience_data.json', import.meta.url), 'utf8'));
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function setup({locks = true} = {}) {
  const initial = {
    schema: 2, datasetVersion: data.version, source: 'test',
    sessionId: uuid(1), roundId: uuid(2), roundNumber: 1,
    consent: true, profile: {mood: '', interests: [], language: ''},
    presentation: null, index: 0, seen: [], history: [], queue: [],
    deck: data.pairs.slice(0, 3).map(p => ({pairId: p.id, leftId: p.a, rightId: p.b})),
  };
  assert.equal(isValidState(initial, data), true);
  let disk = JSON.stringify(initial), failing = false, writes = 0;
  const checkbox = {checked: true};
  const context = vm.createContext({
    state: structuredClone(initial), data, isValidState,
    memoryOnly: false, storageMessage: '', storageKey: 'test-state',
    view: 'play', displayKey: '', syncController: {abort() {}},
    navigator: locks ? {locks: {request: async (_key, change) => change()}} : {},
    localStorage: {
      getItem() { return disk; },
      setItem(_key, value) { writes++; if (failing) throw new DOMException('Full', 'QuotaExceededError'); disk = value; },
    },
    $: () => checkbox,
    updateStorageWarning() {}, updateSync() {}, updateCollectionCount() {}, renderPlay() {}, renderCollection() {},
    window: {addEventListener(_name, callback) { context.onStorage = callback; }},
  });
  vm.runInContext(source.slice(start, end) + '\n' + storageHandler, context);
  const choose = () => context.mutateState(current => {
    const i = current.index, pair = data.pairs[i];
    const record = {
      id: uuid(i + 100), sessionId: current.sessionId, roundId: current.roundId,
      datasetVersion: data.version, source: current.source, pairId: pair.id,
      leftId: pair.a, rightId: pair.b, choice: 'A', position: i + 1,
      layout: 'side-by-side', elapsedMs: 500,
      shownAt: '2026-10-03T12:00:00.000Z', chosenAt: '2026-10-03T12:00:00.500Z',
      profile: structuredClone(current.profile), consent: current.consent,
    };
    current.history.push(record); current.seen.push(pair.id); current.index++;
    if (current.consent) current.queue.push(record);
  });
  return {context, choose, checkbox, fail: () => {failing = true;}, recover: () => {failing = false;},
    disk: () => JSON.parse(disk), writes: () => writes, setDisk: value => {disk = JSON.stringify(value);}};
}

test('healthy persistence keeps consecutive choices and consumes latest cross-tab state', async () => {
  const h = setup();
  await h.choose(); await h.choose();
  assert.equal(h.disk().index, 2);
  const other = h.disk(); other.profile.mood = 'curious'; h.setDisk(other);
  await h.context.mutateState(current => {current.profile.language = 'zh';});
  assert.equal(h.context.state.profile.mood, 'curious');
  assert.equal(h.disk().profile.language, 'zh');
  assert.equal(isValidState(h.disk(), data), true);
});

test('quota failure preserves all subsequent picks in memory instead of rereading old progress', async () => {
  const h = setup(); h.fail();
  await h.choose(); await h.choose();
  assert.equal(h.context.state.index, 2);
  assert.equal(h.context.state.history.length, 2);
  assert.equal(h.context.state.queue.length, 2);
  assert.equal(isValidState(h.context.state, data), true);
  assert.equal(h.disk().index, 0);
  assert.equal(h.context.memoryOnly, true);
  assert.equal(h.context.storageMessage, 'storageError');
  assert.equal(h.writes(), 1);
});

test('storage events cannot replace unsaved memory choices after a failed write', async () => {
  const h = setup(); h.fail(); await h.choose(); await h.choose();
  h.context.onStorage({key: 'test-state', newValue: JSON.stringify(h.disk())});
  assert.equal(h.context.state.index, 2);
  assert.equal(h.context.state.queue.length, 2);
});

test('an acknowledgment after quota failure removes only its own queued event', async () => {
  const h = setup(); h.fail(); await h.choose(); await h.choose();
  await h.context.mutateState(current => {current.queue = current.queue.filter(item => item.id !== uuid(100));});
  assert.equal(h.context.state.history.length, 2);
  assert.equal(h.context.state.queue.length, 1);
  assert.equal(h.context.state.queue[0].id, uuid(101));
});

test('contribution off and optional settings remain effective in the memory-only tab', async () => {
  const h = setup(); await h.choose(); h.fail();
  await h.context.mutateState(current => {current.consent = false; current.queue = []; current.profile.mood = 'calm';});
  h.context.onStorage({key: 'test-state', newValue: JSON.stringify(h.disk())});
  await h.choose();
  assert.equal(h.context.state.consent, false);
  assert.equal(h.context.state.profile.mood, 'calm');
  assert.equal(h.context.state.queue.length, 0);
  assert.equal(h.context.state.history[1].consent, false);
});

test('recovered storage is not silently overwritten with divergent memory state', async () => {
  const h = setup(); h.fail(); await h.choose(); h.recover(); await h.choose();
  assert.equal(h.context.state.index, 2);
  assert.equal(h.disk().index, 0);
  assert.equal(h.writes(), 1);
  assert.equal(h.context.storageMessage, 'storageError');
});

test('single-tab fallback without Web Locks still preserves choices on quota failure', async () => {
  const h = setup({locks: false}); h.fail(); await h.choose(); await h.choose();
  assert.equal(h.context.state.index, 2);
  assert.equal(isValidState(h.context.state, data), true);
});

test('a new dataset keeps the old browser snapshot under its original key', () => {
  const latest = JSON.parse(readFileSync(new URL('../web/met_experience_data.json', import.meta.url), 'utf8'));
  const baseKey = 'follow-your-eye-experience-v1';
  const versionKey = `${baseKey}:${latest.version}`;
  const old = {datasetVersion: 'archived-met-paintings-v2', history: [{choice: 'A'}]};
  const disk = new Map([[baseKey, JSON.stringify(old)]]);
  const fresh = {
    schema: 2, datasetVersion: latest.version, source: 'test',
    sessionId: uuid(901), roundId: uuid(902), roundNumber: 1,
    consent: false, profile: {mood: '', interests: [], language: ''},
    presentation: null, index: 0, seen: [], history: [], queue: [],
    deck: latest.pairs.slice(0, 3).map(p => ({pairId: p.id, leftId: p.a, rightId: p.b})),
  };
  assert.equal(isValidState(fresh, latest), true);
  const context = vm.createContext({
    data: latest, storageKey: versionKey, STORAGE_BASE_KEY: baseKey,
    storageMessage: '', memoryOnly: false, state: null, isValidState,
    freshState: () => structuredClone(fresh), updateStorageWarning() {},
    localStorage: {
      getItem: key => disk.get(key) ?? null,
      setItem: (key, value) => disk.set(key, value),
    },
  });
  vm.runInContext(source.slice(restoreStart, restoreEnd) + source.slice(start, source.indexOf('// Healthy storage', start)), context);
  context.state = context.restore();
  context.save();
  assert.equal(context.state.datasetVersion, latest.version);
  assert.equal(JSON.parse(disk.get(baseKey)).history.length, 1);
  assert.equal(JSON.parse(disk.get(versionKey)).datasetVersion, latest.version);

  disk.set(baseKey, JSON.stringify(fresh));
  disk.delete(versionKey);
  assert.equal(context.restore().datasetVersion, latest.version);
  assert.equal(disk.get(versionKey), disk.get(baseKey), 'a matching legacy snapshot migrates once');
});
