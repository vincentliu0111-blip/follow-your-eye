import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../web/experience-core.mjs';
import {applyArtworkEntry,buildArtworkRound} from '../web/artwork-entry.mjs';
import {ARTWORK_PAGES,ZH_ARTWORK_PAGES} from '../web/artwork-pages.mjs';

const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const declarations=source.slice(0,source.indexOf("$('consentAccept').addEventListener")).replace(/^import .*;\n/gm,'');
const fixture=JSON.parse(readFileSync(new URL('../web/met_experience_data.json',import.meta.url)));
const selection=JSON.parse(readFileSync(new URL('../web/met_style_matched_pairs.json',import.meta.url)));

function setup({search='',unavailable=false}={}){
  const original='{"version":1,"status":"active","queue":[{"id":"old-unsent-answer"}]}';
  const disk=new Map([['follow-your-eye-study-v1',original],['follow-your-eye-experience-v1',original]]);
  const elements=new Map(),requests=[];let clients=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',classList:{add(){},remove(){},toggle(){}},getBoundingClientRect:()=>({top:0}),focus(){}});return elements.get(id);};
  const context=vm.createContext({...core,applyArtworkEntry,buildArtworkRound,ARTWORK_PAGES,ZH_ARTWORK_PAGES,fixture,selection,
    URLSearchParams,EventTarget,crypto,Date,AbortController,setTimeout,clearTimeout,
    location:{search,hostname:'127.0.0.1'},navigator:{locks:{request:async(_key,fn)=>fn()}},
    localStorage:{getItem:k=>disk.get(k)??null,setItem(k,v){if(unavailable)throw Error('full');disk.set(k,v);}},
    document:{getElementById:element},matchMedia:()=>({matches:true}),
    fetch:async(...args)=>{requests.push(args);throw Error('collector must not be called');},
    StudyClient:class extends EventTarget{constructor(){super();clients++;this.active=false;}},
    window:{setTimeout:fn=>fn(),scrollTo(){}},
  });
  vm.runInContext(declarations,context);
  vm.runInContext(`data=fixture;playablePairs=data.pairs.filter(p=>selection.pairIds.includes(p.id));preferredOpening=[];westernPairIds=[];pairsById=new Map(data.pairs.map(p=>[p.id,p]));storageKey=STORAGE_BASE_KEY+':'+data.version;state=freshState();
    renderPlay=()=>{if(state.index<state.deck.length){state.presentation={roundId:state.roundId,pairId:state.deck[state.index].pairId,shownAt:new Date().toISOString()};save();for(const id of ['chooseLeft','chooseRight','skipPair'])$(id).disabled=false;}};
    renderCollection=()=>{};renderPlay();`,context);
  return {context,disk,original,requests,clients:()=>clients,get:expression=>vm.runInContext(expression,context)};
}

test('default public play ignores old active research sessions and never connects, enrolls or uploads',async()=>{
  const h=setup();assert.equal(h.clients(),0);assert.equal(h.get('canPlay()'),true);
  await h.context.checkCollector();await h.context.beginStudy();await h.context.syncChoices();
  for(const side of ['left','right','skip'])await h.context.choose(side);
  assert.equal(h.get('state.index'),3);assert.equal(h.get('state.queue.length'),0);
  assert.equal(h.get('state.history.every(r=>r.consent===false)'),true);
  assert.equal(h.disk.get('follow-your-eye-study-v1'),h.original);
  assert.equal(h.disk.get('follow-your-eye-experience-v1'),h.original);
  assert.equal(h.requests.length,0);assert.equal(h.clients(),0);
});

test('ten public answers produce real AI comparisons, restore locally and start another round',async()=>{
  const h=setup();for(let i=0;i<10;i++)await h.context.choose(i===9?'skip':i%2?'right':'left');
  assert.equal(h.get('state.index'),10);assert.equal(h.get('state.history.length'),10);
  assert.equal(h.get('agreement(state.history,pairsById,"qA").total'),9);
  assert.equal(h.get('isValidState(state,data)'),true);
  assert.equal(h.get('restore().history.length'),10);
  const oldRound=h.get('state.roundId');await h.context.nextRound();
  assert.equal(h.get('state.index'),0);assert.equal(h.get('state.roundNumber'),2);
  assert.notEqual(h.get('state.roundId'),oldRound);assert.equal(h.get('state.history.length'),10);
  assert.equal(h.requests.length,0);
});

test('public play remains usable when browser storage fails and never falls back to uploading',async()=>{
  const h=setup({unavailable:true});await h.context.choose('left');await h.context.choose('skip');
  assert.equal(h.get('state.index'),2);assert.equal(h.get('memoryOnly'),true);
  assert.equal(h.get('storageMessage'),'storageError');assert.equal(h.requests.length,0);
});

test('explicit research route retains its consent gate and separate original storage',async()=>{
  const h=setup({search:'?mode=research'});assert.equal(h.clients(),1);
  assert.equal(h.get('canPlay()'),false);assert.equal(h.get('STORAGE_BASE_KEY'),'follow-your-eye-experience-v1');
  await h.context.choose('left');await h.context.choose('skip');assert.equal(h.get('state.index'),0);
});
