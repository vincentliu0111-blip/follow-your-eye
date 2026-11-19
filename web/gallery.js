import {orderForBrowse} from './gallery-order.mjs?v=20261013-v2';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 60;
const LOCALE_KEY = 'follow-your-eye-language';
let locale = 'en';
try { locale = localStorage.getItem(LOCALE_KEY) === 'zh' ? 'zh' : 'en'; } catch {}
let artworks = [], filtered = [], shown = 0, period = 'all', westernArtworkIds = new Set();
let zoomScale = 1, zoomX = 0, zoomY = 0, dragPoint = null;

const words = {
  en: {
    play:'The experiment', gallery:'Met gallery', about:'The idea', private:'Public experience', eyebrow:'THE MET · OPEN ACCESS',
    title:'A world of paintings.', intro:'Explore 5,326 verified public-domain Paintings, created between 1300 and 1914. Follow a detail that catches your eye.',
    playButton:'Try the 10-choice experience',
    searchLabel:'Search artworks, artists, or Met IDs', searchPlaceholder:'A title, artist, or number', all:'All periods', pilot:'First 500 new works', pilotBadge:'First 500-work set',
    results:n=>`${n.toLocaleString('en-US')} painting${n===1?'':'s'}`, more:'See more paintings', none:'No paintings match these filters.',
    errorTitle:'The gallery could not open.', errorText:'Please check your connection and refresh this page.',
    footer:'Images and artwork data: The Metropolitan Museum of Art Open Access (CC0)', policy:'The Met Open Access',
    dialogEyebrow:'FROM THE MET COLLECTION', source:'Explore at The Met ↗', note:'An online collection record does not mean this artwork is currently on view.',
    zoomIn:'Zoom in', zoomOut:'Zoom out', zoomReset:'Reset', zoomHint:'Drag the image to explore details.',
  },
  zh: {
    play:'开始探索', gallery:'大都会画廊', about:'关于实验', private:'公开体验', eyebrow:'大都会博物馆 · 开放资源',
    title:'走进五千多幅画。', intro:'浏览 5,326 幅已核验的公有领域 Paintings，创作起始年代为 1300 至 1914 年。看看哪一处细节吸引你。',
    playButton:'试试 10 组选择',
    searchLabel:'搜索作品、画家或馆方编号', searchPlaceholder:'输入作品名、画家或编号', all:'全部年代', pilot:'首批 500 幅新画', pilotBadge:'首批 500 幅',
    results:n=>`${n.toLocaleString('zh-CN')} 幅画作`, more:'查看更多画作', none:'没有符合条件的画作。',
    errorTitle:'画廊暂时无法打开。', errorText:'请检查网络连接并刷新页面。',
    footer:'图像及作品资料：大都会博物馆 Open Access（CC0）', policy:'大都会开放资源',
    dialogEyebrow:'来自大都会博物馆馆藏', source:'前往大都会藏品页 ↗', note:'网上有藏品记录，不代表作品目前正在展出。',
    zoomIn:'放大', zoomOut:'缩小', zoomReset:'重置', zoomHint:'拖动画面查看更多细节。',
  },
};
const t = key => words[locale][key];

function translate() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = locale === 'zh' ? '大都会画廊 — Follow Your Eye' : 'Met Paintings — Follow Your Eye';
  for (const [id,key] of Object.entries({playLink:'play',galleryLink:'gallery',aboutLink:'about',privateLabel:'private',eyebrow:'eyebrow',heroTitle:'title',heroIntro:'intro',playButton:'playButton',searchLabel:'searchLabel',pilotLabel:'pilot',loadMore:'more',errorTitle:'errorTitle',errorText:'errorText',footerText:'footer',sourcePolicy:'policy',dialogEyebrow:'dialogEyebrow',dialogSource:'source',dialogNote:'note',galleryZoomReset:'zoomReset',galleryZoomHint:'zoomHint'})) $(id).textContent=t(key);
  $('galleryZoomIn').setAttribute('aria-label',t('zoomIn'));
  $('galleryZoomOut').setAttribute('aria-label',t('zoomOut'));
  $('searchArt').placeholder=t('searchPlaceholder');
  $('languageToggle').textContent=locale==='en'?'中文':'EN';
  $('languageToggle').setAttribute('aria-label',locale==='en'?'Switch interface to Chinese':'切换为英文');
  renderFilters(); applyFilters();
}

function renderFilters() {
  $('periodFilters').replaceChildren(...['all','1300-1599','1600-1799','1800-1914'].map(value=>{
    const button=document.createElement('button'); button.type='button'; button.className='period-filter';
    button.textContent=value==='all'?t('all'):value.replace('-', '–'); button.setAttribute('aria-pressed',period===value);
    button.addEventListener('click',()=>{period=value;renderFilters();applyFilters();}); return button;
  }));
}

function applyFilters() {
  const query=$('searchArt').value.trim().toLocaleLowerCase(); const pilot=$('pilotOnly').checked;
  const matches=artworks.filter(art=>(period==='all'||art.period===period)&&(!pilot||art.pilot)&&(!query||[art.title,art.artist,art.id,art.medium].some(value=>value.toLocaleLowerCase().includes(query))));
  filtered=query?matches:orderForBrowse(matches,westernArtworkIds);
  shown=0; renderResults(true);
}

function renderResults(reset=false) {
  if (!artworks.length) return;
  $('resultCount').textContent=filtered.length?t('results')(filtered.length):t('none');
  if(reset)$('galleryGrid').replaceChildren();
  const next=filtered.slice(shown,shown+PAGE_SIZE);
  $('galleryGrid').append(...next.map(art=>{
    const button=document.createElement('button');button.type='button';button.className='met-card';button.setAttribute('aria-label',art.title);
    const imageBox=document.createElement('span');imageBox.className='met-image';const img=document.createElement('img');img.src=art.image;img.alt='';img.loading='lazy';img.decoding='async';imageBox.append(img);
    const copy=document.createElement('span');copy.className='met-copy';const title=document.createElement('strong');title.textContent=art.title;const subtitle=document.createElement('small');subtitle.textContent=`${art.artist} · ${art.date}`;copy.append(title,subtitle);
    if(art.pilot){const badge=document.createElement('span');badge.className='met-badge';badge.textContent=t('pilotBadge');copy.append(badge);}
    button.append(imageBox,copy);button.addEventListener('click',()=>openArtwork(art));return button;
  }));
  shown+=next.length;$('loadMore').hidden=shown>=filtered.length;
}

function openArtwork(art) {
  $('dialogImage').src=art.image;$('dialogImage').alt=art.title;$('dialogTitle').textContent=art.title;
  $('dialogArtist').textContent=art.artist;$('dialogDate').textContent=art.date;$('dialogMedium').textContent=art.medium||'';
  $('dialogSource').href=art.sourceUrl;setGalleryZoom(1,0,0);$('artDialog').showModal();
}
function setGalleryZoom(scale,x=zoomX,y=zoomY) {
  zoomScale=Math.max(1,Math.min(4,scale));
  const area=$('dialogImage').parentElement;
  const limitX=area.clientWidth*(zoomScale-1)/2,limitY=area.clientHeight*(zoomScale-1)/2;
  zoomX=Math.max(-limitX,Math.min(limitX,x));zoomY=Math.max(-limitY,Math.min(limitY,y));
  $('dialogImage').style.transform=`translate(${zoomX}px,${zoomY}px) scale(${zoomScale})`;
  $('galleryZoomLevel').textContent=`${Math.round(zoomScale*100)}%`;
  $('galleryZoomOut').disabled=zoomScale===1;$('galleryZoomIn').disabled=zoomScale===4;
  area.classList.toggle('can-pan',zoomScale>1);
}
$('galleryZoomIn').addEventListener('click',()=>setGalleryZoom(zoomScale+.5));
$('galleryZoomOut').addEventListener('click',()=>setGalleryZoom(zoomScale-.5));
$('galleryZoomReset').addEventListener('click',()=>setGalleryZoom(1,0,0));
const zoomArea=$('dialogImage').parentElement;
zoomArea.addEventListener('pointerdown',event=>{if(zoomScale===1)return;dragPoint={id:event.pointerId,x:event.clientX,y:event.clientY,originX:zoomX,originY:zoomY};zoomArea.setPointerCapture(event.pointerId);});
zoomArea.addEventListener('pointermove',event=>{if(dragPoint?.id===event.pointerId)setGalleryZoom(zoomScale,dragPoint.originX+event.clientX-dragPoint.x,dragPoint.originY+event.clientY-dragPoint.y);});
zoomArea.addEventListener('pointerup',()=>{dragPoint=null;});
zoomArea.addEventListener('pointercancel',()=>{dragPoint=null;});

$('languageToggle').addEventListener('click',()=>{locale=locale==='en'?'zh':'en';try{localStorage.setItem(LOCALE_KEY,locale);}catch{}translate();});
$('searchArt').addEventListener('input',applyFilters);
$('pilotOnly').addEventListener('change',applyFilters);
$('loadMore').addEventListener('click',()=>renderResults());
Promise.all([fetch('./met_catalog.json',{cache:'no-cache'}),fetch('./met_western_artworks.json',{cache:'no-cache'})]).then(async([catalogResponse,originResponse])=>{
  if(!catalogResponse.ok||!originResponse.ok)throw Error('Catalog unavailable');
  return [await catalogResponse.json(),await originResponse.json()];
}).then(([data,origins])=>{
  if(data.total!==5326||!Array.isArray(data.artworks)||data.artworks.length!==data.total)throw Error('Invalid catalog');
  const catalogIds=new Set(data.artworks.map(art=>String(art.id)));
  if(origins.catalogVersion!==data.version||!Array.isArray(origins.westernArtworkIds)||new Set(origins.westernArtworkIds).size!==origins.westernArtworkIds.length||origins.westernArtworkIds.some(id=>!catalogIds.has(id)))throw Error('Invalid artwork groups');
  artworks=data.artworks;westernArtworkIds=new Set(origins.westernArtworkIds);translate();
}).catch(()=>{$('galleryError').hidden=false;$('galleryGrid').hidden=true;translate();});
translate();
