import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildArtworkRound,applyArtworkEntry} from '../web/artwork-entry.mjs';
import {ARTWORK_PAGES} from '../web/artwork-pages.mjs';
import {isValidState} from '../web/experience-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
const data=read('web/met_experience_data.json'),allowed=new Set(read('web/met_style_matched_pairs.json').pairIds),pairs=data.pairs.filter(p=>allowed.has(p.id));
const catalog=new Map(read('web/met_catalog.json').artworks.map(a=>[a.id,a]));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('40 reproducible static pages contain source metadata, canonical URLs, crawlable links and real assets',()=>{
 assert.equal(Object.keys(ARTWORK_PAGES).length,40);
 execFileSync(process.execPath,['tools/build_artwork_pages.mjs','--check'],{cwd:root});
 const titles=new Set();
 for(const [id,url] of Object.entries(ARTWORK_PAGES)){
  const html=readFileSync(path.join(root,'web',url,'index.html'),'utf8'),a=catalog.get(id);
  assert.ok(html.includes(`<h1>${esc(a.title)}</h1>`));assert.ok(html.includes(esc(a.artist)));assert.ok(html.includes(esc(a.date)));assert.ok(html.includes(esc(a.medium)));assert.ok(html.includes(a.sourceUrl));
  assert.ok(html.includes(`rel="canonical" href="https://vincentliu.ai${url}"`));
  assert.ok(html.includes(`/?artwork=${id}&amp;source=artwork-${id}`));
  titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){
   const p=path.join(root,'web',decodeURIComponent(match[1]));assert.ok(existsSync(match[1].endsWith('/')?path.join(p,'index.html'):p),`Missing ${match[1]}`);
  }
  const json=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(json.name,a.title);assert.equal(json.sameAs,a.sourceUrl);
 }
 assert.equal(titles.size,40);
 const sitemap=readFileSync(path.join(root,'web/sitemap.xml'),'utf8');
 for(const url of Object.values(ARTWORK_PAGES))assert.ok(sitemap.includes(`https://vincentliu.ai${url}`));
});

test('every featured entry opens with that work, valid random orientation and ten distinct existing pairs',()=>{
 for(const id of Object.keys(ARTWORK_PAGES))for(const random of [()=>0,()=>.99]){
  const r=buildArtworkRound(pairs,[],id,{random});
  assert.equal(r.deck.length,10);assert.equal(new Set(r.deck.map(p=>p.pairId)).size,10);
  assert.ok([r.deck[0].leftId,r.deck[0].rightId].includes(id));
  assert.ok(r.deck.every(p=>allowed.has(p.pairId)));
 }
 const id=Object.keys(ARTWORK_PAGES)[0];
 const seen=pairs.map(p=>p.id);assert.equal(buildArtworkRound(pairs,seen,id).deck.length,10);
});

test('entry preserves active progress and outbox, defers the new artwork, and changes only an empty round',()=>{
 const id=Object.keys(ARTWORK_PAGES)[0],state={index:3,deck:[{pairId:'unchanged'}],queue:[{id:'pending'}],history:[{id:'previous'}],seen:[],source:'share',presentation:{shownAt:'unchanged'}};
 const before=structuredClone(state);assert.equal(applyArtworkEntry(state,id,pairs),true);
 assert.equal(state.nextArtworkId,id);for(const key of Object.keys(before))assert.deepEqual(state[key],before[key]);
 const fresh={index:0,deck:[],queue:[{id:'older-round-pending'}],history:[],seen:[],source:'direct',presentation:null};
 applyArtworkEntry(fresh,id,pairs);assert.ok([fresh.deck[0].leftId,fresh.deck[0].rightId].includes(id));assert.equal(fresh.source,`artwork-${id}`);assert.equal(fresh.queue.length,1);
 const same=structuredClone(fresh);fresh.index=1;assert.equal(applyArtworkEntry(fresh,id,pairs),false);assert.equal(fresh.nextArtworkId,null);fresh.index=same.index;
 const unchanged=structuredClone(fresh);assert.equal(applyArtworkEntry(fresh,'invalid',pairs),false);assert.deepEqual(fresh,unchanged);
});

test('stored upload rejections must refer to retained history and cannot remain in the retry queue',()=>{
 const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const p=pairs[0],record={id:uuid(3),sessionId:uuid(1),roundId:uuid(2),datasetVersion:data.version,pairId:p.id,leftId:p.a,rightId:p.b,choice:'A',source:'test',position:1,layout:'stacked',shownAt:'2026-10-30T12:00:00.000Z',chosenAt:'2026-10-30T12:00:01.000Z',elapsedMs:1000,profile:{mood:'',interests:[],language:''},consent:true};
 const state={schema:2,datasetVersion:data.version,sessionId:uuid(1),roundId:uuid(2),roundNumber:1,index:1,deck:[{pairId:p.id,leftId:p.a,rightId:p.b}],seen:[p.id],history:[record],queue:[],source:'test',profile:record.profile,consent:true,presentation:null,rejectedIds:[record.id]};
 assert.equal(isValidState(state,data),true);state.queue=[record];assert.equal(isValidState(state,data),false);state.queue=[];state.rejectedIds=['absent'];assert.equal(isValidState(state,data),false);
});
