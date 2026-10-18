export const ROUND_SIZE = 10;
export const MOODS = ['calm', 'curious', 'energized', 'reflective'];
export const INTERESTS = ['landscape', 'people', 'nature', 'abstract', 'stories', 'details'];
export const LANGUAGES = ['', 'en', 'zh', 'es', 'fr', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function sampleAcrossPeriods(pairs, size, random) {
  const groups = new Map();
  for (const pair of pairs) {
    if (!groups.has(pair.period)) groups.set(pair.period, []);
    groups.get(pair.period).push(pair);
  }
  const periods = shuffle([...groups.keys()], random);
  for (const period of periods) groups.set(period, shuffle(groups.get(period), random));
  const selected = [];
  while (selected.length < Math.min(size, pairs.length)) {
    for (const period of periods) {
      const pair = groups.get(period).pop();
      if (pair) selected.push(pair);
      if (selected.length === Math.min(size, pairs.length)) break;
    }
  }
  return selected;
}
export function buildRound(pairs, seen = [], size = ROUND_SIZE, random = Math.random, openingPairIds = []) {
  const used = new Set(seen);
  let available = pairs.filter(pair => !used.has(pair.id));
  const newCycle = available.length === 0;
  if (newCycle) available = pairs;
  const openingSet = new Set(openingPairIds);
  const opening = openingSet.size ? sampleAcrossPeriods(available.filter(pair => openingSet.has(pair.id)), Math.min(3,size), random) : [];
  const openingIds = new Set(opening.map(pair => pair.id));
  const nonOpening = available.filter(pair => !openingSet.has(pair.id));
  const restPool = nonOpening.length >= Math.min(size,available.length)-opening.length
    ? nonOpening : available.filter(pair => !openingIds.has(pair.id));
  const rest = sampleAcrossPeriods(restPool, Math.min(size,available.length)-opening.length, random);
  const ordered = [...opening, ...shuffle(rest, random)];
  const flips = shuffle(ordered.map((_, i) => i % 2 === 0), random);
  return {
    newCycle,
    deck: ordered.map((pair, i) => ({pairId: pair.id, leftId: flips[i] ? pair.b : pair.a, rightId: flips[i] ? pair.a : pair.b}))
  };
}
export function buildRoundWithPreference(pairs, seen = [], {
  size = ROUND_SIZE, random = Math.random, openingPairIds = [], preferredPairIds = [], preferredCount = 7
} = {}) {
  const used = new Set(seen);
  let available = pairs.filter(pair => !used.has(pair.id));
  const newCycle = available.length === 0;
  if (newCycle) available = pairs;
  const preferredIds = new Set(preferredPairIds);
  const openingIds = new Set(openingPairIds);
  const preferred = available.filter(pair => preferredIds.has(pair.id));
  const others = available.filter(pair => !preferredIds.has(pair.id));
  const target = Math.min(size, Math.max(0, preferredCount));
  const opening = sampleAcrossPeriods(preferred.filter(pair => openingIds.has(pair.id)), Math.min(3, target), random);
  const openingChosen = new Set(opening.map(pair => pair.id));
  const preferredRest = sampleAcrossPeriods(preferred.filter(pair => !openingChosen.has(pair.id)), target - opening.length, random);
  const selected = [...opening, ...preferredRest];
  const othersSelected = sampleAcrossPeriods(others, size - selected.length, random);
  selected.push(...othersSelected);
  if (selected.length < Math.min(size, available.length)) {
    const selectedIds = new Set(selected.map(pair => pair.id));
    selected.push(...sampleAcrossPeriods(available.filter(pair => !selectedIds.has(pair.id)), size - selected.length, random));
  }
  return {...buildRound(selected, [], size, random, openingPairIds), newCycle};
}
export function agreement(records, pairsById, field = 'qA') {
  let matched = 0, total = 0;
  for (const record of records) {
    if (record.choice === 'skip') continue;
    const value = pairsById.get(record.pairId)?.[field];
    if (!Number.isFinite(value) || value === 0.5) continue;
    total++;
    if ((value > 0.5 ? 'A' : 'B') === record.choice) matched++;
  }
  return {matched, total, percent: total ? Math.round(matched / total * 100) : null};
}
export function cohenKappa(records, pairsById, field = 'qA') {
  let total = 0, matched = 0, userA = 0, referenceA = 0;
  for (const record of records) {
    if (record.choice !== 'A' && record.choice !== 'B') continue;
    const value = pairsById.get(record.pairId)?.[field];
    if (!Number.isFinite(value) || value === 0.5) continue;
    const reference = value > 0.5 ? 'A' : 'B';
    total++;
    matched += record.choice === reference;
    userA += record.choice === 'A';
    referenceA += reference === 'A';
  }
  if (!total) return {total, kappa: null};
  const observed = matched / total;
  const expected = (userA * referenceA + (total - userA) * (total - referenceA)) / (total * total);
  return {total, kappa: expected < 1 ? (observed - expected) / (1 - expected) : null};
}
export function getInsight(records, pairsById, artworks) {
  const dimensions = ['brightness', 'saturation', 'detail', 'symmetry'];
  const results = dimensions.map(dimension => {
    let higher = 0, lower = 0;
    for (const record of records) {
      if (record.choice === 'skip') continue;
      const pair = pairsById.get(record.pairId);
      if (!pair) continue;
      const a = artworks[pair.a].features?.[dimension], b = artworks[pair.b].features?.[dimension];
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) < 1e-9) continue;
      const choseHigher = record.choice === 'A' ? a > b : b > a;
      choseHigher ? higher++ : lower++;
    }
    return {dimension, higher, lower, total: higher + lower, strength: higher + lower ? Math.abs(higher - lower) / (higher + lower) : 0};
  }).sort((a, b) => b.strength - a.strength);
  const best = results.find(result => result.total >= 3 && result.strength >= 0.3);
  return best ? {...best, direction: best.higher >= best.lower ? 'higher' : 'lower', count: Math.max(best.higher, best.lower)} : null;
}
export function chosenArtwork(record, pairsById) {
  const pair = pairsById.get(record.pairId);
  if (!pair || record.choice === 'skip') return null;
  return record.choice === 'A' ? pair.a : pair.b;
}
export function validProfile(profile) {
  return profile && typeof profile === 'object' && !Array.isArray(profile)
    && (profile.mood === '' || MOODS.includes(profile.mood))
    && Array.isArray(profile.interests) && profile.interests.length <= 6
    && new Set(profile.interests).size === profile.interests.length
    && profile.interests.every(item => INTERESTS.includes(item))
    && LANGUAGES.includes(profile.language);
}
export function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function validRecord(record, data, pairsById) {
  const pair = pairsById.get(record?.pairId);
  return record && UUID.test(record.id) && UUID.test(record.sessionId) && UUID.test(record.roundId)
    && record.datasetVersion === data.version && pair
    && ((record.leftId === pair.a && record.rightId === pair.b) || (record.leftId === pair.b && record.rightId === pair.a))
    && ['A', 'B', 'skip'].includes(record.choice)
    && Number.isInteger(record.elapsedMs) && record.elapsedMs >= 0 && record.elapsedMs <= 3600000
    && typeof record.consent === 'boolean' && validProfile(record.profile)
    && typeof record.source === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(record.source)
    && Number.isInteger(record.position) && record.position >= 1 && record.position <= ROUND_SIZE
    && ['side-by-side', 'stacked'].includes(record.layout)
    && validTimestamp(record.shownAt) && validTimestamp(record.chosenAt)
    && Date.parse(record.chosenAt) >= Date.parse(record.shownAt);
}
export function isValidState(state, data) {
  try {
    const pairs = new Map(data.pairs.map(pair => [pair.id, pair]));
    if (!state || state.schema !== 2 || state.datasetVersion !== data.version || !UUID.test(state.sessionId) || !UUID.test(state.roundId)
      || !Number.isInteger(state.roundNumber) || state.roundNumber < 1 || typeof state.consent !== 'boolean' || !validProfile(state.profile)
      || !Array.isArray(state.deck) || state.deck.length < 1 || state.deck.length > ROUND_SIZE
      || !Number.isInteger(state.index) || state.index < 0 || state.index > state.deck.length
      || !Array.isArray(state.history) || !Array.isArray(state.seen) || !Array.isArray(state.queue)
      || state.history.length > 10000 || state.queue.length > 10000) return false;
    if (new Set(state.deck.map(item => item.pairId)).size !== state.deck.length) return false;
    if (!state.deck.every(item => {
      const p = pairs.get(item.pairId);
      return p && ((item.leftId === p.a && item.rightId === p.b) || (item.leftId === p.b && item.rightId === p.a));
    })) return false;
    if (typeof state.source !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(state.source)) return false;
    if (state.presentation !== null && (!state.presentation || state.presentation.roundId !== state.roundId || !state.deck[state.index] || state.presentation.pairId !== state.deck[state.index].pairId || !validTimestamp(state.presentation.shownAt))) return false;
    if (!state.seen.every(id => pairs.has(id))) return false;
    if (new Set(state.seen).size !== state.seen.length) return false;
    if (!state.history.every(record => validRecord(record, data, pairs) && record.sessionId === state.sessionId)) return false;
    if (new Set(state.history.map(record => record.id)).size !== state.history.length) return false;
    if (new Set(state.history.map(record => record.roundId + ':' + record.pairId)).size !== state.history.length) return false;
    const records = state.history.filter(record => record.roundId === state.roundId);
    if (records.length !== state.index || !records.every((record, i) => record.pairId === state.deck[i].pairId && record.leftId === state.deck[i].leftId && record.rightId === state.deck[i].rightId && record.position === i + 1)) return false;
    const byId = new Map(state.history.map(record => [record.id, record]));
    if (!state.queue.every(record => record.consent === true && JSON.stringify(record) === JSON.stringify(byId.get(record.id)))) return false;
    if (new Set(state.queue.map(record => record.id)).size !== state.queue.length || (!state.consent && state.queue.length)) return false;
    return true;
  } catch { return false; }
}
