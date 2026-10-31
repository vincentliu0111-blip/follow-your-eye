import {buildRoundWithPreference} from './experience-core.mjs?v=20261030-discovery-v1';

// Only use already evaluated, playable pairs; never synthesize new comparisons.
export function buildArtworkRound(pairs, seen, artworkId, options = {}) {
  const used = new Set(seen);
  const candidates = pairs.filter(p => (p.a === artworkId || p.b === artworkId) && !used.has(p.id));
  const anchor = candidates[0] ?? pairs.find(p => p.a === artworkId || p.b === artworkId);
  if (!anchor) return buildRoundWithPreference(pairs, seen, options);
  const random = options.random ?? Math.random;
  const rest = buildRoundWithPreference(pairs.filter(p => p.id !== anchor.id), seen, {...options, size:9});
  const flip = random() < .5;
  return {newCycle:rest.newCycle, deck:[{pairId:anchor.id,leftId:flip?anchor.b:anchor.a,rightId:flip?anchor.a:anchor.b}, ...rest.deck]};
}

export function applyArtworkEntry(state, artworkId, pairs, options = {}) {
  if (!pairs.some(p => p.a === artworkId || p.b === artworkId)) return false;
  if (state.entryArtworkId === artworkId && state.source === `artwork-${artworkId}`) return false;
  if (state.index > 0) {
    state.nextArtworkId = artworkId;
  } else {
    const next=buildArtworkRound(pairs,state.seen,artworkId,options);
    if(next.newCycle)state.seen=[];
    state.deck=next.deck;
    state.presentation = null;
    state.source = `artwork-${artworkId}`;
    state.entryArtworkId = artworkId;
    state.nextArtworkId = null;
  }
  return true;
}
