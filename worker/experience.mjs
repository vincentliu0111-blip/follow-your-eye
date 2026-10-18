import manifest from './experience_manifest.json' with { type: 'json' };

const PAIRS = new Map(manifest.pairs.map(pair => [pair.id, pair]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = ['id', 'sessionId', 'roundId', 'datasetVersion', 'pairId', 'leftId', 'rightId',
  'choice', 'position', 'layout', 'source', 'shownAt', 'chosenAt', 'elapsedMs', 'profile', 'consent'];
const CSV_FIELDS = ['id', 'session_id', 'round_id', 'dataset_version', 'pair_id', 'position',
  'left_artwork_id', 'right_artwork_id', 'choice', 'layout', 'source', 'mood', 'interests_json',
  'language', 'shown_at', 'chosen_at', 'elapsed_ms', 'received_at', 'environment', 'country_code', 'client_ip'];
const MOODS = ['', 'calm', 'curious', 'energized', 'reflective'];
const INTERESTS = ['landscape', 'people', 'nature', 'abstract', 'stories', 'details'];
const LANGUAGES = ['', 'en', 'zh', 'es', 'fr', 'other'];

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra}});
}

function cors(origin) {
  return {'access-control-allow-origin': origin, 'vary': 'Origin',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type', 'access-control-max-age': '600'};
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : NaN;
}

function validProfile(profile) {
  return profile && typeof profile === 'object' && !Array.isArray(profile) &&
    Object.keys(profile).length === 3 && ['mood', 'interests', 'language'].every(key => Object.hasOwn(profile, key)) &&
    MOODS.includes(profile.mood) && LANGUAGES.includes(profile.language) &&
    Array.isArray(profile.interests) && profile.interests.length <= INTERESTS.length &&
    new Set(profile.interests).size === profile.interests.length &&
    profile.interests.every(value => INTERESTS.includes(value));
}

function countryCode(request) {
  const code = request.cf?.country;
  return typeof code === 'string' && /^[A-Z]{2}$/.test(code) && code !== 'XX'
    ? code : null;
}

function clientIp(request) {
  const value = request.headers.get('CF-Connecting-IP');
  if (!value || value.length > 45) return null;
  if (value.includes(':')) {
    try { new URL(`http://[${value}]/`); return value; } catch { return null; }
  }
  const octets = value.split('.');
  return octets.length === 4 && octets.every(part => /^\d{1,3}$/.test(part) &&
    Number(part) <= 255 && String(Number(part)) === part) ? value : null;
}

export function validateExperienceEvent(value, now = Date.now()) {
  const hasIpNotice = value && Object.hasOwn(value, 'ipNoticeVersion');
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== FIELDS.length + Number(hasIpNotice) ||
      FIELDS.some(key => !Object.hasOwn(value, key)) ||
      (hasIpNotice && value.ipNoticeVersion !== 1))
    return 'Unexpected or missing event fields';
  if (![value.id, value.sessionId, value.roundId].every(id => typeof id === 'string' && UUID.test(id)))
    return 'Invalid event identifiers';
  if (value.datasetVersion !== manifest.version) return 'Unknown dataset version';
  const pair = PAIRS.get(value.pairId);
  if (!pair || !((value.leftId === pair.a && value.rightId === pair.b) ||
      (value.leftId === pair.b && value.rightId === pair.a))) return 'Pair or artwork does not match the frozen dataset';
  if (!['A', 'B', 'skip'].includes(value.choice)) return 'Invalid choice';
  if (!Number.isInteger(value.position) || value.position < 1 || value.position > 10)
    return 'Invalid round position';
  if (!['side-by-side', 'stacked'].includes(value.layout)) return 'Invalid display layout';
  if (typeof value.source !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.source))
    return 'Invalid source';
  if (!validProfile(value.profile) || value.consent !== true) return 'Invalid contribution fields';
  if (!Number.isInteger(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > 3600000)
    return 'Invalid elapsed time';
  const shown = timestamp(value.shownAt), chosen = timestamp(value.chosenAt);
  if (!Number.isFinite(shown) || !Number.isFinite(chosen) || chosen < shown ||
      shown > now + 300000 || chosen > now + 300000 || chosen - shown > 2592000000 ||
      Math.abs(Math.min(3600000, chosen - shown) - value.elapsedMs) > 5000) return 'Invalid display or choice time';
  return null;
}

async function save(request, env) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > 8192) return json({ok:false,error:'Event too large'}, 413);
  let value;
  try {
    const body = await request.text();
    if (body.length > 8192) return json({ok:false,error:'Event too large'}, 413);
    value = JSON.parse(body);
  } catch { return json({ok:false,error:'Invalid JSON'}, 400); }
  const problem = validateExperienceEvent(value);
  if (problem) return json({ok:false,error:problem}, 400);
  const environment = await env.DB.prepare('SELECT session_id FROM test_sessions WHERE session_id = ?')
    .bind(value.sessionId).first() ? 'test' : 'production';
  const country = countryCode(request);
  const ip = clientIp(request);
  const payload = JSON.stringify(value);
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO experience_choices
    (id,session_id,round_id,dataset_version,pair_id,position,left_artwork_id,right_artwork_id,
     choice,layout,source,mood,interests_json,language,shown_at,chosen_at,elapsed_ms,
     received_at,environment,payload_json,country_code,client_ip)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      value.id, value.sessionId, value.roundId, value.datasetVersion, value.pairId, value.position,
      value.leftId, value.rightId, value.choice, value.layout, value.source, value.profile.mood,
      JSON.stringify(value.profile.interests), value.profile.language, value.shownAt, value.chosenAt,
      value.elapsedMs, new Date().toISOString(), environment, payload, country, ip).run();
  if (result.meta?.changes === 1) return json({ok:true,duplicate:false,id:value.id}, 201);
  const previous = await env.DB.prepare(`SELECT id,payload_json FROM experience_choices
    WHERE id = ? OR (session_id = ? AND round_id = ? AND (pair_id = ? OR position = ?)) LIMIT 1`)
    .bind(value.id, value.sessionId, value.roundId, value.pairId, value.position).first();
  if (previous?.id === value.id && previous.payload_json === payload)
    return json({ok:true,duplicate:true,id:value.id});
  return json({ok:false,error:'A different choice is already recorded for this event or position'}, 409);
}

async function community(url, env) {
  if ([...url.searchParams.keys()].some(key => key !== 'pairs') || url.searchParams.getAll('pairs').length !== 1)
    return json({ok:false,error:'Use one pairs parameter'}, 400);
  const ids = url.searchParams.get('pairs').split(',');
  if (ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => !PAIRS.has(id)))
    return json({ok:false,error:'Request up to ten different known pairs'}, 400);
  const placeholders = ids.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`SELECT pair_id,choice,COUNT(*) AS n FROM experience_choices
    WHERE environment = 'production' AND dataset_version = ? AND pair_id IN (${placeholders})
      AND choice IN ('A','B') GROUP BY pair_id,choice`)
    .bind(manifest.version, ...ids).all()).results;
  const pairs = Object.fromEntries(ids.map(id => [id, {a:0,b:0,total:0}]));
  for (const row of rows) {
    const result = pairs[row.pair_id];
    if (result) { result[row.choice.toLowerCase()] = row.n; result.total += row.n; }
  }
  return json({ok:true,pairs});
}

async function choiceCount(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS choices FROM experience_choices
    WHERE environment = 'production' AND dataset_version = ? AND choice IN ('A','B')`)
    .bind(manifest.version).first();
  return json({ok:true, datasetVersion:manifest.version, choices:row.choices});
}

export async function handleExperience(request, env, url) {
  const origin = request.headers.get('origin');
  if (origin !== env.ALLOWED_ORIGIN) return json({ok:false,error:'Not found'}, 404);
  const headers = cors(origin);
  if (request.method === 'OPTIONS') return new Response(null, {status:204,headers});
  try {
    let response;
    if (url.pathname === '/experience/health' && request.method === 'GET')
      response = json({ok:true,mode:'public-online',datasetVersion:manifest.version});
    else if (url.pathname === '/experience/choices' && request.method === 'POST')
      response = await save(request, env);
    else if (url.pathname === '/experience/community' && request.method === 'GET')
      response = await community(url, env);
    else if (url.pathname === '/experience/choice-count' && request.method === 'GET')
      response = await choiceCount(env);
    else response = json({ok:false,error:'Not found'}, 404);
    const merged = new Headers(response.headers);
    for (const [key, val] of Object.entries(headers)) merged.set(key, val);
    return new Response(response.body, {status:response.status,headers:merged});
  } catch (error) {
    console.error('Experience storage error', error);
    return json({ok:false,error:'Storage unavailable; retry the same choice'}, 503, headers);
  }
}

function csvCell(value) {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? "'" + str : str;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function adminExperience(env, url) {
  if (url.pathname === '/admin/experience-summary') {
    const rows = (await env.DB.prepare(`SELECT environment,dataset_version,COUNT(*) AS choices,
      COUNT(DISTINCT session_id) AS sessions FROM experience_choices
      GROUP BY environment,dataset_version ORDER BY environment,dataset_version`).all()).results;
    return json({ok:true,groups:rows});
  }
  if (url.pathname === '/admin/experience-countries') {
    const environment = url.searchParams.get('environment') ?? 'production';
    if (!['production','test'].includes(environment) ||
        [...url.searchParams.keys()].some(key => key !== 'environment'))
      return json({ok:false,error:'Invalid environment'}, 400);
    const rows = (await env.DB.prepare(`SELECT country_code,COUNT(*) AS choices,
      COUNT(DISTINCT session_id) AS sessions FROM experience_choices
      WHERE environment = ? AND dataset_version = ?
      GROUP BY country_code ORDER BY choices DESC,country_code`)
      .bind(environment, manifest.version).all()).results;
    return json({ok:true,datasetVersion:manifest.version,environment,groups:rows});
  }
  if (url.pathname === '/admin/experience-ips') {
    const environment = url.searchParams.get('environment') ?? 'production';
    if (!['production','test'].includes(environment) ||
        [...url.searchParams.keys()].some(key => key !== 'environment'))
      return json({ok:false,error:'Invalid environment'}, 400);
    const rows = (await env.DB.prepare(`SELECT client_ip,COUNT(*) AS choices,
      COUNT(DISTINCT session_id) AS sessions,MIN(received_at) AS first_seen,
      MAX(received_at) AS last_seen FROM experience_choices
      WHERE environment = ? AND dataset_version = ? AND client_ip IS NOT NULL
      GROUP BY client_ip ORDER BY choices DESC,client_ip`)
      .bind(environment, manifest.version).all()).results;
    return json({ok:true,datasetVersion:manifest.version,environment,groups:rows});
  }
  if (url.pathname === '/admin/experience.csv') {
    const environment = url.searchParams.get('environment') ?? 'production';
    if (!['production','test'].includes(environment)) return json({ok:false,error:'Invalid environment'}, 400);
    const rows = (await env.DB.prepare(`SELECT ${CSV_FIELDS.join(',')} FROM experience_choices
      WHERE environment = ? AND dataset_version = ? ORDER BY received_at,id`)
      .bind(environment, manifest.version).all()).results;
    const csv = [CSV_FIELDS.join(','), ...rows.map(row => CSV_FIELDS.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
    return new Response(csv, {headers:{'content-type':'text/csv; charset=utf-8',
      'content-disposition':`attachment; filename="follow-your-eye-experience-${environment}.csv"`,
      'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  return json({ok:false,error:'Not found'}, 404);
}
