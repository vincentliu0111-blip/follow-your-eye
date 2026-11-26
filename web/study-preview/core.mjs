export const PAIRS_PER_SESSION = 15;
export const PROLIFIC_MIN_AGE = 18;
export const PROLIFIC_MAX_AGE = 100;

export function eligibleForProlificPreview(ageValue, countryValue) {
  const age = Number(ageValue);
  return String(ageValue).trim() !== '' && Number.isInteger(age) &&
    age >= PROLIFIC_MIN_AGE && age <= PROLIFIC_MAX_AGE &&
    ['US', 'UNITED STATES'].includes(String(countryValue).trim().toUpperCase());
}

export function selectPairs(pairs, random = Math.random) {
  if (!Array.isArray(pairs) || pairs.length < PAIRS_PER_SESSION) throw new Error('At least 15 pairs required');
  const ids = new Set(pairs.map(p => p.pair_id));
  if (ids.size !== pairs.length) throw new Error('Duplicate pair IDs');
  const chosen = [...pairs];
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen.slice(0, PAIRS_PER_SESSION).map((p, i) => ({...p, position: i + 1, flipped: random() < 0.5}));
}

export function summary(choices, validPredictions = new Map()) {
  let comparable = 0;
  let same = 0;
  for (const x of choices) {
    if (x.choice !== 'a' && x.choice !== 'b') continue;
    const prediction = validPredictions.get(x.pair_id);
    if (prediction !== 'a' && prediction !== 'b') continue;
    comparable++;
    if (x.choice === prediction) same++;
  }
  return {comparable, same, percent: comparable ? Math.round(100 * same / comparable) : null};
}
