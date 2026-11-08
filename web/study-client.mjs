export const NOTICE_VERSION='FYE-20261107-v2';
export const STUDY_KEY='follow-your-eye-study-v1';
const tokenPattern=/^[0-9a-f]{64}$/;
const idPattern=/^[0-9a-f-]{36}$/;
// This outbox is deliberately separate from every legacy experience queue.
export class StudyClient extends EventTarget {
 constructor({storage=globalThis.localStorage,fetcher=globalThis.fetch,endpoint='',locks=globalThis.navigator?.locks}={}){
  super();this.storage=storage;this.fetcher=fetcher.bind(globalThis);this.endpoint=endpoint;this.locks=locks;this.ready=false;this.config=null;this.sending=false;this.controller=null;this.error='';this.revoked=new Set();
  this.onStorage=e=>{if(e.key===STUDY_KEY||e.key?.startsWith(STUDY_KEY+':ended:')){this.ready=false;this.controller?.abort();this.emit();void this.refresh();}};
  globalThis.addEventListener?.('storage',this.onStorage);
  if(globalThis.window&&globalThis.BroadcastChannel){this.channel=new BroadcastChannel(STUDY_KEY);this.channel.onmessage=e=>{if(e.data?.endedId)this.revoked.add(e.data.endedId);this.onStorage({key:STUDY_KEY});};}
 }
 read(){try{const s=JSON.parse(this.storage.getItem(STUDY_KEY));return s?.version===1&&idPattern.test(s.session?.studySessionId)&&tokenPattern.test(s.session?.token)&&Array.isArray(s.queue)?s:null;}catch{return null;}}
 marker(s=this.read()){if(!s)return null;try{const raw=this.storage.getItem(`${STUDY_KEY}:ended:${s.session.studySessionId}`);if(!raw)return null;try{return JSON.parse(raw);}catch{return {at:raw,remove:false};}}catch{return null;}}
 ended(s=this.read()){try{return !!s&&(this.revoked.has(s.session.studySessionId)||!!this.marker(s));}catch{return true;}}
 get canUpload(){const s=this.read();return this.ready&&s?.status==='active'&&!this.ended(s)&&s.session.noticeVersion===NOTICE_VERSION&&s.session.protocolVersion===this.config?.protocolVersion;}
 get active(){return this.canUpload&&(this.config?.preview||this.config?.open);}
 get pending(){return this.read()?.queue.length??0;}
 emit(){this.dispatchEvent(new Event('change'));}
 async locked(fn){return this.locks?this.locks.request(STUDY_KEY,fn):fn();}
 write(s){this.storage.setItem(STUDY_KEY,JSON.stringify(s));this.channel?.postMessage('changed');}
 async request(path,{method='GET',body,session,signal}={}){
  const c=new AbortController(),abort=()=>c.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)c.abort();
  const timer=setTimeout(()=>c.abort(),15000);
  try{return await this.fetcher(this.endpoint+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(session?{authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:c.signal});}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async initialize(endpoint){this.endpoint=endpoint;return this.refresh();}
 async refresh(){
  this.ready=false;
  try{
   const r=await this.request('/study/config');if(!r.ok)throw Error('service');const c=await r.json();
   if(c.ok!==true||c.noticeVersion!==NOTICE_VERSION||c.retentionDays!==365||typeof c.protocolVersion!=='string')throw Error('version');this.config=c;
   await this.recoverEnd();const s=this.read();
   if(s&&(s.status!=='active'||this.ended(s))){await this.sendEnd();this.emit();return;}
   if(s){const status=await this.request(`/study/sessions/${s.session.studySessionId}`,{session:s.session});if(!status.ok)throw Error('session');const v=await status.json();if(!v.active||s.session.noticeVersion!==c.noticeVersion||s.session.protocolVersion!==c.protocolVersion){await this.locked(()=>{const latest=this.read();if(latest?.session.studySessionId===s.session.studySessionId){latest.status='ended';latest.queue=[];this.write(latest);}});}else if(!this.ended(s))this.ready=true;}
   this.error='';this.emit();if(this.canUpload)void this.flush();
  }catch{this.error='connection';this.emit();}
 }
 async enroll(language){
  let cancelEpoch;try{cancelEpoch=this.storage.getItem(STUDY_KEY+':cancel');}catch{}
  return this.locks?this.locks.request(STUDY_KEY+':enrollment',()=>this.enrollOnce(language,cancelEpoch)):this.enrollOnce(language,cancelEpoch);
 }
 async enrollOnce(language,cancelEpoch){
  // User gesture is the only caller. Storage must work before any session is created.
  if(this.enrolling)return false;this.enrolling=true;
  try{
   const probe=STUDY_KEY+':probe';this.storage.setItem(probe,'1');this.storage.removeItem(probe);
   if(this.storage.getItem(STUDY_KEY+':cancel')!==cancelEpoch)return false;
   await this.refresh();const prior=this.read();
   if(this.storage.getItem(STUDY_KEY+':cancel')!==cancelEpoch)return false;
   if(prior&&['withdraw-pending','delete-pending'].includes(prior.status))throw Error('pending-exit');
   if(this.active)return true;
   if(!this.config||(!this.config.preview&&!this.config.open))throw Error('closed');
   const r=await this.request('/study/sessions',{method:'POST',body:{adultConfirmed:true,noticeVersion:NOTICE_VERSION,language}});if(!r.ok)throw Error('connection');
   const s=await r.json();if(!s.ok||!idPattern.test(s.studySessionId)||!tokenPattern.test(s.token)||s.noticeVersion!==NOTICE_VERSION||s.protocolVersion!==this.config.protocolVersion)throw Error('session');
   let installed=false,reuse=false;
   try{await this.locked(()=>{
    if(this.storage.getItem(STUDY_KEY+':cancel')!==cancelEpoch)return;
    const latest=this.read();
    // A fallback for browsers without Web Locks: never replace another tab's newer consent/outbox.
    if(latest?.status==='active'&&!this.ended(latest)&&latest.session.studySessionId!==prior?.session.studySessionId&&latest.session.noticeVersion===NOTICE_VERSION&&latest.session.protocolVersion===this.config.protocolVersion){reuse=true;return;}
    this.write({version:1,session:s,status:'active',queue:[],rejected:[]});installed=true;
   });}catch{
    await this.request(`/study/sessions/${s.studySessionId}/withdraw`,{method:'POST',session:s,body:{withdrawnAt:s.consentedAt}});throw Error('storage');
   }
   if(!installed)await this.request(`/study/sessions/${s.studySessionId}/withdraw`,{method:'POST',session:s,body:{withdrawnAt:s.consentedAt}});
   this.ready=installed||reuse;this.error='';this.emit();return this.active;
  }catch(e){this.ready=false;this.error=['closed','pending-exit','storage'].includes(e.message)?e.message:'connection';this.emit();return false;}
  finally{this.enrolling=false;}
 }
 async enqueue(record){
  const accepted=await this.locked(()=>{
   if(!this.active)return false;const s=this.read();
   const event={id:record.id,studySessionId:s.session.studySessionId,roundId:record.roundId,position:record.position,datasetVersion:record.datasetVersion,pairId:record.pairId,leftId:record.leftId,rightId:record.rightId,chosenArtworkId:record.chosenArtworkId,choice:record.choice,layout:record.layout,shownAt:record.shownAt,chosenAt:record.chosenAt,elapsedMs:record.elapsedMs,protocolVersion:s.session.protocolVersion};
   // Profile, source, browser IDs, IP and inferred location are never serialized.
   if(event.chosenAt<s.session.consentedAt||event.shownAt<s.session.consentedAt)return false;
   if(!s.queue.some(e=>e.id===event.id))s.queue.push(event);this.write(s);return true;
  }).catch(()=>{this.ready=false;this.error='storage';return false;});
  this.emit();return accepted;
 }
 async flush(){
  if(this.sending||!this.canUpload)return;this.sending=true;this.emit();
  try{while(this.canUpload){
   const s=this.read(),event=s.queue[0];if(!event)break;
   this.controller=new AbortController();const r=await this.request('/study/answers',{method:'POST',body:event,session:s.session,signal:this.controller.signal});
   if([401,403,410].includes(r.status)){this.ready=false;await this.locked(()=>{const latest=this.read();if(latest?.session.studySessionId===s.session.studySessionId){latest.status='ended';latest.queue=[];this.write(latest);}});break;}
   if(!r.ok&&![400,409,413,422].includes(r.status))throw Error('connection');
   if(r.ok){const ack=await r.json();if(ack.ok!==true||ack.id!==event.id)throw Error('ack');}
   await this.locked(()=>{const latest=this.read();if(latest?.session.studySessionId!==s.session.studySessionId||latest.status!=='active'||this.ended(latest))return;latest.queue=latest.queue.filter(e=>e.id!==event.id);if(!r.ok)latest.rejected.push(event.id);this.write(latest);});
   this.error='';this.emit();
  }}catch{this.error='connection';}finally{this.sending=false;this.controller=null;this.emit();}
 }
 async end(remove=false){
  this.ready=false;this.controller?.abort();
  try{this.storage.setItem(STUDY_KEY+':cancel',crypto.randomUUID());}catch{this.error='storage';}
  const s=this.read();if(!s)return;
  const at=new Date(Math.max(Date.now(),Date.parse(s.session.consentedAt))).toISOString();
  // Separate durable tombstone prevents an old tab or stale snapshot reactivating this session.
  this.revoked.add(s.session.studySessionId);
  try{const old=this.marker(s);this.storage.setItem(`${STUDY_KEY}:ended:${s.session.studySessionId}`,JSON.stringify({at:old?.at??at,remove:remove||old?.remove||false}));}catch{this.error='storage';}
  await this.locked(()=>{const latest=this.read();if(!latest)return;latest.status=remove?'delete-pending':latest.status==='delete-pending'?'delete-pending':'withdraw-pending';latest.withdrawnAt=latest.withdrawnAt??at;latest.queue=[];this.write(latest);}).catch(()=>{this.error='storage';});
  this.emit();this.channel?.postMessage({endedId:s.session.studySessionId});await this.sendEnd();
 }
 async recoverEnd(){
  const s=this.read();
  // Gallery/about retries must also repair a stale tab's overwrite, without flushing choices.
  if(s?.status==='active'&&this.ended(s)){
   const marker=this.marker(s);
   await this.locked(()=>{const latest=this.read();if(latest?.session.studySessionId===s.session.studySessionId&&latest.status==='active'){latest.status=marker?.remove?'delete-pending':'withdraw-pending';latest.withdrawnAt=marker?.at??new Date().toISOString();latest.queue=[];this.write(latest);}});
  }
 }
 async sendEnd(){
  await this.recoverEnd();
  const s=this.read();if(!s)return;
  if(!['withdraw-pending','delete-pending'].includes(s.status))return;
  const remove=s.status==='delete-pending';
  try{const r=await this.request(`/study/sessions/${s.session.studySessionId}/${remove?'delete':'withdraw'}`,{method:'POST',session:s.session,...(!remove?{body:{withdrawnAt:s.withdrawnAt}}:{})});if(!r.ok)throw Error('end');
   await this.locked(()=>{const latest=this.read();if(latest?.session.studySessionId!==s.session.studySessionId||latest.status!==s.status)return;latest.status=remove?'deleted':'ended';latest.queue=[];this.write(latest);});this.error='';
  }catch{this.error='pending-exit';}this.emit();
 }
 destroy(){globalThis.removeEventListener?.('storage',this.onStorage);this.channel?.close();this.controller?.abort();}
}
