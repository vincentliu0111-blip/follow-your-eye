import {buildRoundWithPreference, agreement, cohenKappa, getInsight, chosenArtwork, isValidState, MOODS, INTERESTS} from './experience-core.mjs?v=20261018-public-v1';

const $ = id => document.getElementById(id);
// A new schema never backfills untimed choices from earlier prototypes.
const STORAGE_BASE_KEY = 'follow-your-eye-experience-v1';
let storageKey = STORAGE_BASE_KEY;
const LOCALE_KEY = 'follow-your-eye-language';
let locale = 'en';
try { locale = localStorage.getItem(LOCALE_KEY) === 'zh' ? 'zh' : 'en'; } catch {}
const COPY = {
  en: {
    play:'The experiment',metGallery:'Met gallery',collection:'Your collection',about:'The idea',private:'Public experience',loading:'Opening the gallery…',loadErrorTitle:'The gallery couldn’t open.',loadErrorText:'Check your connection and try again. Your saved picks will be here.',retry:'Try again',pendingTitle:'Saving your choice…',pendingExplanation:'Your next painting will appear after this choice is saved online.',retrySave:'Retry saving',eyebrow:'A LITTLE ART. A LITTLE INSTINCT.',title:'Trust your eye.',intro:'For anyone curious about art: choose the paintings you love and see where AI judges agree.',author:'By Vincent Liu',settings:'Make it yours',optional:'optional',roundNote:'10 choices. A new perspective.',thisOne:'Choose this one',keyboard:'Use ← → to choose · S to skip',skip:'Can’t decide? Skip this pair',revealNote:'Your perspective unfolds after the round.',roundComplete:'YOUR ROUND, REVEALED',summaryTitle:'A point of view. Yours.',smallDiscovery:'A SMALL DISCOVERY',insightLimit:'A glimpse of this round, not a label for your taste.',youAndAI:'YOU + AI JUDGES',inCommon:'in common',noScore:'Different taste is the whole point. This isn’t a score.',anotherRound:'Follow your curiosity.',anotherRoundSub:'A fresh set of artworks is waiting.',takeCloserLook:'TAKE A CLOSER LOOK',roundPicks:'The art that caught your eye',openArtwork:'Select an artwork to discover its story.',compareDetails:'Explore each choice & AI comparison',communityNote:'Collected votes from this public experience, including your own choice.',personalGallery:'YOUR PERSONAL GALLERY',collectionTitle:'A trail of curiosity.',backToPlay:'Keep exploring',collectionEmpty:'Your eye will lead the way.',collectionEmptyText:'Choose a few artworks and they’ll find a home here.',footerTag:'Art is for everyone. So is having an opinion.',sourceCredit:'Artworks from The Met Open Access',aboutLink:'About this experiment',optionalSetup:'OPTIONAL, ALWAYS',settingsTitle:'Come as you are.',settingsIntro:'A little context, if you feel like sharing. These choices won’t change which artworks you see.',moodTitle:'What’s your mood today?',interestsTitle:'What tends to catch your eye?',profileLanguage:'Which language do you feel most at home in?',preferNot:'Prefer not to say',anotherLanguage:'Another language / several languages',languageNote:'Language is optional context, not a measure of culture or identity.',done:'Back to the art',fromCollection:'FROM THE MET COLLECTION',detailInvitation:'Stay a little longer. Look for a detail you didn’t notice at first.',viewMet:'Explore at The Met',metNote:'Opens the museum’s official collection page. An online record doesn’t mean the artwork is currently on view.',on:'On',off:'Off',onlyDevice:'Saved in this browser only.',collectorReady:'Choose a painting to save it online.',savedStudy:'Your choice was saved online.',unavailable:'Online saving is unavailable. Please retry before choosing.',pending:n=>`${n} choice${n===1?'':'s'} waiting to sync.`,rejected:'Some choices could not be accepted. Your browser copy is safe.',round:n=>`ROUND ${String(n).padStart(2,'0')}`,pick:(n,total)=>`PICK ${String(n).padStart(2,'0')} OF ${total}`,summaryIntro:(p,s)=>`${p} artwork${p===1?'':'s'} chosen${s?`, ${s} pair${s===1?'':'s'} skipped`:''}. A little window into what moves you.`,shareSummary:(n,d)=>`This round, you and the AI judges chose the same artwork in ${n} of ${d} comparable pairs.`,judgeText:(n,d)=>`You chose the same artwork as the AI judges in ${n} of ${d} comparable pairs.`,modelText:(n,d)=>`Feature model: ${n} of ${d} choices in common.`,noComparisons:'No evaluated AI pairs in this round yet.',noModel:'No evaluated feature-model pairs in this round yet.',openMind:'Room for discovery.',openMindText:'Your choices took their own path this round. Keep exploring to see what catches your eye.',allSkippedTitle:'Take your time.',allSkippedText:'Nothing has to speak to you. A fresh round offers another place to start.',collectionIntro:n=>`${n} different artwork${n===1?'':'s'} you’ve chosen, gathered in one place.`,skipped:'You skipped this pair',yourPick:'Your pick',judges:'AI judges',model:'Feature model',support:'weighted support',prediction:'predicted probability',tie:'Tie',notAvailable:'Not available',samePick:'Same choice',differentPick:'Different choice',community:(n,total)=>`${n} of ${total} collected choices also picked this artwork.`,noCommunity:'No collected votes for this pair yet.',communityUnavailable:'Collected votes are unavailable.',imageError:'This artwork couldn’t load. You can skip this pair.',storageError:'Storage is full or unavailable. Keep using this tab; progress and settings now stay here only. Reloading may restore older progress and settings.',restoredError:'Your previous saved round couldn’t be restored. A new round is ready.',picked:'Choice selected; saving online…',skippedAnnounce:'Pair skipped; saving online…',leftArtwork:'Left artwork',rightArtwork:'Right artwork',chooseLeft:'Choose the left artwork',chooseRight:'Choose the right artwork',unknownArtist:'Artist not recorded',unknownDate:'Date not recorded',mood_calm:'Calm',mood_curious:'Curious',mood_energized:'Energized',mood_reflective:'Reflective',interest_landscape:'Landscapes',interest_people:'People',interest_nature:'Nature',interest_abstract:'Abstract forms',interest_stories:'Stories',interest_details:'Little details',
    brightness_higher:'A pull toward light.',brightness_lower:'A taste for deeper tones.',saturation_higher:'Color caught your eye.',saturation_lower:'An eye for quieter color.',detail_higher:'Drawn to the details.',detail_lower:'Room to breathe.',symmetry_higher:'Finding a little balance.',symmetry_lower:'An unexpected balance.',insight:(feature,n,total)=>`You chose the ${feature} image in ${n} of ${total} comparable pairs.`,dimension_brightness_higher:'brighter',dimension_brightness_lower:'darker',dimension_saturation_higher:'more saturated',dimension_saturation_lower:'less saturated',dimension_detail_higher:'more edge-dense',dimension_detail_lower:'less edge-dense',dimension_symmetry_higher:'more left–right symmetrical',dimension_symmetry_lower:'less left–right symmetrical',
  },
  zh: {
    play:'开始探索',metGallery:'大都会画廊',collection:'我的收藏',about:'关于实验',private:'公开体验',loading:'正在打开画廊…',loadErrorTitle:'画廊暂时没有打开。',loadErrorText:'请检查连接后重试。已保存的选择会留在这里。',retry:'重试',pendingTitle:'正在保存你的选择……',pendingExplanation:'保存成功后才会出现下一组画。',retrySave:'重试保存',eyebrow:'一点艺术，一点直觉。',title:'相信你的眼光。',intro:'给好奇艺术的人：选出你喜欢的画，看看 AI 裁判是否与你眼光相同。',author:'作者：Vincent Liu',settings:'我的偏好',optional:'可跳过',roundNote:'10 次选择，发现一点不一样。',thisOne:'选这一幅',keyboard:'按 ← → 选择 · S 跳过',skip:'难以决定？跳过这一组',revealNote:'完成一轮，再发现你的视角。',roundComplete:'这一轮，你的视角',summaryTitle:'你的眼光，自有不同。',smallDiscovery:'一个小小的发现',insightLimit:'这只是本轮的观察，不是给你的审美贴标签。',youAndAI:'你与 AI 裁判',inCommon:'选择一致',noScore:'不同的偏好才有趣。这不是审美成绩。',anotherRound:'让好奇心继续。',anotherRoundSub:'下一组作品，等你发现。',takeCloserLook:'再靠近一点',roundPicks:'那些吸引你的作品',openArtwork:'点击作品，继续了解它。',compareDetails:'逐一回顾你的选择与 AI 偏好',communityNote:'投票统计来自这个公开体验，也包含你的选择。',personalGallery:'属于你的小画廊',collectionTitle:'好奇心走过的地方。',backToPlay:'继续探索',collectionEmpty:'让你的眼光带路。',collectionEmptyText:'选几幅喜欢的作品，它们就会出现在这里。',footerTag:'人人都可以亲近艺术，也可以拥有自己的看法。',sourceCredit:'作品来自大都会博物馆开放资源',aboutLink:'关于这项实验',optionalSetup:'随时可选，也可跳过',settingsTitle:'带着此刻的自己。',settingsIntro:'如果愿意，可以留下少量背景信息。它们不会改变你看到的作品。',moodTitle:'你此刻的心情如何？',interestsTitle:'什么通常会吸引你的目光？',profileLanguage:'你最习惯使用哪种语言？',preferNot:'暂不提供',anotherLanguage:'其他语言／多种语言',languageNote:'语言只作可选背景信息，不代表文化或身份。',done:'回到作品',fromCollection:'来自大都会博物馆馆藏',detailInvitation:'再停留一会儿，找一个刚才没注意到的细节。',viewMet:'在大都会官网继续探索',metNote:'打开博物馆官方藏品页。存在网上记录不代表作品正在展出。',on:'开',off:'关',onlyDevice:'仅保存在当前浏览器。',collectorReady:'选画后会尝试在线保存。',savedStudy:'你的选择已在线保存。',unavailable:'在线保存暂不可用，请重试后再选画。',pending:n=>`${n} 条选择等待同步。`,rejected:'部分选择未被接收，浏览器副本仍保留。',round:n=>`第 ${String(n).padStart(2,'0')} 轮`,pick:(n,total)=>`第 ${String(n).padStart(2,'0')} / ${total} 组`,summaryIntro:(p,s)=>`选择了 ${p} 幅作品${s?`，跳过了 ${s} 组`:''}。看看什么打动了你。`,shareSummary:(n,d)=>`这一轮，你与 AI 裁判在 ${d} 组可比较的画作中有 ${n} 组选择相同。`,judgeText:(n,d)=>`在 ${d} 组可比较的选择中，你与 AI 裁判有 ${n} 次偏好相同。`,modelText:(n,d)=>`图像特征模型：${d} 次中有 ${n} 次与你一致。`,noComparisons:'本轮暂无已完成 AI 评测的画对。',noModel:'本轮暂无已完成特征模型评测的画对。',openMind:'给发现留一点空间。',openMindText:'这一轮，你的选择有自己的路线。继续看看还有什么吸引你。',allSkippedTitle:'慢慢来，也很好。',allSkippedText:'不必勉强喜欢任何一幅。新一轮还有其他作品等你。',collectionIntro:n=>`你选择过的 ${n} 幅不同作品，汇集成这一方小画廊。`,skipped:'这一组你选择了跳过',yourPick:'你的选择',judges:'AI 裁判',model:'特征模型',support:'加权支持度',prediction:'预测概率',tie:'平局',notAvailable:'暂无结果',samePick:'与你相同',differentPick:'与你不同',community:(n,total)=>`本组 ${total} 次已收集选择中，${n} 次也选择了这幅。`,noCommunity:'这一组暂时没有已收集投票。',communityUnavailable:'投票统计暂不可用。',imageError:'这幅作品未能加载，你可以跳过这一组。',storageError:'浏览器存储已满或不可用。可在此标签页继续体验；新进度和设置仅临时保留，刷新可能恢复旧进度与旧设置。',restoredError:'之前的存档无法恢复，已为你准备新一轮。',picked:'已选择，正在在线保存……',skippedAnnounce:'已跳过，正在在线保存……',leftArtwork:'左侧作品',rightArtwork:'右侧作品',chooseLeft:'选择左侧作品',chooseRight:'选择右侧作品',unknownArtist:'作者信息缺失',unknownDate:'年代信息缺失',mood_calm:'平静',mood_curious:'好奇',mood_energized:'充满活力',mood_reflective:'若有所思',interest_landscape:'风景',interest_people:'人物',interest_nature:'自然',interest_abstract:'抽象形式',interest_stories:'故事',interest_details:'细节',
    brightness_higher:'被光亮吸引。',brightness_lower:'偏爱深一些的色调。',saturation_higher:'色彩抓住了你的目光。',saturation_lower:'看见安静的色彩。',detail_higher:'在细节里停留。',detail_lower:'给画面留一点呼吸。',symmetry_higher:'寻找一点平衡。',symmetry_lower:'意料之外的平衡。',insight:(feature,n,total)=>`在 ${total} 组可比较画对中，你有 ${n} 次选择了${feature}的图像。`,dimension_brightness_higher:'更明亮',dimension_brightness_lower:'更暗',dimension_saturation_higher:'饱和度更高',dimension_saturation_lower:'饱和度更低',dimension_detail_higher:'边缘更密集',dimension_detail_lower:'边缘更疏朗',dimension_symmetry_higher:'左右更对称',dimension_symmetry_lower:'左右较不对称',
  }
};
Object.assign(COPY.en, {
  zoom:'Zoom', zoomLeft:'Zoom in on the left artwork', zoomRight:'Zoom in on the right artwork',
  zoomIn:'Zoom in', zoomOut:'Zoom out', zoomReset:'Reset', zoomHint:'Tap the painting to zoom; drag when enlarged.',
  viewDetails:'View details', viewMet:'Explore at The Met ↗',
  openArtwork:'Open a work to zoom, or follow its Met collection link.',
  featureEyebrow:'YOUR FIRST PICK',
  compareJudge:'You × AI judges', compareModel:'You × feature model',
  compareAria:'Your choices compared with AI', compareCount:(n,d)=>`${n} of ${d} same choices`, compareNone:'No comparable choices yet',
  kappaTile:value=>`Cohen’s κ ${value}`,
  kappaNote:'At most 10 pairs; kappa is a rough guide only.',
  seeDetails:'See details',playAgain:'Play another round — can you match the AI more closely?',shareResult:'Share result ↗',
  linkCopied:'Link copied',shareFailed:'Could not copy. Please try again.',shareFallback:'I explored art with Follow Your Eye.',
  connectionProblem:'Online saving could not start. Please retry before choosing.',
  retryConnection:'Retry connection',
  saveFailed:'Your choice is still on this device but was not saved online. Check your connection, then retry.',
  tapZoom:'Tap the painting to zoom',
});
Object.assign(COPY.zh, {
  zoom:'放大查看', zoomLeft:'放大查看左侧作品', zoomRight:'放大查看右侧作品',
  zoomIn:'放大', zoomOut:'缩小', zoomReset:'重置', zoomHint:'轻点画作可放大，放大后可以拖动查看。',
  viewDetails:'查看详情', viewMet:'前往大都会藏品页 ↗',
  openArtwork:'点开作品可缩放，也可直接前往大都会藏品页。',
  featureEyebrow:'这一轮的第一幅选择',
  compareJudge:'你的选择 × AI 裁判', compareModel:'你的选择 × 特征模型',
  compareAria:'你的选择与 AI 的比较', compareCount:(n,d)=>`${d} 组中有 ${n} 组一致`, compareNone:'暂无可比较的选择',
  kappaTile:value=>`Cohen’s κ ${value}`,
  kappaNote:'最多 10 组画对；kappa 仅供参考。',
  seeDetails:'查看明细',playAgain:'再来一轮，看你能不能和 AI 更合拍',shareResult:'分享结果 ↗',
  linkCopied:'分享文字和链接已复制',shareFailed:'复制失败，请重试。',shareFallback:'我在 Follow Your Eye 探索了艺术作品。',
  connectionProblem:'在线保存暂时无法启动，请重试后再选画。',
  retryConnection:'重试连接',
  saveFailed:'这次选择暂存在当前设备，还没有在线保存。请检查网络后重试。',
  tapZoom:'轻点画作放大',
});
const t = (key, ...args) => typeof COPY[locale][key] === 'function' ? COPY[locale][key](...args) : COPY[locale][key] ?? COPY.en[key] ?? key;
let data, pairsById, playablePairs, preferredOpening, westernPairIds, state;
let view = 'play', busy = false, displayKey = '', renderToken = 0;
let collector = false, connectionProblem = false, checkingCollector = false;
let syncing = false, hasSynced = false, rejected = false, syncController;
let collectorEndpoint = '';
let storageMessage = '', memoryOnly = false, communityRequest = 0, selectedComparison = null;
let zoomScale = 1, zoomX = 0, zoomY = 0, dragPoint = null, zoomDragged = false;

function translate() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = locale === 'zh' ? 'Follow Your Eye — 相信你的眼光' : 'Follow Your Eye — Choose the art you love';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $('languageToggle').textContent = locale === 'en' ? '中文' : 'EN';
  $('languageToggle').setAttribute('aria-label', locale === 'en' ? 'Switch interface to Chinese' : 'Switch interface to English');
  $('settingsOpen').setAttribute('aria-label', t('settings'));
  $('chooseLeft').setAttribute('aria-label', t('chooseLeft'));
  $('chooseRight').setAttribute('aria-label', t('chooseRight'));
  $('leftImage').alt = t('leftArtwork'); $('rightImage').alt = t('rightArtwork');
  if (state) {
    renderSettings(); updateSync(); updateCollectionCount();
    if (view === 'collection') renderCollection();
    else if (state.index >= state.deck.length) renderSummary(false);
    else renderPlay();
  }
  updateStorageWarning();
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function copyProfile(profile) {
  return {mood:profile.mood, interests:[...profile.interests], language:profile.language};
}
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, {...options, signal:controller.signal}); }
  finally { clearTimeout(timer); }
}
function freshState() {
  const sourceParam = new URLSearchParams(location.search).get('source') || 'direct';
  const source = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(sourceParam) ? sourceParam : 'direct';
  return {schema:2,source,presentation:null,datasetVersion:data.version,sessionId:uuid(),roundId:uuid(),roundNumber:1,consent:true,profile:{mood:'',interests:[],language:''},deck:buildRoundWithPreference(playablePairs,[],{openingPairIds:preferredOpening,preferredPairIds:westernPairIds}).deck,index:0,history:[],seen:[],queue:[]};
}
function save() {
  if (memoryOnly) { updateStorageWarning(); return; }
  try { localStorage.setItem(storageKey, JSON.stringify(state)); storageMessage = ''; }
  catch { memoryOnly = true; storageMessage = 'storageError'; }
  updateStorageWarning();
}
// Healthy storage mutations reread the latest snapshot inside one named lock.
// A failed write makes this tab's memory authoritative until reload: rereading
// the older persisted snapshot would silently discard new choices and settings.
// Acknowledgments only remove their own event, so another tab's queued picks survive.
async function mutateState(mutate) {
  const change = () => {
    if (!memoryOnly) {
      try { const raw = localStorage.getItem(storageKey); if (raw) { const latest = JSON.parse(raw); if (isValidState(latest, data)) state = latest; } } catch {}
    }
    const result = mutate(state);
    if (result !== false) save();
    $('contribute').checked = state.consent;
    return result;
  };
  return navigator.locks ? navigator.locks.request(storageKey, change) : change();
}
function updateStorageWarning() {
  $('storageWarning').hidden = !storageMessage;
  $('storageWarning').textContent = storageMessage ? t(storageMessage) : '';
}
function restore() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed, data)) return parsed;
      storageMessage = 'restoredError';
    }
    const old = localStorage.getItem(STORAGE_BASE_KEY);
    if (old) {
      const parsed = JSON.parse(old);
      if (isValidState(parsed, data)) {
        localStorage.setItem(storageKey, old);
        storageMessage = '';
        return parsed;
      }
    }
  } catch { storageMessage = 'restoredError'; }
  return freshState();
}
function validateData(value) {
  if (!value || typeof value.version !== 'string' || !Array.isArray(value.pairs) || !value.pairs.length || !value.artworks) throw new Error('Invalid dataset');
  const seen = new Set();
  for (const pair of value.pairs) {
    if (seen.has(pair.id) || typeof pair.id !== 'string' || !value.artworks[pair.a] || !value.artworks[pair.b] || pair.a === pair.b || ![pair.qA,pair.modelQA].every(v => v === null || (Number.isFinite(v) && v >= 0 && v <= 1))) throw new Error('Invalid pair');
    seen.add(pair.id);
  }
  for (const art of Object.values(value.artworks)) {
    if (!/^(art|met-art)\/\d+\.jpg$/.test(art.image) || !/^https:\/\/www\.metmuseum\.org\/art\/collection\/search\/\d+$/.test(art.sourceUrl)) throw new Error('Invalid artwork link');
  }
}
async function load() {
  $('loadError').hidden = true; $('loading').hidden = false;
  try {
    const [response,selectionResponse,originResponse] = await Promise.all([
      fetch('./met_experience_data.json', {cache:'no-cache'}),
      fetch('./met_style_matched_pairs.json', {cache:'no-cache'}),
      fetch('./met_western_artworks.json', {cache:'no-cache'}),
    ]);
    if (!response.ok || !selectionResponse.ok || !originResponse.ok) throw new Error('Dataset unavailable');
    const loaded = await response.json(), selection = await selectionResponse.json(), origins = await originResponse.json(); validateData(loaded);
    const ids = new Set(selection.pairIds);
    if (selection.sourceVersion !== loaded.version || !Array.isArray(selection.pairIds) || ids.size !== selection.pairIds.length || ids.size < 10 || selection.pairIds.some(id => !loaded.pairs.some(pair => pair.id === id))) throw new Error('Invalid playable pairs');
    if (origins.experienceVersion !== loaded.version || !Array.isArray(origins.westernArtworkIds) || new Set(origins.westernArtworkIds).size !== origins.westernArtworkIds.length || origins.westernArtworkIds.some(id => !loaded.artworks[id])) throw new Error('Invalid artwork groups');
    data = loaded;
    playablePairs = data.pairs.filter(pair => ids.has(pair.id));
    const westernArtworkIds = new Set(origins.westernArtworkIds);
    westernPairIds = playablePairs.filter(pair => westernArtworkIds.has(pair.a) && westernArtworkIds.has(pair.b)).map(pair => pair.id);
    const westernPairs = new Set(westernPairIds);
    preferredOpening = data.openingPairs.filter(id => westernPairs.has(id));
    storageKey = `${STORAGE_BASE_KEY}:${data.version}`;
    pairsById = new Map(data.pairs.map(pair => [pair.id,pair]));
    state = restore(); state.consent = true; $('contribute').checked = true;
    $('loading').hidden = true; $('contributionBar').hidden = false;
    translate(); renderPlay(); checkCollector();
  } catch {
    $('loading').hidden = true; $('loadError').hidden = false;
  }
}
function setViews(next) {
  view = next;
  const completed = state.index >= state.deck.length;
  const pending = state.queue.length > 0;
  $('pendingView').hidden = next !== 'play' || !pending;
  $('playView').hidden = next !== 'play' || completed || pending;
  $('summaryView').hidden = next !== 'play' || !completed || pending;
  $('collectionView').hidden = next !== 'collection';
  $('playNav').classList.toggle('active', next === 'play');
  $('collectionNav').classList.toggle('active', next === 'collection');
  $('playNav').setAttribute('aria-current', next === 'play' ? 'page' : 'false');
  $('collectionNav').setAttribute('aria-current', next === 'collection' ? 'page' : 'false');
}
function renderPlay() {
  if (!state) return;
  setViews('play');
  if (state.queue.length) { updateSync(); return; }
  if (state.index >= state.deck.length) { renderSummary(); return; }
  const item = state.deck[state.index];
  $('roundLabel').textContent = t('round', state.roundNumber);
  $('pickLabel').textContent = t('pick', state.index+1, state.deck.length);
  $('progressSteps').replaceChildren(...state.deck.map((_,i) => {const dot=document.createElement('span'); dot.className=i<state.index?'done':i===state.index?'current':''; return dot;}));
  $('progressSteps').setAttribute('aria-label', `${state.index} / ${state.deck.length}`);
  $('chooseLeft').classList.remove('selected','not-selected'); $('chooseRight').classList.remove('selected','not-selected');
  const key = state.roundId + ':' + state.index;
  if (displayKey !== key) {
    displayKey = key; const token = ++renderToken;
    $('artStage').classList.remove('entering');
    void $('artStage').offsetWidth;
    $('artStage').classList.add('entering');
    $('pairNotice').hidden=true;
    $('chooseLeft').disabled = true; $('chooseRight').disabled = true;
    $('zoomLeft').disabled = $('zoomRight').disabled = true;
    $('skipPair').disabled = true;
    Promise.all([setImage($('leftImage'),data.artworks[item.leftId]),setImage($('rightImage'),data.artworks[item.rightId])]).then(async loaded => {
      if (token !== renderToken) return;
      const expectedRound = state.roundId, expectedIndex = state.index;
      await mutateState(current => {
        if (current.roundId !== expectedRound || current.index !== expectedIndex) return false;
        if (!current.presentation) current.presentation = {roundId:current.roundId,pairId:item.pairId,shownAt:new Date().toISOString()};
      });
      if (token !== renderToken || state.roundId !== expectedRound || state.index !== expectedIndex) {displayKey='';renderPlay();return;}
      const complete = loaded.every(Boolean);
      $('chooseLeft').disabled = $('chooseRight').disabled = !complete || !collector;
      $('zoomLeft').disabled = !loaded[0]; $('zoomRight').disabled = !loaded[1];
      $('skipPair').disabled = !collector;
      if (!complete) {$('announcement').textContent=t('imageError');$('pairNotice').textContent=t('imageError');$('pairNotice').hidden=false;}
    });
    const next = state.deck[state.index+1];
    if (next) [next.leftId,next.rightId].forEach(id => {const img=new Image(); img.src=data.artworks[id].image;});
  }
}
function setImage(img, art) {
  return new Promise(resolve => {
    img.classList.remove('failed');
    img.onload=()=>{img.onload=img.onerror=null; resolve(true);};
    img.onerror=()=>{img.classList.add('failed'); img.onload=img.onerror=null; resolve(false);};
    img.src=art.image;
    if (img.complete) {const valid=img.naturalWidth>0; img.onload=img.onerror=null; img.classList.toggle('failed',!valid); resolve(valid);}
  });
}
async function choose(side) {
  if (!state || busy || !collector || state.queue.length || view !== 'play' || state.index >= state.deck.length || !state.presentation) return;
  if (side !== 'skip' && $(side === 'left' ? 'chooseLeft' : 'chooseRight').disabled) return;
  busy = true;
  const expectedRound = state.roundId, expectedIndex = state.index;
  const accepted = await mutateState(current => {
    if (current.roundId !== expectedRound || current.index !== expectedIndex || !current.presentation) return false;
    const item = current.deck[current.index], pair = pairsById.get(item.pairId);
    const chosenId = side === 'left' ? item.leftId : item.rightId;
    const choice = side === 'skip' ? 'skip' : chosenId === pair.a ? 'A' : 'B';
    const chosenAt = new Date().toISOString();
    if (Date.parse(chosenAt) < Date.parse(current.presentation.shownAt)) return false;
    const stacked=Math.abs($('chooseLeft').getBoundingClientRect().top-$('chooseRight').getBoundingClientRect().top)>5;
    const record = {id:uuid(),sessionId:current.sessionId,roundId:current.roundId,datasetVersion:data.version,pairId:pair.id,leftId:item.leftId,rightId:item.rightId,choice,position:current.index+1,layout:stacked?'stacked':'side-by-side',source:current.source,shownAt:current.presentation.shownAt,chosenAt,elapsedMs:Math.min(3600000,Math.max(0,Date.parse(chosenAt)-Date.parse(current.presentation.shownAt))),profile:copyProfile(current.profile),consent:true};
    current.history.push(record); current.seen.push(pair.id); current.index++; current.presentation=null;
    current.queue.push(record);
    return true;
  });
  if (!accepted) {busy=false;displayKey='';renderPlay();return;}
  updateCollectionCount(); updateSync();
  $('chooseLeft').disabled=$('chooseRight').disabled=$('skipPair').disabled=true;
  if (side !== 'skip') {
    $(side==='left'?'chooseLeft':'chooseRight').classList.add('selected');
    $(side==='left'?'chooseRight':'chooseLeft').classList.add('not-selected');
  }
  $('announcement').textContent=t(side==='skip'?'skippedAnnounce':'picked');
  renderPlay();
  await syncChoices();
  window.setTimeout(()=>{busy=false;if(view==='play')renderPlay();else renderCollection();},matchMedia('(prefers-reduced-motion: reduce)').matches?30:220);
}
function currentRecords() { return state.history.filter(record => record.roundId === state.roundId); }
function uniquePicks(records) { return [...new Set(records.map(record=>chosenArtwork(record,pairsById)).filter(Boolean))]; }
function updateCollectionCount() { $('collectionCount').textContent=uniquePicks(state.history).length; }
function renderSummary(focus=true) {
  setViews('play');
  const records=currentRecords(), picks=records.filter(r=>r.choice!=='skip');
  const judges=agreement(records,pairsById,'qA'), model=agreement(records,pairsById,'modelQA');
  const judgeKappa=cohenKappa(records,pairsById,'qA');
  const modelKappa=cohenKappa(records,pairsById,'modelQA');
  const kappaText=value=>value===null?'—':(Math.abs(value)<.005?'0.00':value.toFixed(2));
  $('heroJudgeKappa').textContent=t('kappaTile',kappaText(judgeKappa.kappa));
  $('heroModelKappa').textContent=t('kappaTile',kappaText(modelKappa.kappa));
  $('roundKappaNote').textContent=t('kappaNote');
  $('shareStatus').hidden=true;
  $('shareStatus').textContent='';
  $('summaryIntro').textContent=t('summaryIntro',picks.length,records.length-picks.length);
  $('heroJudgeScore').textContent=judges.percent===null?'—':`${judges.percent}%`;
  $('heroModelScore').textContent=model.percent===null?'—':`${model.percent}%`;
  $('heroJudgeDetail').textContent=judges.total?t('compareCount',judges.matched,judges.total):t('compareNone');
  $('heroModelDetail').textContent=model.total?t('compareCount',model.matched,model.total):t('compareNone');
  $('shareSummary').textContent=judges.total?t('shareSummary',judges.matched,judges.total):'';
  $('shareSummary').hidden=!judges.total;
  $('judgeScore').textContent=judges.percent===null?'—':`${judges.percent}%`;
  $('judgeText').textContent=judges.total?t('judgeText',judges.matched,judges.total):t('noComparisons');
  $('modelText').textContent=model.total?t('modelText',model.matched,model.total):t('noModel');
  const unrated=records.filter(record=>record.choice!=='skip'&&pairsById.get(record.pairId)?.qA===null).length;
  $('unratedNote').textContent=unrated?(locale==='zh'?`本轮有 ${unrated} 组新画作尚未完成 AI 评测；一致率只计算已有裁判结果的画对。`:`${unrated} new pair${unrated===1?'':'s'} await AI review. Agreement uses only pairs with existing judge results.`):'';
  $('unratedNote').hidden=!unrated;
  $('agreementFill').style.width=`${judges.percent??0}%`;
  const insight=getInsight(records,pairsById,data.artworks);
  if(insight){const k=insight.dimension+'_'+insight.direction;$('insightTitle').textContent=t(k);$('insightText').textContent=t('insight',t('dimension_'+k),insight.count,insight.total);}
  else{$('insightTitle').textContent=t(picks.length?'openMind':'allSkippedTitle');$('insightText').textContent=t(picks.length?'openMindText':'allSkippedText');}
  const ids=uniquePicks(records);
  $('summaryFeature').hidden=!ids.length;
  $('summaryHero').classList.toggle('no-feature',!ids.length);
  if(ids.length){
    const art=data.artworks[ids[0]];
    $('featureImage').src=art.image;$('featureImage').alt=art.title;
    $('featureTitle').textContent=art.title;
    $('featureSource').href=art.sourceUrl;
    $('featureOpen').setAttribute('aria-label',`${t('viewDetails')}: ${art.title}`);
    $('featureOpen').onclick=()=>openArtwork(ids[0]);
  }
  $('insightArtwork').replaceChildren();
  if(ids.length){const button=document.createElement('button');const img=document.createElement('img');img.src=data.artworks[ids[0]].image;img.alt=data.artworks[ids[0]].title;button.append(img);button.addEventListener('click',()=>openArtwork(ids[0]));$('insightArtwork').append(button);}
  renderGallery($('roundGallery'),ids);
  renderComparisons(records);
  if(focus){$('summaryView').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function artworkText(art,key) { return key==='artist'&&art.artist==='Artist not recorded'?t('unknownArtist'):key==='date'&&art.date==='Date not recorded'?t('unknownDate'):art[key]; }
function renderGallery(container,ids) {
  container.replaceChildren(...ids.map(id=>{
    const art=data.artworks[id],card=document.createElement('article'),button=document.createElement('button');card.className='gallery-card';button.className='gallery-open';button.type='button';
    const thumb=document.createElement('span');thumb.className='thumb';const img=document.createElement('img');img.src=art.image;img.alt='';img.loading='lazy';thumb.append(img);
    const title=document.createElement('strong');title.textContent=art.title;
    const artist=document.createElement('small');artist.textContent=artworkText(art,'artist');
    const detail=document.createElement('span');detail.className='gallery-detail';detail.textContent=t('viewDetails');
    const source=document.createElement('a');source.className='gallery-source';source.href=art.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent=t('viewMet');
    button.append(thumb,title,artist,detail);button.setAttribute('aria-label',`${t('viewDetails')}: ${art.title}`);button.addEventListener('click',()=>openArtwork(id));card.append(button,source);return card;
  }));
}
function renderCollection() {
  if(!state)return;setViews('collection');
  const ids=uniquePicks([...state.history].reverse());$('collectionIntro').textContent=t('collectionIntro',ids.length);$('collectionEmpty').hidden=ids.length>0;renderGallery($('collectionGrid'),ids);
}
function openArtwork(id) {
  const art=data.artworks[id];$('detailImage').src=art.image;$('detailImage').alt=art.title;$('artworkTitle').textContent=art.title;$('detailArtist').textContent=artworkText(art,'artist');$('detailDate').textContent=artworkText(art,'date');$('detailSource').href=art.sourceUrl;setZoom(1,0,0);$('artworkDialog').showModal();
}
function setZoom(scale,x=zoomX,y=zoomY) {
  zoomScale=Math.max(1,Math.min(4,scale));
  const area=$('detailImage').parentElement;
  const limitX=area.clientWidth*(zoomScale-1)/2,limitY=area.clientHeight*(zoomScale-1)/2;
  zoomX=Math.max(-limitX,Math.min(limitX,x));zoomY=Math.max(-limitY,Math.min(limitY,y));
  $('detailImage').style.transform=`translate(${zoomX}px,${zoomY}px) scale(${zoomScale})`;
  $('zoomLevel').textContent=`${Math.round(zoomScale*100)}%`;
  $('zoomOut').disabled=zoomScale===1;$('zoomIn').disabled=zoomScale===4;
  area.setAttribute('aria-pressed',String(zoomScale>1));
  area.classList.toggle('can-pan',zoomScale>1);
}
function judgeDescription(record,field) {
  const q=pairsById.get(record.pairId)[field];if(q===null)return locale==='zh'?'尚未评测':'Awaiting review';if(q===.5)return t('tie');
  const preferred=q>.5?'A':'B';return `${t(preferred===record.choice?'samePick':'differentPick')} · ${Math.round(Math.max(q,1-q)*100)}% ${t(field==='qA'?'support':'prediction')}`;
}
function showComparison(field) {
  const details=$('comparisonDetails');
  selectedComparison=field;
  details.open=true;
  details.querySelectorAll('[data-compare]').forEach(el=>el.classList.toggle('is-highlighted',el.dataset.compare===field));
  details.querySelector('summary').focus({preventScroll:true});
  details.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
async function shareResult() {
  const summary=$('shareSummary').hidden?t('shareFallback'):$('shareSummary').textContent;
  const url='https://vincentliu.ai/?source=share';
  if(navigator.share){
    try{await navigator.share({text:summary,url});return;}
    catch(error){if(error?.name==='AbortError')return;}
  }
  const content=`${summary}\n${url}`;
  let copied=false;
  try{if(navigator.clipboard){await navigator.clipboard.writeText(content);copied=true;}}catch{}
  if(!copied){
    const field=document.createElement('textarea');field.value=content;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
    try{copied=document.execCommand('copy');}catch{}
    field.remove();$('shareResult').focus({preventScroll:true});
  }
  $('shareStatus').textContent=t(copied?'linkCopied':'shareFailed');
  $('shareStatus').hidden=false;
}
async function renderComparisons(records) {
  const request=++communityRequest;
  $('comparisonList').replaceChildren(...records.map((record,index)=>{
    const row=document.createElement('div');row.className='comparison-row';
    const number=document.createElement('span');number.className='comparison-number';number.textContent=String(index+1).padStart(2,'0');
    const name=document.createElement('div'),title=document.createElement('strong'),counts=document.createElement('span');counts.dataset.pair=record.pairId;
    const id=chosenArtwork(record,pairsById);title.textContent=id?`${t('yourPick')}: ${data.artworks[id].title}`:t('skipped');counts.textContent=collector?'':t('communityUnavailable');name.append(title,counts);
    const stats=document.createElement('div');stats.className='comparison-stats';
    if(id)for(const [label,field]of[['judges','qA'],['model','modelQA']]){const span=document.createElement('span');span.dataset.compare=field;span.classList.toggle('is-highlighted',selectedComparison===field);span.textContent=`${t(label)}: ${judgeDescription(record,field)}`;stats.append(span);}
    row.append(number,name,stats);return row;
  }));
  if(!collector)return;
  try{
    const response=await fetchWithTimeout(`${collectorEndpoint}/experience/community?pairs=${records.map(r=>encodeURIComponent(r.pairId)).join(',')}`,{},8000);if(!response.ok)throw new Error('Unavailable');
    const result=await response.json();if(request!==communityRequest)return;
    for(const record of records){const el=$('comparisonList').querySelector(`[data-pair="${record.pairId}"]`);if(!el)continue;const counts=result.pairs?.[record.pairId];el.textContent=record.choice==='skip'?'':counts?.total?t('community',record.choice==='A'?counts.a:counts.b,counts.total):t('noCommunity');}
  }catch{if(request===communityRequest)$('comparisonList').querySelectorAll('[data-pair]').forEach(el=>el.textContent=t('communityUnavailable'));}
}
async function nextRound() {
  if(!state||busy)return;
  await mutateState(current=>{
    if(current.index < current.deck.length) return false;
    const next=buildRoundWithPreference(playablePairs,current.seen,{openingPairIds:preferredOpening,preferredPairIds:westernPairIds});if(next.newCycle)current.seen=[];
    current.deck=next.deck;current.index=0;current.roundId=uuid();current.roundNumber++;current.presentation=null;
  });
  selectedComparison=null;displayKey='';renderPlay();window.scrollTo({top:0,behavior:'instant'});$('main').focus({preventScroll:true});
}
function renderSettings() {
  const icons={calm:'◌',curious:'✧',energized:'☀',reflective:'☾'};
  $('moodOptions').replaceChildren(...MOODS.map(mood=>{
    const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=`${icons[mood]} ${t('mood_'+mood)}`;button.setAttribute('aria-pressed',state.profile.mood===mood);button.addEventListener('click',async()=>{await mutateState(current=>{current.profile.mood=current.profile.mood===mood?'':mood;});renderSettings();});return button;
  }));
  $('interestOptions').replaceChildren(...INTERESTS.map(interest=>{
    const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=t('interest_'+interest);button.setAttribute('aria-pressed',state.profile.interests.includes(interest));button.addEventListener('click',async()=>{await mutateState(current=>{current.profile.interests=current.profile.interests.includes(interest)?current.profile.interests.filter(v=>v!==interest):[...current.profile.interests,interest];});renderSettings();});return button;
  }));
  $('profileLanguage').value=state.profile.language;
}
async function checkCollector() {
  if(checkingCollector || !state)return;
  checkingCollector=true;
  try {
    const configResponse=await fetchWithTimeout('./collection_config.json',{cache:'no-cache'},10000);
    if(!configResponse.ok)throw new Error('Configuration unavailable');
    const config=await configResponse.json();
    const secureEndpoint=/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(config.endpoint);
    const localPreview=location.hostname==='127.0.0.1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(config.endpoint);
    if(config.datasetVersion!==data.version||!(secureEndpoint||localPreview))throw new Error('Invalid collector configuration');
    collectorEndpoint=config.endpoint.replace(/\/$/,'');
    collector=true;connectionProblem=false;
  }
  catch{collector=false;connectionProblem=true;collectorEndpoint='';}
  finally{checkingCollector=false;}
  updateSync();
  if(collector) {
    if(state.queue.length)await syncChoices();
    else if(view==='play')renderPlay();
    const ready=$('leftImage').complete&&$('leftImage').naturalWidth>0&&$('rightImage').complete&&$('rightImage').naturalWidth>0;
    if(!state.queue.length&&state.index<state.deck.length){$('chooseLeft').disabled=$('chooseRight').disabled=!ready;$('skipPair').disabled=false;}
  } else {$('chooseLeft').disabled=$('chooseRight').disabled=$('skipPair').disabled=true;}
}
function updateSync() {
  if(!state)return;
  $('syncStatus').textContent=rejected?t('rejected'):state.queue.length?t('pending',state.queue.length):!collector?t('unavailable'):hasSynced?t('savedStudy'):t('collectorReady');
  $('connectionNotice').hidden=!connectionProblem || !!state.queue.length;
  $('pendingExplanation').textContent=state.queue.length && !syncing && (!collector || rejected)
    ? t('saveFailed') : t('pendingExplanation');
  $('retrySave').hidden=!state.queue.length || syncing;
}
async function syncChoices() {
  if(syncing||!state?.queue.length||!collector)return;
  syncing=true;
  updateSync();
  try{
    while(state.queue.length){
      const event=state.queue[0];syncController=new AbortController();const timer=setTimeout(()=>syncController.abort(),20000);
      let response;
      try{response=await fetch(`${collectorEndpoint}/experience/choices`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:syncController.signal});}finally{clearTimeout(timer);}
      if(!response.ok){if(response.status>=400&&response.status<500){rejected=true;}else{collector=false;}break;}
      const result=await response.json();if(result.ok!==true || result.id!==event.id)throw new Error('Invalid acknowledgment');
      await mutateState(current=>{current.queue=current.queue.filter(item=>item.id!==event.id);});hasSynced=true;rejected=false;updateSync();
    }
  }catch{collector=false;}
  finally{syncing=false;syncController=null;updateSync();if(view==='play')renderPlay();if(view==='play'&&state.index>=state.deck.length&&!state.queue.length)renderComparisons(currentRecords());}
}

$('chooseLeft').addEventListener('click',()=>choose('left'));
$('chooseRight').addEventListener('click',()=>choose('right'));
$('zoomLeft').addEventListener('click',()=>{if(state?.deck[state.index])openArtwork(state.deck[state.index].leftId);});
$('zoomRight').addEventListener('click',()=>{if(state?.deck[state.index])openArtwork(state.deck[state.index].rightId);});
$('zoomIn').addEventListener('click',()=>setZoom(zoomScale+.5));
$('zoomOut').addEventListener('click',()=>setZoom(zoomScale-.5));
$('zoomReset').addEventListener('click',()=>setZoom(1,0,0));
const zoomArea=$('detailImage').parentElement;
zoomArea.addEventListener('pointerdown',event=>{zoomDragged=false;if(zoomScale===1)return;dragPoint={id:event.pointerId,x:event.clientX,y:event.clientY,originX:zoomX,originY:zoomY};zoomArea.setPointerCapture(event.pointerId);});
zoomArea.addEventListener('pointermove',event=>{if(dragPoint?.id===event.pointerId){if(Math.abs(event.clientX-dragPoint.x)+Math.abs(event.clientY-dragPoint.y)>5)zoomDragged=true;setZoom(zoomScale,dragPoint.originX+event.clientX-dragPoint.x,dragPoint.originY+event.clientY-dragPoint.y);}});
zoomArea.addEventListener('pointerup',()=>{dragPoint=null;});
zoomArea.addEventListener('pointercancel',()=>{dragPoint=null;});
zoomArea.addEventListener('click',()=>{if(zoomDragged)return;setZoom(zoomScale===1?2:1,0,0);});
zoomArea.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();zoomDragged=false;setZoom(zoomScale===1?2:1,0,0);}});
$('skipPair').addEventListener('click',()=>choose('skip'));
$('nextRound').addEventListener('click',nextRound);
$('nextRoundBottom').addEventListener('click',nextRound);
$('judgeDetails').addEventListener('click',()=>showComparison('qA'));
$('modelDetails').addEventListener('click',()=>showComparison('modelQA'));
$('shareResult').addEventListener('click',shareResult);
$('playNav').addEventListener('click',()=>{if(state){renderPlay();window.scrollTo({top:0,behavior:'instant'});}});
$('collectionNav').addEventListener('click',()=>{if(state){renderCollection();window.scrollTo({top:0,behavior:'instant'});$('collectionView').focus({preventScroll:true});}});
$('backToPlay').addEventListener('click',()=>{renderPlay();window.scrollTo({top:0,behavior:'instant'});});
$('settingsOpen').addEventListener('click',()=>{renderSettings();$('settingsDialog').showModal();});
$('settingsDone').addEventListener('click',()=>$('settingsDialog').close());
$('profileLanguage').addEventListener('change',async event=>{const language=event.target.value;await mutateState(current=>{current.profile.language=language;});});
$('retrySave').addEventListener('click',checkCollector);
$('retryConnection').addEventListener('click',checkCollector);
$('languageToggle').addEventListener('click',()=>{locale=locale==='en'?'zh':'en';try{localStorage.setItem(LOCALE_KEY,locale);}catch{}translate();});
$('retryLoad').addEventListener('click',load);
window.addEventListener('keydown',event=>{
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return;
  const focused=document.activeElement;
  if(['INPUT','SELECT','TEXTAREA','A','SUMMARY'].includes(focused?.tagName))return;
  if(focused?.tagName==='BUTTON' && (!['chooseLeft','chooseRight'].includes(focused.id)||!['ArrowLeft','ArrowRight','s','S'].includes(event.key)))return;
  const side=event.key==='ArrowLeft'?'left':event.key==='ArrowRight'?'right':event.key.toLowerCase()==='s'?'skip':null;
  if(side&&state&&view==='play'&&state.index<state.deck.length){event.preventDefault();choose(side);}
});
window.addEventListener('storage',event=>{if(event.key!==storageKey||!data||memoryOnly)return;try{const raw=localStorage.getItem(storageKey);if(!raw)return;const latest=JSON.parse(raw);if(!isValidState(latest,data))return;const changed=latest.roundId!==state.roundId||latest.index!==state.index;state=latest;if(!state.consent)syncController?.abort();$('contribute').checked=state.consent;updateSync();updateCollectionCount();if(changed){displayKey='';if(view==='play')renderPlay();else renderCollection();}}catch{}});
window.addEventListener('online',checkCollector);
window.addEventListener('focus',()=>{if(state)checkCollector();});
setInterval(()=>{if(state?.queue.length&&!syncing)checkCollector();},15000);
translate();load();
