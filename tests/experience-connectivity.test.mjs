import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {applyArtworkEntry} from '../web/artwork-entry.mjs';
import {isValidState} from '../web/experience-core.mjs';
const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const flow=slice('async function checkCollector()',"$('chooseLeft').addEventListener");
const helper=slice('async function fetchWithTimeout(', 'function freshState()');
const chooseSource=slice('async function choose(', 'function currentRecords()');
const setViewsSource=slice('function setViews(', 'function renderPlay()');
const settle=async h=>{for(let i=0;i<100;i++){await new Promise(r=>setImmediate(r));if(!h.context.syncing&&!h.context.checkingCollector)return;}throw Error('Sync did not settle');};
function setup(events=[{id:'choice-1'}]){
 const elements=new Map(),requests=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',complete:true,naturalWidth:100,disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},getBoundingClientRect:()=>({top:0})});return elements.get(id);};
 let result=503,configFails=false,hold=null;
 const context=vm.createContext({
  state:{queue:structuredClone(events),history:structuredClone(events),index:0,deck:[{},{}]},data:{version:'dataset-1'},location:{hostname:'vincentliu.ai'},
  collector:false,connectionProblem:false,checkingCollector:false,syncing:false,hasSynced:false,rejected:false,memoryOnly:false,
  syncController:null,collectorEndpoint:'',view:'play',busy:false,displayKey:'',$:get,t:(key,n)=>n===undefined?key:`${key}:${n}`,
  AbortController,setTimeout,clearTimeout,Date,crypto:webcrypto,uuid:()=>webcrypto.randomUUID(),copyProfile:p=>({...p}),
  matchMedia:()=>({matches:false}),window:{setTimeout:fn=>fn()},
  renderPlay(){},renderComparisons(){},currentRecords(){return context.state.history;},updateCollectionCount(){},updateStorageWarning(){},renderEntry(){},
  async mutateState(change){return change(context.state);},
  async fetch(url,options){
   requests.push({url,body:options?.body});
   if(url==='./collection_config.json'){
    if(configFails)throw Error('Configuration unavailable');
    return {ok:true,json:async()=>({datasetVersion:'dataset-1',endpoint:'https://collector.example'})};
   }
   if(url==='https://collector.example/experience/choices'){
    if(hold)await hold;
    const status=typeof result==='function'?result(JSON.parse(options.body)):result;
    if(status==='network')throw Error('Network unavailable');
    if(status==='bad-ack')return {ok:true,json:async()=>({ok:true,id:'wrong-id'})};
    return {status,ok:status>=200&&status<300,json:async()=>({ok:true,id:JSON.parse(options.body).id})};
   }
   throw Error(`Unexpected request: ${url}`);
  },
 });
 vm.runInContext(helper+flow+chooseSource+setViewsSource,context);
 return {context,get,requests,result:v=>{result=v;},configFails:v=>{configFails=v;},hold:p=>{hold=p;}};
}

test('failed upload remains queued, never hides play or completed results, and retries the same payload',async()=>{
 const h=setup();await h.context.checkCollector();await settle(h);
 assert.equal(h.context.state.queue.length,1);assert.equal(h.get('syncExplanation').textContent,'localPending');
 assert.equal(h.get('retrySave').hidden,false);
 h.context.setViews('play');assert.equal(h.get('playView').hidden,false);
 h.context.state.index=2;h.context.setViews('play');assert.equal(h.get('summaryView').hidden,false);
 h.result(201);await h.context.checkCollector();await settle(h);
 assert.equal(h.context.state.queue.length,0);assert.equal(h.context.hasSynced,true);
 const posts=h.requests.filter(r=>r.body);assert.equal(posts.length,2);assert.equal(posts[0].body,posts[1].body);
 assert.equal(h.requests.some(r=>r.url.includes('/health')),false);
});

test('configuration failure does not disable choice buttons; memory-only copy is explicit',async()=>{
 const h=setup();h.configFails(true);await h.context.checkCollector();await settle(h);
 assert.equal(h.get('chooseLeft').disabled,false);assert.equal(h.get('chooseRight').disabled,false);
 h.context.memoryOnly=true;h.context.updateSync();assert.equal(h.get('syncExplanation').textContent,'memoryPending');
});

test('bad acknowledgments, auth, routing, rate limits and server failures preserve the event for retry',async()=>{
 for(const status of ['network','bad-ack',401,403,404,429,500,503]){
  const h=setup();h.result(status);await h.context.checkCollector();await settle(h);
  assert.equal(h.context.state.queue.length,1,`${status}`);
  assert.equal(h.context.collector,false,`${status}`);
 }
});

test('permanent rejection is retained in history and does not block later valid uploads',async()=>{
 for(const status of [400,409,413,422]){
  const h=setup([{id:'bad'},{id:'good'}]);h.result(e=>e.id==='bad'?status:201);
  await h.context.checkCollector();await settle(h);
  assert.equal(h.context.state.queue.length,0);
  assert.deepEqual(Array.from(h.context.state.rejectedIds),['bad']);assert.equal(h.context.state.history.length,2);
  assert.equal(h.get('syncStatus').textContent,'rejected');
 }
});

test('multiple choices proceed while upload is unresolved, with unique events and original source',async()=>{
 const h=setup([]),c=h.context;
 c.state={queue:[],history:[],seen:[],roundId:'round',sessionId:'session',source:'artwork-123',index:0,deck:[0,1,2].map(i=>({pairId:`pair-${i}`,leftId:'a',rightId:'b'})),profile:{},presentation:{shownAt:'2026-10-30T12:00:00.000Z'}};
 c.pairsById=new Map([0,1,2].map(i=>[`pair-${i}`,{id:`pair-${i}`,a:'a',b:'b'}]));c.collector=true;c.collectorEndpoint='https://collector.example';
 let release;h.hold(new Promise(r=>{release=r;}));h.result(201);
 await c.choose('left');assert.equal(c.state.index,1);assert.equal(c.busy,false);assert.equal(c.syncing,true);
 c.state.presentation={shownAt:'2026-10-30T12:00:00.000Z'};h.get('chooseLeft').disabled=false;
 await c.choose('left');assert.equal(c.state.index,2);assert.equal(c.state.queue.length,2);
 const ids=c.state.history.map(e=>e.id);assert.equal(new Set(ids).size,2);assert.ok(c.state.history.every(e=>e.source==='artwork-123'));
 release();await settle(h);assert.equal(c.state.queue.length,0);assert.equal(c.state.history.length,2);
});

test('an acknowledgment removes only its event when another tab adds a queued choice',async()=>{
 const h=setup();let release;h.hold(new Promise(r=>{release=r;}));h.result(201);
 await h.context.checkCollector();
 h.context.state.queue.push({id:'from-other-tab'});h.context.state.history.push({id:'from-other-tab'});
 release();await settle(h);assert.equal(h.context.state.queue.length,0);
 assert.deepEqual(h.requests.filter(r=>r.body).map(r=>JSON.parse(r.body).id),['choice-1','from-other-tab']);
});

test('revisiting a seen artwork preserves a valid saved history and pending outbox after each pick',async()=>{
 const data=JSON.parse(readFileSync(new URL('../web/met_experience_data.json',import.meta.url))),allowed=new Set(JSON.parse(readFileSync(new URL('../web/met_style_matched_pairs.json',import.meta.url))).pairIds);
 const pairs=data.pairs.filter(p=>allowed.has(p.id)),anchor=pairs.find(p=>p.a==='45811'||p.b==='45811');
 for(const exhausted of [false,true]){
  const h=setup([]),c=h.context;
  c.data=data;c.pairsById=new Map(data.pairs.map(p=>[p.id,p]));
  c.state={schema:2,datasetVersion:data.version,source:'direct',sessionId:webcrypto.randomUUID(),roundId:webcrypto.randomUUID(),roundNumber:1,consent:true,profile:{mood:'',interests:[],language:''},deck:[],index:0,history:[],queue:[],seen:exhausted?pairs.map(p=>p.id):[anchor.id],presentation:null};
  applyArtworkEntry(c.state,'45811',pairs);
  assert.equal(c.state.seen.length,exhausted?0:1);
  assert.equal(isValidState(c.state,data),true);
  c.state.presentation={roundId:c.state.roundId,pairId:c.state.deck[0].pairId,shownAt:'2026-10-30T12:00:00.000Z'};
  await c.choose('left');
  assert.equal(c.state.index,1);assert.equal(c.state.queue.length,1);
  assert.equal(new Set(c.state.seen).size,c.state.seen.length);
  assert.equal(isValidState(JSON.parse(JSON.stringify(c.state)),data),true,'reload must accept and retain the new history/outbox');
  c.state.presentation={roundId:c.state.roundId,pairId:c.state.deck[1].pairId,shownAt:'2026-10-30T12:00:00.000Z'};h.get('chooseLeft').disabled=false;
  await c.choose('left');assert.equal(c.state.history.length,2);assert.equal(c.state.queue.length,2);
  assert.equal(isValidState(JSON.parse(JSON.stringify(c.state)),data),true);
  const saved=JSON.stringify(c.state);c.storageKey='restore-regression';c.STORAGE_BASE_KEY='legacy';c.localStorage={getItem:()=>saved};c.isValidState=isValidState;
  vm.runInContext(slice('function restore() {','function validateData('),c);
  const restored=c.restore();assert.equal(restored.history.length,2);assert.equal(restored.queue.length,2);
 }
});
