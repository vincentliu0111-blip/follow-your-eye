import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const choiceFlow = source.slice(source.indexOf('async function choose(side) {'), source.indexOf('function currentRecords()'));
assert.ok(choiceFlow.startsWith('async function choose(side) {'));

test('restored choice advances locally without contacting the retired collector', async () => {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      disabled:false,
      classList:{add(){}},
      getBoundingClientRect:()=>({top:0}),
    });
    return elements.get(id);
  };
  const state = {
    sessionId:'session',roundId:'round',source:'direct',index:0,
    deck:[{pairId:'pair',leftId:'art-a',rightId:'art-b'}],
    presentation:{shownAt:'2026-10-18T12:00:00.000Z'},
    profile:{mood:'',interests:[],language:''},history:[],seen:[],queue:[],
  };
  let requests=0, rendered=0;
  const context = vm.createContext({
    state,busy:false,view:'play',data:{version:'v3'},pairsById:new Map([['pair',{id:'pair',a:'art-a',b:'art-b'}]]),
    $:get,uuid:()=>`event-${state.history.length+1}`,copyProfile:p=>({...p,interests:[...p.interests]}),
    async mutateState(change){return change(state)},updateCollectionCount(){},updateSync(){},
    renderPlay(){rendered++},t:key=>key,fetch(){requests++;throw Error('Unexpected network request')},
    matchMedia:()=>({matches:true}),window:{setTimeout(fn){fn()}},
  });
  vm.runInContext(choiceFlow,context);
  await vm.runInContext('choose("left")',context);
  assert.equal(state.index,1);
  assert.equal(state.history.length,1);
  assert.equal(state.history[0].choice,'A');
  assert.equal(state.history[0].consent,false);
  assert.equal(state.queue.length,0);
  assert.equal(requests,0);
  assert.ok(rendered>0);
});
