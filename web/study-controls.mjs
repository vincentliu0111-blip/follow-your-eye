import {StudyClient,STUDY_KEY} from './study-client.mjs?v=20261107-v2';
// Gallery and information pages only finish user-requested exits/deletions.
// They never enroll a visitor or upload an active session's choice queue.
let existing;try{existing=JSON.parse(localStorage.getItem(STUDY_KEY));}catch{}
const query=new URLSearchParams(location.search);
let zh=query.get('lang')==='zh'||document.documentElement.lang.startsWith('zh');
try{zh=zh||localStorage.getItem('follow-your-eye-language')==='zh';}catch{}
if(existing?.session){
 const client=new StudyClient(),box=document.createElement('aside');box.className='study-exit-notice';box.setAttribute('role','status');
 const p=document.createElement('p'),status=document.createElement('p'),code=document.createElement('p'),exit=document.createElement('button'),remove=document.createElement('button'),retry=document.createElement('button'),link=document.createElement('a');
 exit.className=remove.className=retry.className='withdraw-button';
 exit.textContent=zh?'退出研究':'Exit research';remove.textContent=zh?'删除这次会话已提交的回答':'Delete this session’s submitted answers';retry.textContent=zh?'重试退出或删除请求':'Retry withdrawal or deletion';
 link.href=zh?'/about.html#research-data-zh':'/about.html#research-data';link.textContent=zh?'研究详情与联系方式':'Research details & contact';
 box.append(p,status,code,exit,remove,retry,document.createElement('br'),link);document.querySelector('main')?.prepend(box);
 const render=()=>{
  const s=client.read();if(!s)return;
  const ended=s.status!=='active'||client.ended(s),pending=['withdraw-pending','delete-pending'].includes(s.status)||(s.status==='active'&&client.ended(s));
  p.textContent=ended?(zh?'你已在此浏览器退出研究。之后的浏览和选择不会进入这次研究会话；未发送的回答已取消上传。':'You have left the research in this browser. Further browsing and choices will not enter this study session; unsent answers have been cancelled.'):(zh?'浏览画廊不会产生新的研究回答。你也可以在这里退出研究。':'Browsing creates no new research answers. You may also leave the research here.');
  status.textContent=s.status==='deleted'?(zh?'这次会话在主数据库中的回答已删除。已公开的汇总结果不会自动撤回。':'This session’s answers have been deleted from the active database. Published aggregate results are not automatically withdrawn.'):pending?(zh?'退出或删除请求尚未同步到服务器。请保留此浏览器数据并在联网后返回重试；服务器收到之前，其他设备或尚未同步的标签页可能仍有活动。':'The withdrawal or deletion request has not reached the server. Keep this browser’s data and retry online; other devices or unsynchronized tabs may remain active until the server receives it.'):(zh?'已提交的回答会按研究说明保留，除非你选择删除；保留期限为研究结束后 1 年。':'Previously submitted answers are retained as described, unless you delete them, for one year after the study ends.');
  code.textContent=(zh?'会话编号（联系研究者时可提供）：':'Session reference (for contacting the researcher): ')+s.session.studySessionId;
  exit.hidden=ended;remove.hidden=s.status==='deleted';retry.hidden=!pending;
 };
 client.addEventListener('change',render);
 document.getElementById('languageToggle')?.addEventListener('click',()=>queueMicrotask(()=>{zh=document.documentElement.lang.startsWith('zh');render();}));render();
 async function connect(){const r=await fetch('/collection_config.json',{cache:'no-store'});if(!r.ok)throw Error();const c=await r.json();if(!/^https:\/\/[a-z0-9.-]+$/i.test(c.endpoint)&&!(location.hostname==='127.0.0.1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(c.endpoint)))throw Error();client.endpoint=c.endpoint;}
 async function finish(){try{await connect();await client.sendEnd();}catch{}render();}
 exit.addEventListener('click',async()=>{const ending=client.end();render();await connect().catch(()=>{});await ending;await finish();});
 remove.addEventListener('click',async()=>{const ending=client.end(true);render();await connect().catch(()=>{});await ending;await finish();});
 retry.addEventListener('click',finish);window.addEventListener('online',finish);window.addEventListener('pageshow',finish);
 if(['withdraw-pending','delete-pending'].includes(existing.status)||client.ended(existing))void finish();
}
