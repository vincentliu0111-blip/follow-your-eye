import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from './worker.mjs';
import {validateExperienceEvent} from './experience.mjs';
import manifest from './experience_manifest.json' with {type:'json'};

const origin = 'https://vincentliu.ai';
const uuid = () => crypto.randomUUID();

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return {
    sqlite,
    prepare(sql) {
      const bind = (...params) => {
        const stmt = sqlite.prepare(sql);
        return {
          first: async () => stmt.get(...params) ?? null,
          all: async () => ({results: stmt.all(...params)}),
          run: async () => ({meta:{changes:stmt.run(...params).changes}})
        };
      };
      return {bind, ...bind()};
    }
  };
}

function event(overrides = {}) {
  const pair = manifest.pairs[0], chosenAt = new Date(), shownAt = new Date(chosenAt.getTime()-3000);
  return {id:uuid(),sessionId:uuid(),roundId:uuid(),datasetVersion:manifest.version,
    pairId:pair.id,leftId:pair.a,rightId:pair.b,choice:'A',position:1,layout:'side-by-side',
    source:'direct',shownAt:shownAt.toISOString(),chosenAt:chosenAt.toISOString(),elapsedMs:3000,
    profile:{mood:'',interests:[],language:''},consent:true,ipNoticeVersion:1,...overrides};
}

async function call(env, path, method='GET', body=null, token=null, options={}) {
  const headers={origin,...(body?{'content-type':'application/json'}:{}),
    ...(token?{authorization:`Bearer ${token}`}:{}),
    ...(options.spoofCountry?{'cf-ipcountry':options.spoofCountry}:{}),
    ...(options.ip?{'cf-connecting-ip':options.ip}:{})};
  const request=new Request(`https://collector.example${path}`,{
    method,headers,...(body?{body:JSON.stringify(body)}:{})});
  if (Object.hasOwn(options,'country')) Object.defineProperty(request,'cf',{value:{country:options.country}});
  return worker.fetch(request,env);
}

test('screened pairs and required online event fields', () => {
  assert.equal(manifest.pairs.length,2751);
  const good=event();
  assert.equal(validateExperienceEvent(good),null);
  assert.equal(validateExperienceEvent({...good,choice:'skip'}),null);
  for(const change of [{datasetVersion:'other'},{leftId:'0'},{position:11},{consent:false},
    {profile:{mood:'fake',interests:[],language:''}},{choice:'C'},{source:'bad/url'},
    {elapsedMs:-1},{name:'unrequested'},{clientIp:'203.0.113.99'},
    {ipNoticeVersion:2}])
    assert.notEqual(validateExperienceEvent({...good,...change}),null);
});

test('v7 migration preserves the existing 60-pair table and data', () => {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE choices (id TEXT PRIMARY KEY,payload_json TEXT NOT NULL);
    INSERT INTO choices VALUES ('old-event','{"choice":"A"}');`);
  sqlite.exec(readFileSync(new URL('./migrate_experience_v7.sql',import.meta.url),'utf8'));
  assert.equal(sqlite.prepare('SELECT payload_json FROM choices WHERE id = ?').get('old-event').payload_json,'{"choice":"A"}');
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='experience_choices'").get().n,1);
});

test('country migration preserves earlier choices as unknown', () => {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  sqlite.exec('DROP TABLE experience_choices');
  sqlite.exec(readFileSync(new URL('./migrate_experience_v7.sql',import.meta.url),'utf8'));
  const old=event();
  sqlite.prepare(`INSERT INTO experience_choices
    (id,session_id,round_id,dataset_version,pair_id,position,left_artwork_id,right_artwork_id,
     choice,layout,source,mood,interests_json,language,shown_at,chosen_at,elapsed_ms,
     received_at,environment,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(old.id,old.sessionId,old.roundId,old.datasetVersion,old.pairId,old.position,
      old.leftId,old.rightId,old.choice,old.layout,old.source,'','[]','',old.shownAt,
      old.chosenAt,old.elapsedMs,old.chosenAt,'production',JSON.stringify(old));
  sqlite.exec(readFileSync(new URL('./migrate_experience_country.sql',import.meta.url),'utf8'));
  const earlier=sqlite.prepare('SELECT id,country_code FROM experience_choices').get();
  assert.equal(earlier.id,old.id);
  assert.equal(earlier.country_code,null);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='experience_country'").get().n,1);
});

test('IP migration preserves existing choices with unknown IP', () => {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  sqlite.exec('DROP TABLE experience_choices');
  sqlite.exec(readFileSync(new URL('./migrate_experience_v7.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('./migrate_experience_country.sql',import.meta.url),'utf8'));
  const old=event();
  sqlite.prepare(`INSERT INTO experience_choices
    (id,session_id,round_id,dataset_version,pair_id,position,left_artwork_id,right_artwork_id,
     choice,layout,source,mood,interests_json,language,shown_at,chosen_at,elapsed_ms,
     received_at,environment,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(old.id,old.sessionId,old.roundId,old.datasetVersion,old.pairId,old.position,
      old.leftId,old.rightId,old.choice,old.layout,old.source,'','[]','',old.shownAt,
      old.chosenAt,old.elapsedMs,old.chosenAt,'production',JSON.stringify(old));
  sqlite.exec(readFileSync(new URL('./migrate_experience_ip.sql',import.meta.url),'utf8'));
  const earlier=sqlite.prepare('SELECT id,client_ip FROM experience_choices').get();
  assert.equal(earlier.id,old.id);
  assert.equal(earlier.client_ip,null);
});

test('online v7 save, retry, conflict, community and private export use real SQLite', async () => {
  const DB=database(),env={DB,ADMIN_TOKEN:'owner-secret',ALLOWED_ORIGIN:origin};
  const pick=event(), session=pick.sessionId;
  assert.equal((await call(env,'/experience/health')).status,200);
  assert.equal((await call(env,'/admin/experience.csv')).status,401);
  assert.equal((await call(env,'/admin/experience-ips')).status,401);
  assert.equal((await call(env,'/admin/test-sessions','POST',{sessionId:session},'owner-secret')).status,200);
  const first=await call(env,'/experience/choices','POST',pick,null,{country:'US',ip:'203.0.113.4'});
  assert.equal(first.status,201);
  assert.equal(first.headers.get('access-control-allow-origin'),origin);
  assert.equal((await call(env,'/experience/choices','POST',pick)).status,200);
  assert.equal((await call(env,'/experience/choices','POST',{...pick,id:uuid(),choice:'B'})).status,409);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM experience_choices').get().n,1);
  assert.equal(DB.sqlite.prepare('SELECT client_ip FROM experience_choices').get().client_ip,'203.0.113.4');
  const csv=await (await call(env,'/admin/experience.csv?environment=test','GET',null,'owner-secret')).text();
  assert.match(csv,new RegExp(pick.id));
  assert.match(csv,/interests_json/);
  assert.match(csv,/country_code/);
  assert.match(csv,/client_ip/);
  assert.match(csv,/"203\.0\.113\.4"/);
  assert.match(csv,/"US"/);
  const testCountries=await (await call(env,'/admin/experience-countries?environment=test','GET',null,'owner-secret')).json();
  assert.deepEqual(testCountries.groups,[{country_code:'US',choices:1,sessions:1}]);
  const testIps=await (await call(env,'/admin/experience-ips?environment=test','GET',null,'owner-secret')).json();
  assert.equal(testIps.groups.length,1);
  assert.equal(testIps.groups[0].client_ip,'203.0.113.4');
  assert.equal(testIps.groups[0].choices,1);
  assert.equal(testIps.groups[0].sessions,1);
  assert.equal((await (await call(env,'/experience/choice-count')).json()).choices,0);
  const community=await (await call(env,`/experience/community?pairs=${pick.pairId}`)).json();
  assert.deepEqual(community.pairs[pick.pairId],{a:0,b:0,total:0});
  const deleted=await (await call(env,`/admin/test-sessions/${session}`,'DELETE',null,'owner-secret')).json();
  assert.equal(deleted.deleted,1);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM experience_choices').get().n,0);

  const publicPick=event({choice:'skip'});
  assert.equal((await call(env,'/experience/choices','POST',publicPick,null,{country:'CA'})).status,201);
  const second=event({choice:'B',sessionId:publicPick.sessionId,roundId:uuid()});
  assert.equal((await call(env,'/experience/choices','POST',second,null,{country:'US',ip:'2001:db8::1'})).status,201);
  const unknown=event();
  assert.equal((await call(env,'/experience/choices','POST',unknown,null,{spoofCountry:'FR',ip:'999.0.0.1'})).status,201);
  assert.equal(DB.sqlite.prepare('SELECT country_code FROM experience_choices WHERE id = ?').get(unknown.id).country_code,null);
  assert.equal(DB.sqlite.prepare('SELECT client_ip FROM experience_choices WHERE id = ?').get(second.id).client_ip,'2001:db8::1');
  assert.equal(DB.sqlite.prepare('SELECT client_ip FROM experience_choices WHERE id = ?').get(unknown.id).client_ip,null);
  const counts=await (await call(env,`/experience/community?pairs=${pick.pairId}`)).json();
  assert.deepEqual(counts.pairs[pick.pairId],{a:1,b:1,total:2});
  const publicCount=await call(env,'/experience/choice-count');
  assert.equal(publicCount.headers.get('cache-control'),'no-store');
  assert.deepEqual(await publicCount.json(),{ok:true,datasetVersion:manifest.version,choices:2});
  const summary=await (await call(env,'/admin/experience-summary','GET',null,'owner-secret')).json();
  assert.deepEqual(summary.groups,[{environment:'production',dataset_version:manifest.version,choices:3,sessions:2}]);
  assert.equal((await call(env,'/admin/experience-countries')).status,401);
  const ips=await (await call(env,'/admin/experience-ips','GET',null,'owner-secret')).json();
  assert.equal(ips.groups.length,1);
  assert.equal(ips.groups[0].client_ip,'2001:db8::1');
  assert.equal(ips.groups[0].choices,1);
  assert.equal(ips.groups[0].sessions,1);
  assert.equal((await call(env,'/admin/experience-ips?environment=other','GET',null,'owner-secret')).status,400);
  const countries=await (await call(env,'/admin/experience-countries','GET',null,'owner-secret')).json();
  assert.deepEqual(countries.groups,[
    {country_code:null,choices:1,sessions:1},
    {country_code:'CA',choices:1,sessions:1},
    {country_code:'US',choices:1,sessions:1}
  ]);
  assert.equal((await call(env,'/admin/experience-countries?environment=other','GET',null,'owner-secret')).status,400);
  assert.equal((await call(env,'/experience/community?pairs=unknown')).status,400);
  assert.equal((await worker.fetch(new Request('https://collector.example/experience/health',
    {headers:{origin:'https://other.example'}}),env)).status,404);
});

test('owner IP summary groups separate anonymous sessions without public exposure', async () => {
  const DB=database(), env={DB,ADMIN_TOKEN:'owner-secret',ALLOWED_ORIGIN:origin};
  const first=event(), second=event();
  assert.equal((await call(env,'/experience/choices','POST',first,null,{ip:'198.51.100.7'})).status,201);
  assert.equal((await call(env,'/experience/choices','POST',second,null,{ip:'198.51.100.7'})).status,201);
  const response=await call(env,'/admin/experience-ips','GET',null,'owner-secret');
  assert.equal(response.headers.get('cache-control'),'no-store');
  const data=await response.json();
  assert.equal(data.groups.length,1);
  assert.equal(data.groups[0].client_ip,'198.51.100.7');
  assert.equal(data.groups[0].choices,2);
  assert.equal(data.groups[0].sessions,2);
  assert.ok(data.groups[0].first_seen <= data.groups[0].last_seen);
  assert.equal((await call(env,'/experience/ips')).status,404);
});

test('choices from an older page save the connecting IP when available', async () => {
  const DB=database(), env={DB,ADMIN_TOKEN:'owner-secret',ALLOWED_ORIGIN:origin};
  const older=event();
  delete older.ipNoticeVersion;
  assert.equal(validateExperienceEvent(older),null);
  assert.equal((await call(env,'/experience/choices','POST',older,null,{ip:'198.51.100.8'})).status,201);
  assert.equal(DB.sqlite.prepare('SELECT client_ip FROM experience_choices WHERE id = ?').get(older.id).client_ip,'198.51.100.8');
});
