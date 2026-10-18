import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ROUND_SIZE, buildRound, agreement, cohenKappa, getInsight, chosenArtwork,
  validProfile, validTimestamp, validRecord, isValidState,
} from '../web/experience-core.mjs';

const data = JSON.parse(readFileSync(new URL('../web/experience_data.json', import.meta.url), 'utf8'));
const pairs = new Map(data.pairs.map(pair => [pair.id, pair]));
const profile = {mood: 'curious', interests: ['nature', 'details'], language: 'en'};
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

function seededRandom(seed = 20261003) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function makeRecord(pair, index = 1, overrides = {}) {
  return {
    id: uuid(index + 100), sessionId: uuid(1), roundId: uuid(2),
    datasetVersion: data.version, pairId: pair.id,
    leftId: pair.a, rightId: pair.b, choice: 'A', elapsedMs: 450,
    source: 'direct', position: index, layout: 'side-by-side',
    shownAt: '2026-10-03T12:00:00.000Z', chosenAt: '2026-10-03T12:00:00.450Z',
    consent: true, profile: structuredClone(profile), ...overrides,
  };
}

function makeState(answered = 3) {
  const {deck} = buildRound(data.pairs, [], ROUND_SIZE, seededRandom());
  const history = deck.slice(0, answered).map((item, index) =>
    makeRecord(pairs.get(item.pairId), index + 1, {leftId: item.leftId, rightId: item.rightId}));
  return {
    schema: 2, datasetVersion: data.version, sessionId: uuid(1), roundId: uuid(2),
    roundNumber: 1, consent: true, profile: structuredClone(profile),
    source: 'direct', presentation: null,
    deck, index: answered, history, seen: deck.map(item => item.pairId),
    queue: structuredClone(history),
  };
}

test('the full real dataset appears exactly once before the next cycle', () => {
  assert.equal(data.pairs.length, 594);
  assert.equal(pairs.size, 594);
  const random = seededRandom();
  const seen = [];
  const roundLengths = [];
  while (seen.length < data.pairs.length) {
    const round = buildRound(data.pairs, seen, ROUND_SIZE, random);
    assert.equal(round.newCycle, false);
    assert.ok(round.deck.length > 0 && round.deck.length <= ROUND_SIZE);
    assert.equal(new Set(round.deck.map(item => item.pairId)).size, round.deck.length);
    for (const item of round.deck) {
      assert.equal(seen.includes(item.pairId), false, 'a previously served pair must not recur');
      const source = pairs.get(item.pairId);
      assert.deepEqual(new Set([item.leftId, item.rightId]), new Set([source.a, source.b]));
      seen.push(item.pairId);
    }
    roundLengths.push(round.deck.length);
  }
  assert.deepEqual(new Set(seen), new Set(pairs.keys()));
  assert.equal(roundLengths.length, 60);
  assert.ok(roundLengths.slice(0, -1).every(length => length === 10));
  assert.equal(roundLengths.at(-1), 4, 'the last four pairs are not padded with repeats');
  const restart = buildRound(data.pairs, seen, ROUND_SIZE, random);
  assert.equal(restart.newCycle, true);
  assert.equal(restart.deck.length, 10);
  assert.equal(new Set(restart.deck.map(item => item.pairId)).size, 10);
});

test('ten-pair rounds balance A-left/B-left and represented date bands when stock is sufficient', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const round = buildRound(data.pairs, [], ROUND_SIZE, seededRandom(seed));
    assert.equal(round.deck.filter(item => item.leftId === pairs.get(item.pairId).a).length, 5);
    assert.equal(round.deck.filter(item => item.leftId === pairs.get(item.pairId).b).length, 5);
    const counts = new Map(['1300-1599', '1600-1799', '1800-1914'].map(period => [period, 0]));
    for (const item of round.deck) {
      const period = pairs.get(item.pairId).period;
      counts.set(period, counts.get(period) + 1);
    }
    assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
  }
});

test('an exhausted date band and a short remainder still produce only remaining pairs', () => {
  const remaining = data.pairs.filter(pair => pair.period === '1800-1914').slice(0, 3);
  const remainingIds = new Set(remaining.map(pair => pair.id));
  const seen = data.pairs.filter(pair => !remainingIds.has(pair.id)).map(pair => pair.id);
  const round = buildRound(data.pairs, seen, ROUND_SIZE, seededRandom());
  assert.equal(round.newCycle, false);
  assert.deepEqual(new Set(round.deck.map(item => item.pairId)), remainingIds);
});

test('seeded round generation is reproducible without modifying inputs', () => {
  const snapshot = JSON.stringify(data.pairs);
  const seen = data.pairs.slice(0, 7).map(pair => pair.id);
  const beforeSeen = [...seen];
  assert.deepEqual(buildRound(data.pairs, seen, 10, seededRandom(42)),
                   buildRound(data.pairs, seen, 10, seededRandom(42)));
  assert.equal(JSON.stringify(data.pairs), snapshot);
  assert.deepEqual(seen, beforeSeen);
});

test('skips and exact AI ties are excluded independently from each agreement denominator', () => {
  // The source currently has no exact 0.5 values; inject ties into real pair IDs
  // to exercise this boundary without pretending these are source predictions.
  const source = data.pairs.slice(0, 6);
  const judge = [.9, .1, .9, .5, .9, .1];
  const model = [.1, .1, .9, .9, .5, .5];
  const choices = ['A', 'B', 'B', 'B', 'skip', 'B'];
  const fixture = new Map(source.map((pair, i) => [pair.id, {...pair, qA: judge[i], modelQA: model[i]}]));
  const records = source.map((pair, i) => makeRecord(pair, i + 1, {choice: choices[i]}));
  assert.deepEqual(agreement(records, fixture), {matched: 3, total: 4, percent: 75});
  assert.deepEqual(agreement(records, fixture, 'modelQA'), {matched: 1, total: 4, percent: 25});
  assert.deepEqual(agreement(records.map(record => ({...record, choice: 'skip'})), fixture),
                   {matched: 0, total: 0, percent: null});
  assert.deepEqual(agreement([records[3]], fixture), {matched: 0, total: 0, percent: null});
  assert.deepEqual(agreement([{...records[0], pairId: 'missing'}], fixture),
                   {matched: 0, total: 0, percent: null});
});

test('round kappa uses observed marginals and handles ties and a zero chance denominator', () => {
  const source = data.pairs.slice(0, 5);
  const fixture = new Map(source.map((pair, i) => [pair.id,
    {...pair, qA: [.9, .9, .9, .1, .5][i]}]));
  const records = source.map((pair, i) => makeRecord(pair, i + 1,
    {choice: ['A', 'A', 'B', 'B', 'A'][i], leftId: pair.b, rightId: pair.a}));
  const result = cohenKappa(records, fixture);
  assert.equal(result.total, 4);
  // 3/4 observed, 1/2 expected from the two actual A/B marginal distributions.
  assert.equal(result.kappa, .5);
  assert.deepEqual(cohenKappa(records.map(r => ({...r, choice: 'skip'})), fixture),
                   {total: 0, kappa: null});
  const unanimous = new Map(source.map(pair => [pair.id, {...pair, qA: .9}]));
  assert.deepEqual(cohenKappa(records.slice(0, 2), unanimous), {total: 2, kappa: null});
});

test('canonical choices refer to the same artwork after a left/right reversal', () => {
  const pair = data.pairs[0];
  const normal = makeRecord(pair);
  const reversed = {...normal, leftId: pair.b, rightId: pair.a};
  assert.equal(chosenArtwork(normal, pairs), pair.a);
  assert.equal(chosenArtwork(reversed, pairs), pair.a, 'A on the right remains canonical A');
  assert.equal(chosenArtwork({...reversed, choice: 'B'}, pairs), pair.b, 'B on the left remains canonical B');
  assert.equal(chosenArtwork({...reversed, choice: 'skip'}, pairs), null);
  assert.equal(chosenArtwork({...reversed, pairId: 'missing'}, pairs), null);
  assert.equal(validRecord(reversed, data, pairs), true);
});

test('insight is absent for all skipped choices or identical measured features', () => {
  const records = data.pairs.slice(0, 10).map((pair, i) => makeRecord(pair, i + 1));
  assert.equal(getInsight(records.map(record => ({...record, choice: 'skip'})), pairs, data.artworks), null);
  const artworks = Object.fromEntries(Object.entries(data.artworks).map(([id, artwork]) => [id, {
    ...artwork, features: {brightness: .5, saturation: .5, detail: .5, symmetry: .5},
  }]));
  assert.equal(getInsight(records, pairs, artworks), null);
  assert.equal(getInsight([], pairs, data.artworks), null);
});

test('consistent higher or lower choices reveal the observed preference, with a minimum of three comparisons', () => {
  const selected = data.pairs.filter(pair =>
    Math.abs(data.artworks[pair.a].features.brightness - data.artworks[pair.b].features.brightness) > 1e-9).slice(0, 10);
  for (const direction of ['higher', 'lower']) {
    const records = selected.map((pair, i) => {
      const aHigher = data.artworks[pair.a].features.brightness > data.artworks[pair.b].features.brightness;
      const chooseA = direction === 'higher' ? aHigher : !aHigher;
      return makeRecord(pair, i + 1, {choice: chooseA ? 'A' : 'B'});
    });
    const insight = getInsight(records, pairs, data.artworks);
    assert.equal(insight.dimension, 'brightness');
    assert.equal(insight.direction, direction);
    assert.equal(insight.total, 10);
    assert.equal(insight.count, 10);
    assert.equal(getInsight(records.slice(0, 2), pairs, data.artworks), null);
  }
});

test('an under-sampled dimension does not hide a supported preference in another dimension', () => {
  const selected = [];
  const used = new Set();
  for (const pair of data.pairs) {
    if (used.has(pair.a) || used.has(pair.b)) continue;
    selected.push(pair);
    used.add(pair.a);
    used.add(pair.b);
    if (selected.length === 4) break;
  }
  const artworks = structuredClone(data.artworks);
  selected.forEach((pair, i) => {
    artworks[pair.a].features = {brightness: i === 0 ? .8 : .5, saturation: .8, detail: .5, symmetry: .5};
    artworks[pair.b].features = {brightness: .5, saturation: .2, detail: .5, symmetry: .5};
  });
  const records = selected.map((pair, i) => makeRecord(pair, i + 1, {choice: i < 3 ? 'A' : 'B'}));
  const insight = getInsight(records, pairs, artworks);
  assert.notEqual(insight, null, 'three of four saturation choices provide evidence despite one brightness comparison');
  assert.equal(insight.dimension, 'saturation');
  assert.equal(insight.direction, 'higher');
  assert.equal(insight.count, 3);
  assert.equal(insight.total, 4);
});

test('valid unanswered, partial, completed, and consent-free states survive JSON storage', () => {
  for (const index of [0, 3, 10]) {
    const state = makeState(index);
    assert.equal(isValidState(JSON.parse(JSON.stringify(state)), data), true);
  }
  const localOnly = makeState();
  localOnly.consent = false;
  localOnly.queue = [];
  localOnly.history.forEach(record => {record.consent = false;});
  assert.equal(isValidState(localOnly, data), true);
});

test('valid profile and record boundary values remain usable', () => {
  assert.equal(validProfile({mood: '', interests: [], language: ''}), true);
  assert.equal(validProfile(profile), true);
  for (const elapsedMs of [0, 3600000]) {
    assert.equal(validRecord(makeRecord(data.pairs[0], 1, {elapsedMs}), data, pairs), true);
  }
  for (const source of ['direct', 'a', 'school_2026-test', 'a'.repeat(64)]) {
    for (const position of [1, 10]) {
      for (const layout of ['side-by-side', 'stacked']) {
        assert.equal(validRecord(makeRecord(data.pairs[0], 1, {source, position, layout}), data, pairs), true);
      }
    }
  }
  const simultaneous = makeRecord(data.pairs[0]);
  simultaneous.chosenAt = simultaneous.shownAt;
  simultaneous.elapsedMs = 0;
  assert.equal(validRecord(simultaneous, data, pairs), true);
});

test('timestamps require real UTC calendar dates, milliseconds, and the canonical Z form', () => {
  for (const timestamp of ['2026-10-03T12:00:00.000Z', '2024-02-29T23:59:59.999Z']) {
    assert.equal(validTimestamp(timestamp), true);
  }
  const invalid = [
    null, 0, {}, '', 'not a date',
    '2026-10-03T12:00:00Z', '2026-10-03T12:00:00.45Z',
    '2026-10-03T12:00:00.4500Z', '2026-10-03T12:00:00.450+00:00',
    '2026-10-03T08:00:00.450-04:00', '2026-10-03T12:00:00.450',
    '2026-10-03t12:00:00.450z', '2026-10-03 12:00:00.450Z',
    '2025-02-29T12:00:00.450Z', '2026-04-31T12:00:00.450Z',
    '2026-13-01T12:00:00.450Z', '2026-10-03T24:00:00.000Z',
  ];
  for (const timestamp of invalid) {
    assert.equal(validTimestamp(timestamp), false, `reject ${JSON.stringify(timestamp)}`);
  }
});

test('current presentation can be restored only for the unanswered item of this round', () => {
  const state = makeState(3);
  state.presentation = {
    roundId: state.roundId, pairId: state.deck[state.index].pairId,
    shownAt: '2026-10-03T12:00:00.500Z',
  };
  assert.equal(isValidState(JSON.parse(JSON.stringify(state)), data), true);
  const first = makeState(0);
  first.presentation = {...state.presentation, pairId: first.deck[0].pairId};
  assert.equal(isValidState(first, data), true);
  const complete = makeState(10);
  complete.presentation = state.presentation;
  assert.equal(isValidState(complete, data), false, 'there is no unanswered item after completion');
});

test('positions belong to their own round and still permit historical rounds in restored sessions', () => {
  const state = makeState(3);
  state.queue = [];
  const previous = makeRecord(data.pairs[20], 9, {id: uuid(999), roundId: uuid(20), position: 9});
  state.history.unshift(previous);
  state.roundNumber = 2;
  assert.equal(isValidState(state, data), true, 'past-round position nine is independent of the new round index');
  state.history[1].position = 2;
  assert.equal(isValidState(state, data), false, 'current first answer must be marked position one');
});

test('malformed saved states are rejected without throwing', async t => {
  const cases = [
    ['unknown dataset version', state => {state.datasetVersion = 'old';}],
    ['unsupported schema', state => {state.schema = 3;}],
    ['old schema requires migration', state => {state.schema = 1;}],
    ['invalid session UUID', state => {state.sessionId = 'not-a-uuid';}],
    ['invalid round UUID', state => {state.roundId = 'not-a-uuid';}],
    ['invalid record UUID', state => {state.history[0].id = 'not-a-uuid';}],
    ['nonpositive round number', state => {state.roundNumber = 0;}],
    ['fractional index', state => {state.index = .5;}],
    ['negative index', state => {state.index = -1;}],
    ['past-the-end index', state => {state.index = 11;}],
    ['answers missing at claimed index', state => {state.index = 4;}],
    ['empty deck', state => {state.deck = [];}],
    ['overlong deck', state => {state.deck.push({...state.deck[0]});}],
    ['unknown pair in deck', state => {state.deck[0].pairId = 'missing';}],
    ['duplicate pair in deck', state => {state.deck[1] = {...state.deck[0]};}],
    ['unrelated image on deck', state => {state.deck[0].leftId = 'not-an-artwork';}],
    ['same image on both sides', state => {state.deck[0].rightId = state.deck[0].leftId;}],
    ['unknown seen pair', state => {state.seen.push('missing');}],
    ['duplicate seen pair', state => {state.seen.push(state.seen[0]);}],
    ['invalid history choice', state => {state.history[0].choice = 'left';}],
    ['negative timing', state => {state.history[0].elapsedMs = -1;}],
    ['non-finite timing', state => {state.history[0].elapsedMs = Infinity;}],
    ['fractional timing', state => {state.history[0].elapsedMs = 1.5;}],
    ['out-of-range timing', state => {state.history[0].elapsedMs = 3600001;}],
    ['record version mismatch', state => {state.history[0].datasetVersion = 'old';}],
    ['foreign session record', state => {state.history[0].sessionId = uuid(99);}],
    ['duplicate record UUID', state => {state.history[1].id = state.history[0].id;}],
    ['duplicate pair within session round with distinct UUID', state => {
      state.history.push({...state.history[0], id: uuid(999)});
    }],
    ['record does not match displayed side order', state => {
      const record = state.history[0];
      [record.leftId, record.rightId] = [record.rightId, record.leftId];
    }],
    ['history reordered relative to answered deck', state => {state.history.reverse();}],
    ['queue record absent from history', state => {state.queue[0].id = uuid(999);}],
    ['queued answer tampered after recording', state => {state.queue[0].choice = 'B';}],
    ['duplicate UUID in queue', state => {state.queue.push({...state.queue[0]});}],
    ['nonconsensual queued record', state => {state.queue[0].consent = false;}],
    ['queue retained after consent withdrawn', state => {state.consent = false;}],
    ['unsupported mood', state => {state.profile.mood = 'unexpected';}],
    ['unknown interest', state => {state.profile.interests = ['unknown'];}],
    ['duplicate interest', state => {state.profile.interests = ['nature', 'nature'];}],
    ['invalid language', state => {state.profile.language = 'invalid';}],
    ['invalid nested record profile', state => {state.history[0].profile.interests = null;}],
    ['null deck entry', state => {state.deck[0] = null;}],
    ['null history entry', state => {state.history[0] = null;}],
    ['null queue entry', state => {state.queue[0] = null;}],
    ['missing state source', state => {delete state.source;}],
    ['blank state source', state => {state.source = '';}],
    ['state source with path', state => {state.source = 'class/a';}],
    ['missing presentation field', state => {delete state.presentation;}],
    ['empty presentation object', state => {state.presentation = {};}],
    ['presentation from another round', state => {
      state.presentation = {roundId: uuid(99), pairId: state.deck[state.index].pairId, shownAt: '2026-10-03T12:00:00.500Z'};
    }],
    ['presentation for an already answered pair', state => {
      state.presentation = {roundId: state.roundId, pairId: state.deck[0].pairId, shownAt: '2026-10-03T12:00:00.500Z'};
    }],
    ['presentation for a later unanswered pair', state => {
      state.presentation = {roundId: state.roundId, pairId: state.deck[state.index + 1].pairId, shownAt: '2026-10-03T12:00:00.500Z'};
    }],
    ['presentation with invalid shown time', state => {
      state.presentation = {roundId: state.roundId, pairId: state.deck[state.index].pairId, shownAt: '2026-10-03T12:00:00Z'};
    }],
    ['wrong current-round answer position', state => {state.history[0].position = 2;}],
    ['duplicate current-round answer position', state => {state.history[1].position = 1;}],
    ['missing record source', state => {delete state.history[0].source;}],
    ['missing shown timestamp', state => {delete state.history[0].shownAt;}],
    ['missing chosen timestamp', state => {delete state.history[0].chosenAt;}],
    ['chosen timestamp before shown timestamp', state => {state.history[0].chosenAt = '2026-10-03T11:59:59.999Z';}],
    ['record shown time uses invalid calendar date', state => {state.history[0].shownAt = '2026-02-30T12:00:00.000Z';}],
    ['record chosen time has missing milliseconds', state => {state.history[0].chosenAt = '2026-10-03T12:00:01Z';}],
    ['record chosen time uses numeric offset', state => {state.history[0].chosenAt = '2026-10-03T12:00:00.450+00:00';}],
  ];
  for (const [label, mutate] of cases) {
    await t.test(label, () => {
      const state = makeState();
      // Treat existing responses as already uploaded unless the queue itself
      // is under test, so queue mismatch cannot conceal a record-validation bug.
      if (!label.includes('queu')) state.queue = [];
      mutate(state);
      assert.equal(isValidState(state, data), false);
    });
  }
  for (const state of [null, {}, [], 'not a state', {schema: 2}]) {
    assert.equal(isValidState(state, data), false);
  }
});

test('record source, position, and layout reject missing or malformed values', () => {
  for (const source of ['', 'Uppercase', '_leading', '-leading', 'a'.repeat(65), 'with space', 'with/slash', '\u4e2d\u6587', null, 42]) {
    assert.equal(validRecord(makeRecord(data.pairs[0], 1, {source}), data, pairs), false,
                 `reject source ${JSON.stringify(source)}`);
  }
  for (const position of [0, -1, 11, 1.5, '1', null, undefined, NaN]) {
    assert.equal(validRecord(makeRecord(data.pairs[0], 1, {position}), data, pairs), false,
                 `reject position ${String(position)}`);
  }
  for (const layout of ['', 'horizontal', 'vertical', 'SIDE-BY-SIDE', null, undefined]) {
    assert.equal(validRecord(makeRecord(data.pairs[0], 1, {layout}), data, pairs), false,
                 `reject layout ${String(layout)}`);
  }
});

test('record validation rejects invalid or reversed times even without a saved-state queue', () => {
  const invalid = [
    {shownAt: undefined}, {chosenAt: undefined},
    {shownAt: '2026-02-30T12:00:00.000Z'},
    {chosenAt: '2026-10-03T12:00:01Z'},
    {chosenAt: '2026-10-03T12:00:00.450+00:00'},
    {chosenAt: '2026-10-03T11:59:59.999Z'},
  ];
  for (const times of invalid) {
    assert.equal(validRecord(makeRecord(data.pairs[0], 1, times), data, pairs), false);
  }
});
