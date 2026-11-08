import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {StudyClient,STUDY_KEY,NOTICE_VERSION} from '../web/study-client.mjs';
const uuid=()=>crypto.randomUUID();
function setup(disk=new Map()){
 const requests=[],sessions=new Map();let fail=false,result=201,hold;
 const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
 const config={ok:true,open:true,preview:false,noticeVersion:NOTICE_VERSION,retentionDays:365,protocolVersion:'protocol-1'};
 const fetcher=async(url,options={})=>{
  const p=new URL(url).pathname,v=options.body?JSON.parse(options.body):null;requests.push({path:p,body:v,authorization:options.headers?.authorization});
  if(fail)throw Error('offline');
  const response=(v,status=200)=>new Response(JSON.stringify(v),{status});
  if(p==='/study/config')return response(config);
  if(p==='/study/sessions'){
   const s={ok:true,studySessionId:uuid(),token:'a'.repeat(64),consentedAt:new Date(Date.now()-10).toISOString(),noticeVersion:NOTICE_VERSION,protocolVersion:'protocol-1'};sessions.set(s.studySessionId,{...s,active:true});return response(s,201);
  }
  if(p==='/study/answers'){
   if(hold)await hold;const status=typeof result==='function'?result(v):result;
   return response({ok:true,id:status==='bad-ack'?'wrong':v.id},status==='bad-ack'?200:status);
  }
  const id=p.split('/')[3],s=sessions.get(id);
  if(p.endsWith('/withdraw')||p.endsWith('/delete')){if(s)s.active=false;return response({ok:true});}
  if(p.startsWith('/study/sessions/'))return response({ok:true,active:s?.active??true});
  throw Error('unexpected path');
 };
 const chains=new Map();const locks={request(key,fn){const next=(chains.get(key)??Promise.resolve()).then(fn);chains.set(key,next.catch(()=>{}));return next;}};
 const client=new StudyClient({storage,fetcher,endpoint:'https://collector.test',locks});
 return {client,requests,disk,storage,fetcher,config,locks,sessions,offline:v=>fail=v,result:v=>result=v,hold:v=>hold=v};
}
function record(overrides={}){const now=new Date().toISOString();return {id:uuid(),roundId:uuid(),sessionId:uuid(),datasetVersion:'data-1',pairId:'pair-1',leftId:'a',rightId:'b',choice:'A',chosenArtworkId:'a',position:1,layout:'side-by-side',shownAt:now,chosenAt:now,elapsedMs:0,profile:{mood:'calm',interests:['nature'],language:'fr'},source:'private-source',consent:true,...overrides};}
const settle=async c=>{for(let i=0;i<200;i++){await new Promise(r=>setImmediate(r));if(!c.sending)return;}throw Error('did not settle');};

test('initializing or restoring a legacy browser creates no study session and uploads no legacy queue',async()=>{const h=setup();h.disk.set('follow-your-eye-experience-v1',JSON.stringify({consent:true,queue:[record()]}));await h.client.initialize('https://collector.test');assert.equal(h.client.active,false);assert.deepEqual(h.requests.map(r=>r.path),['/study/config']);assert.equal(h.client.read(),null);});
test('only explicit enrollment sends adult confirmation/version/language and allows answering',async()=>{const h=setup();assert.equal(await h.client.enroll('zh'),true);const sent=h.requests.find(r=>r.path==='/study/sessions');assert.deepEqual(sent.body,{adultConfirmed:true,noticeVersion:NOTICE_VERSION,language:'zh'});assert.equal(h.client.active,true);assert.ok(h.client.read().session.studySessionId);});
test('no consent or unavailable browser storage blocks enrollment and answers without creating a session',async()=>{const h=setup();assert.equal(await h.client.enqueue(record()),false);const c=new StudyClient({storage:{getItem:()=>null,setItem(){throw Error('full');}},fetcher:h.fetcher,endpoint:'https://collector.test'});assert.equal(await c.enroll('en'),false);assert.equal(h.requests.filter(r=>r.path==='/study/sessions').length,0);});
test('research event is minimized and session token is confined to authorization header',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());await h.client.flush();const r=h.requests.find(r=>r.path==='/study/answers');for(const k of ['profile','source','sessionId','consent','token','clientIp'])assert.equal(Object.hasOwn(r.body,k),false);assert.equal(r.body.chosenArtworkId,'a');assert.match(r.authorization,/^Bearer /);});
test('offline upload keeps identical event/choice time for retry; round can keep progressing',async()=>{const h=setup();await h.client.enroll('en');const a=record();await h.client.enqueue(a);h.offline(true);await h.client.flush();assert.equal(h.client.pending,1);await h.client.enqueue(record({position:2}));assert.equal(h.client.pending,2);h.offline(false);await h.client.refresh();await settle(h.client);assert.equal(h.client.pending,0);const attempts=h.requests.filter(r=>r.path==='/study/answers'&&r.body.id===a.id);assert.deepEqual(attempts[0].body,attempts[1].body);});
test('bad acknowledgments and transient/auth-route failures never silently mark an answer saved',async()=>{for(const status of ['bad-ack',404,429,500,503]){const h=setup();await h.client.enroll('en');await h.client.enqueue(record());h.result(status);await h.client.flush();assert.equal(h.client.pending,1,String(status));}});
test('invalid event rejection does not block later valid events; participant sees rejected IDs',async()=>{const h=setup();await h.client.enroll('en');const bad=record();await h.client.enqueue(bad);await h.client.enqueue(record({position:2}));h.result(e=>e.id===bad.id?422:201);await h.client.flush();assert.equal(h.client.pending,0);assert.deepEqual(h.client.read().rejected,[bad.id]);});
test('server withdrawal/closed-study responses terminate queue and never restore automatic retry',async()=>{for(const status of [401,403,410]){const h=setup();await h.client.enroll('en');await h.client.enqueue(record());h.result(status);await h.client.flush();assert.equal(h.client.active,false);assert.equal(h.client.pending,0);const sent=h.requests.filter(r=>r.path==='/study/answers').length;await h.client.refresh();await h.client.flush();assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,sent);}});
test('offline exit durably cancels unsent answers; refresh, reconnect and another tab cannot resume uploads',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());h.offline(true);await h.client.end();assert.equal(h.client.active,false);assert.equal(h.client.pending,0);const other=new StudyClient({storage:h.storage,fetcher:h.fetcher,endpoint:'https://collector.test',locks:h.locks});h.offline(false);await other.refresh();assert.equal(other.active,false);assert.equal(other.pending,0);await other.flush();assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,0);assert.equal(h.client.read().status,'ended');});
test('durable exit marker defeats a stale active snapshot written by another tab',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());const stale=JSON.stringify(h.client.read());await h.client.end();h.disk.set(STUDY_KEY,stale);await h.client.refresh();assert.equal(h.client.active,false);await h.client.flush();assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,0);});
test('another tab adding an answer while acknowledgment is pending preserves both events exactly once',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());let release;h.hold(new Promise(r=>release=r));const sending=h.client.flush();await new Promise(r=>setImmediate(r));await h.client.enqueue(record({position:2}));release();await sending;assert.equal(h.client.pending,0);assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,2);});
test('withdrawal during in-flight upload cannot restore the queue on acknowledgment',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());let release;h.hold(new Promise(r=>release=r));const sending=h.client.flush();await new Promise(r=>setImmediate(r));await h.client.end();release();await sending;assert.equal(h.client.active,false);assert.equal(h.client.pending,0);assert.equal(h.client.read().status,'ended');});
test('offline deletion stays pending until reconnected, then prevents further uploads',async()=>{const h=setup();await h.client.enroll('en');h.offline(true);await h.client.end(true);assert.equal(h.client.read().status,'delete-pending');assert.equal(await h.client.enroll('en'),false);h.offline(false);await h.client.refresh();assert.equal(h.client.read().status,'deleted');assert.equal(h.client.active,false);});
test('outdated notices/configuration cannot silently restore previous consent',async()=>{const h=setup();await h.client.enroll('en');h.config.noticeVersion='new';await h.client.refresh();assert.equal(h.client.active,false);assert.equal(h.requests.filter(r=>r.path==='/study/sessions').length,1);});
test('real choice handler rejects both mouse and keyboard paths before enrollment',async()=>{const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),a=source.indexOf('async function choose('),b=source.indexOf('function currentRecords()',a);const c=vm.createContext({study:{active:false},state:{index:0,deck:[{}],presentation:{}},busy:false,view:'play'});vm.runInContext(source.slice(a,b),c);await c.choose('left');await c.choose('right');await c.choose('skip');assert.equal(c.state.index,0);});

test('simultaneous enrollment without Web Locks preserves the other tab outbox and withdraws superseded session',async()=>{
 const h=setup();let release,arrival;const arrived=new Promise(r=>arrival=r),pause=new Promise(r=>release=r);let first=true;
 const delayed=async(url,o)=>{const r=await h.fetcher(url,o);if(new URL(url).pathname==='/study/sessions'&&first){first=false;arrival();await pause;}return r;};
 const a=new StudyClient({storage:h.storage,fetcher:delayed,endpoint:'https://collector.test',locks:null}),b=new StudyClient({storage:h.storage,fetcher:h.fetcher,endpoint:'https://collector.test',locks:null});
 const enrolling=a.enroll('en');await arrived;await b.enroll('zh');await b.enqueue(record());const id=b.read().session.studySessionId;release();await enrolling;
 assert.equal(a.read().session.studySessionId,id);assert.equal(a.pending,1);assert.ok(h.requests.some(r=>r.path.endsWith('/withdraw')));
});
test('a late enrollment reply cannot revive research after another tab exits',async()=>{
 const h=setup();let release,arrival;const arrived=new Promise(r=>arrival=r),pause=new Promise(r=>release=r);
 const delayed=async(url,o)=>{const r=await h.fetcher(url,o);if(new URL(url).pathname==='/study/sessions'){arrival();await pause;}return r;};
 const a=new StudyClient({storage:h.storage,fetcher:delayed,endpoint:'https://collector.test',locks:null}),b=new StudyClient({storage:h.storage,fetcher:h.fetcher,endpoint:'https://collector.test',locks:null});
 const enrolling=a.enroll('en');await arrived;await b.enroll('zh');await b.end();release();assert.equal(await enrolling,false);assert.equal(a.active,false);assert.equal(a.read().status,'ended');assert.equal([...h.sessions.values()].filter(s=>s.active).length,0);
});
test('an exit during the first in-flight enrollment prevents any restored active session',async()=>{
 const h=setup();let release,arrival;const arrived=new Promise(r=>arrival=r),pause=new Promise(r=>release=r);
 const a=new StudyClient({storage:h.storage,fetcher:async(u,o)=>{const r=await h.fetcher(u,o);if(new URL(u).pathname==='/study/sessions'){arrival();await pause;}return r;},endpoint:'https://collector.test',locks:null});
 const enrolling=a.enroll('en');await arrived;await a.end();release();assert.equal(await enrolling,false);assert.equal(a.active,false);assert.equal(a.read(),null);assert.equal([...h.sessions.values()].filter(s=>s.active).length,0);
});
test('research close stops new answering but preserves and flushes earlier queued answers',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());h.config.open=false;await h.client.refresh();await settle(h.client);assert.equal(h.client.active,false);assert.equal(h.client.pending,0);assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,1);assert.equal(await h.client.enqueue(record()),false);});
test('gallery/about direct exit retry reconciles a stale active outbox from durable deletion marker',async()=>{const h=setup();await h.client.enroll('en');await h.client.enqueue(record());const stale=JSON.stringify(h.client.read());h.offline(true);await h.client.end(true);h.disk.set(STUDY_KEY,stale);const other=new StudyClient({storage:h.storage,fetcher:h.fetcher,endpoint:'https://collector.test',locks:h.locks});h.offline(false);await other.sendEnd();assert.equal(other.read().status,'deleted');assert.equal(other.pending,0);assert.equal(h.requests.filter(r=>r.path==='/study/answers').length,0);assert.ok(h.requests.some(r=>r.path.endsWith('/delete')));});
test('an exit during enrollment configuration refresh cancels that earlier click',async()=>{
 const h=setup();await h.client.enroll('en');let release,arrival;const pause=new Promise(r=>release=r),arrived=new Promise(r=>arrival=r);let waiting=true;
 const b=new StudyClient({storage:h.storage,fetcher:async(u,o)=>{if(new URL(u).pathname==='/study/config'&&waiting){waiting=false;arrival();await pause;}return h.fetcher(u,o);},endpoint:'https://collector.test',locks:h.locks});
 const enrolling=b.enroll('en');await arrived;await h.client.end();release();assert.equal(await enrolling,false);assert.equal(b.read().status,'ended');assert.equal(h.requests.filter(r=>r.path==='/study/sessions').length,1);
});
test('an exit cancels enrollment clicks already waiting on another tab enrollment lock',async()=>{
 const h=setup();let release,arrival;const pause=new Promise(r=>release=r),arrived=new Promise(r=>arrival=r);
 const a=new StudyClient({storage:h.storage,fetcher:async(u,o)=>{const r=await h.fetcher(u,o);if(new URL(u).pathname==='/study/sessions'){arrival();await pause;}return r;},endpoint:'https://collector.test',locks:h.locks});
 const b=new StudyClient({storage:h.storage,fetcher:h.fetcher,endpoint:'https://collector.test',locks:h.locks});
 const first=a.enroll('en');await arrived;const second=b.enroll('zh');await a.end();release();assert.equal(await first,false);assert.equal(await second,false);assert.equal(a.active,false);assert.equal(b.active,false);assert.equal(h.requests.filter(r=>r.path==='/study/sessions').length,1);
});
test('linked connection diagnostic uses only read-only study/config and eligible count routes, including local preview',async()=>{
 const code=readFileSync(new URL('../web/connection.js',import.meta.url),'utf8');
 for(const endpoint of ['http://127.0.0.1:8781','https://collector.test']){
  const requests=[],output={textContent:''},button={disabled:false,addEventListener(_e,fn){this.run=fn;}};
  const c=vm.createContext({document:{getElementById:id=>id==='runCheck'?button:output},location:{hostname:'127.0.0.1'},AbortController,setTimeout,clearTimeout,performance,Date,fetch:async(url,o)=>{requests.push({url,o});return new Response(JSON.stringify(url==='./collection_config.json'?{endpoint,datasetVersion:'data-1'}:url.endsWith('/study/config')?{ok:true,datasetVersion:'data-1',preview:true,open:false}:{ok:true,choices:0,scope:'eligible-study-only'}));}});
  vm.runInContext(code,c);await button.run();assert.equal(requests.length,3);assert.ok(requests.every(r=>!r.o.method));assert.equal(requests.filter(r=>r.url.endsWith('/study/config')).length,1);assert.equal(requests.filter(r=>r.url.endsWith('/experience/choice-count')).length,1);assert.ok(output.textContent.includes('未提交作答'));assert.equal(button.disabled,false);
 }
});
