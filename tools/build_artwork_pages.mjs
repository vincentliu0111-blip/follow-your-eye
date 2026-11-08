import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const selection=read('Data/artwork_page_selection.json'),catalog=read('web/met_catalog.json');
const data=read('web/met_experience_data.json'),matched=new Set(read('web/met_style_matched_pairs.json').pairIds);
const pairs=data.pairs.filter(p=>matched.has(p.id));
const byId=new Map(catalog.artworks.map(a=>[a.id,a]));
const editorials=read('Data/artwork_editorial_v1.json').artworks;
const guides=read('Data/art_choice_guides_v1.json');
const ids=selection.artworkIds;
if(ids.length!==40||new Set(ids).size!==40)throw Error('Expected 40 distinct works');
const arts=ids.map(id=>{
 const a=byId.get(id);
 if(!a||!pairs.some(p=>p.a===id||p.b===id)||!a.medium||!a.sourceUrl.endsWith('/'+id))throw Error(`Invalid featured work ${id}`);
 return a;
});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=a=>`/artworks/met-${a.id}/`;
const full=a=>'https://vincentliu.ai'+url(a);
const prompts=[
 ['Where does your eye begin?','Follow the first shape that catches your eye, then look toward the edges. Does a different detail hold your attention?'],
 ['Look at the spaces between.','Notice the gaps between shapes. Would you describe their rhythm as calm, busy, or something else?'],
 ['Follow a line.','Pick an edge and trace it with your eyes. Where does it lead you, and where does your attention change direction?'],
 ['Look once, then look again.','Take in the whole image, then concentrate on one small area. Does the detail change how you feel about the whole?'],
 ['Notice the light.','Look for changes between light and dark. Which part would you return to for a second look?'],
 ['Find your own pace.','Pause over an area you might usually pass by. Does it make you want to stay, or move on?'],
 ['Consider the frame.','Compare what happens near the edge with what happens near the center. Which part draws you back?'],
 ['Choose a detail.','Let your eye settle on a small detail. What made you notice it before everything else?'],
];
function shell(title,description,canonical,body,image,{locale='en',alternate=null}={}){
 const zh=locale==='zh';
 const alternates=alternate?`<link rel="alternate" hreflang="en" href="https://vincentliu.ai${alternate.en}"><link rel="alternate" hreflang="zh-Hans" href="https://vincentliu.ai${alternate.zh}">`:'';
 const metadata=image?`<meta property="og:image" content="https://vincentliu.ai/${esc(image)}"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:card" content="summary_large_image">`:'';
 return `<!doctype html>
<html lang="${zh?'zh-CN':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Follow Your Eye</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">${alternates}
<meta property="og:type" content="website"><meta property="og:site_name" content="Follow Your Eye"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">${metadata}
<link rel="stylesheet" href="/style.css?v=20261101-search-v1"><link rel="stylesheet" href="/artwork.css?v=20261101-search-v1"></head>
<body><a class="skip-link" href="#main">${zh?'跳到正文':'Skip to the artwork'}</a><div class="app-shell"><header class="site-header"><a class="brand" href="/">Follow Your Eye</a><nav class="main-nav" aria-label="Main navigation"><a href="${zh?'/zh/art-choices/':'/art-choices/'}">${zh?'艺术选画指南':'Art choices guide'}</a><a href="/artworks/">${zh?'作品目录':'Explore paintings'}</a><a href="/?lang=${zh?'zh':'en'}">${zh?'开始选画':'Choose paintings'}</a></nav></header>
<main id="main">${body}</main><footer class="site-footer"><span>Images and artwork metadata: The Metropolitan Museum of Art Open Access (CC0).</span><a href="https://www.metmuseum.org/hubs/open-access">Source policy ↗</a><a href="/about.html">${zh?'关于本项目':'About Follow Your Eye'}</a><a href="${zh?'/about.html#research-data-zh':'/about.html#research-data'}">研究详情与联系方式 / Research details &amp; contact</a></footer></div></body></html>\n`;
}
function card(a,locale='en'){const e=locale==='zh'&&editorials[a.id];return `<a class="discovery-card" href="${e?'/zh'+url(a):url(a)}"><span class="discovery-image"><img src="/${esc(a.image)}" alt="${esc(a.title)}" loading="lazy" decoding="async"></span><strong>${esc(e?e.zhTitle:a.title)}</strong><span>${esc(e?e.zhArtist:a.artist)} · ${esc(e?e.zhDate:a.date)}</span></a>`;}
function languageLink(locale,paths){return `<p class="language-links"><a lang="en" hreflang="en" href="${paths.en}">English</a><span aria-hidden="true"> / </span><a lang="zh-CN" hreflang="zh-Hans" href="${paths.zh}">中文</a></p>`;}
function reading(e,locale){const x=e[locale],zh=locale==='zh';return `<section class="reading-content" aria-labelledby="looking-heading"><p class="eyebrow">${zh?'跟着细节看画':'LOOK CLOSELY'}</p><h2 id="looking-heading">${esc(x.headline)}</h2><p class="caption">${zh?'以下为Follow Your Eye基于画面编写的观察与提问，不代表馆方解读。':'The observations and questions below are Follow Your Eye editorial, based on the image; they are not museum commentary.'}</p>${x.sections.map(([h,p])=>`<section><h3>${esc(h)}</h3><p>${esc(p)}</p></section>`).join('')}<section class="reading-question"><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p></section><p><a href="${zh?'/zh/art-choices/':'/art-choices/'}">${zh?'继续阅读：怎样比较两幅画，与AI偏好对照 →':'How to compare paintings and explore AI preferences →'}</a></p></section>`;}
function context(e,locale){return `<section class="museum-context"><h2>${locale==='zh'?'馆方背景':'Museum context'}</h2><p>${esc(e[locale].context)}</p><p class="caption"><a href="${e.sourceUrl}">${locale==='zh'?'资料来源：大都会馆藏介绍':'Source: The Met collection commentary'} ↗</a> · ${locale==='zh'?'核对日期':'Checked'} ${e.sourceChecked}</p></section>`;}
const outputs=new Map();
for(const [i,a] of arts.entries()){
 const [heading,prompt]=prompts[i%prompts.length];
 const related=arts.filter(x=>x.id!==a.id).sort((x,y)=>Number(y.artist===a.artist)-Number(x.artist===a.artist)||Number(y.period===a.period)-Number(x.period===a.period)).slice(0,3);
 const editorial=editorials[a.id];
 const paths={en:url(a),zh:`/zh${url(a)}`};
 const description=editorial?.en.description ?? `Explore ${a.title} by ${a.artist}, ${a.date}. View the Met painting and compare it with another work in Follow Your Eye.`;
 const schema={'@context':'https://schema.org','@type':'VisualArtwork',name:a.title,creator:{'@type':'Person',name:a.artist},artMedium:a.medium,image:`https://vincentliu.ai/${a.image}`,url:full(a),sameAs:a.sourceUrl,license:'https://creativecommons.org/publicdomain/zero/1.0/'};
 let body=`${editorial?languageLink('en',paths):''}<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/artworks/">Explore paintings</a><span aria-hidden="true"> / </span><span>${esc(a.title)}</span></nav>
<article><div class="work-layout"><figure class="work-image"><a href="/${esc(a.image)}" aria-label="Open the image of ${esc(a.title)}"><img src="/${esc(a.image)}" alt="${esc(a.title)} by ${esc(a.artist)}" fetchpriority="high"></a><figcaption>Image: The Met Open Access · <a href="${esc(a.sourceUrl)}">Collection record ${esc(a.id)} ↗</a></figcaption></figure>
<div class="work-copy"><p class="eyebrow">THE MET · OPEN ACCESS</p><h1>${esc(a.title)}</h1><p class="work-artist">${esc(a.artist)}</p><a class="work-quick-start" href="/?artwork=${a.id}&amp;source=artwork-${a.id}">Compare this painting →</a><dl><div><dt>Date</dt><dd>${esc(a.date)}</dd></div><div><dt>Medium</dt><dd>${esc(a.medium)}</dd></div><div><dt>Collection</dt><dd>The Metropolitan Museum of Art</dd></div></dl>
<p class="work-context">The Met collection record lists <cite>${esc(a.title)}</cite> under ${esc(a.artist)}, dated ${esc(a.date)}. The recorded medium is ${esc(a.medium)}. Dates and attributions follow the museum metadata, including any uncertainty.</p>
<div class="look-prompt"><h2>${heading}</h2><p>${prompt}</p><p class="caption">A looking prompt from Follow Your Eye.</p></div>
<div class="work-invitation"><p>Now put your first impression beside another painting.</p><a class="primary-button" href="/?artwork=${a.id}&amp;source=artwork-${a.id}">Which painting catches your eye? →</a><p class="caption">Start with this work, then explore 10 choices and compare your preferences with AI. If a round is in progress, this work will start your next round.</p><p lang="zh-CN" class="caption">从这幅作品开始选画。已有未完成的一轮时，将保留进度，并在下一轮展示这幅作品。</p></div>
<a class="work-source" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read the museum’s collection record ↗</a><p class="caption">An online record does not mean the work is currently on view.</p></div></div>
<section class="related"><p class="eyebrow">KEEP LOOKING</p><h2>Another place to follow your eye.</h2><div class="discovery-grid">${related.map(card).join('')}</div></section></article>
<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`;
 if(editorial){
  body=body.replaceAll(`source=artwork-${a.id}"`,`source=artwork-${a.id}&amp;lang=en"`).replace(/<p class="work-context">.*?<\/p>/s,context(editorial,'en')).replace('<section class="related">',reading(editorial,'en')+'<section class="related">');
 }
 outputs.set(`web${url(a)}index.html`,shell(editorial?.en.headline ?? `${a.title} — ${a.artist}`,description,full(a),body,a.image,{alternate:editorial?paths:null}));
 if(editorial){
  const e=editorial,play=`/?artwork=${a.id}&amp;source=artwork-${a.id}&amp;lang=zh`;
  const zhBody=`${languageLink('zh',paths)}<nav class="breadcrumbs" aria-label="面包屑"><a href="/zh/art-choices/">艺术选画</a> / <span>${esc(e.zhTitle)}</span></nav><article><div class="work-layout"><figure class="work-image"><a href="/${esc(a.image)}" aria-label="打开${esc(e.zhTitle)}图片"><img src="/${esc(a.image)}" alt="${esc(e.zhArtist)}《${esc(e.zhTitle)}》" fetchpriority="high"></a><figcaption>图像：大都会博物馆Open Access · <a href="${a.sourceUrl}">馆藏记录 ${a.id} ↗</a></figcaption></figure><div class="work-copy"><p class="eyebrow">大都会博物馆 · 开放资源</p><h1>${esc(e.zhTitle)}</h1><p lang="en" class="original-title">${esc(a.title)}</p><p class="work-artist">${esc(e.zhArtist)} · <span lang="en">${esc(a.artist)}</span></p><a class="work-quick-start" href="${play}">从这幅作品开始选画 →</a><dl><div><dt>年代</dt><dd>${esc(e.zhDate)}</dd></div><div><dt>材质</dt><dd>${esc(e.zhMedium)}</dd></div><div><dt>收藏</dt><dd>大都会艺术博物馆</dd></div></dl><p class="caption">中文标题及人名为本站译名，英文原名与馆方资料保留对照。</p>${context(e,'zh')}<div class="work-invitation"><p>看过细节，再与另一幅画一起比较。</p><a class="primary-button" href="${play}">哪一幅更吸引你？ →</a><p class="caption">第一组包含这幅作品；当前一轮已作答时，保留进度并安排到下一轮。完成后可查看本轮与AI的偏好重合。</p></div><p class="caption">存在网上记录不代表作品目前正在馆内展出；实时展出信息请以馆方为准。</p></div></div>${reading(e,'zh')}<section class="related"><h2>换一幅，继续观察</h2><div class="discovery-grid">${related.map(a=>card(a,'zh')).join('')}</div></section></article><script type="application/ld+json">${JSON.stringify({...schema,name:e.zhTitle,inLanguage:'zh-CN',url:'https://vincentliu.ai'+paths.zh}).replaceAll('<','\\u003c')}</script>`;
  outputs.set(`web${paths.zh}index.html`,shell(e.zh.headline,e.zh.description,'https://vincentliu.ai'+paths.zh,zhBody,a.image,{locale:'zh',alternate:paths}));
 }
}
outputs.set('web/artworks/index.html',shell('Explore 40 Met paintings','Discover 40 Met Open Access paintings. Explore each work, follow a looking prompt, and start a painting comparison.','https://vincentliu.ai/artworks/',`<section class="discovery-heading"><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h1>One painting is a beginning.</h1><p class="intro">Explore 40 paintings from The Met. Stay with a detail, then see what catches your eye beside another work.</p><p lang="zh-CN">从一幅作品开始，看看下一幅是否同样打动你。</p><a href="/art-choices/">How to compare paintings →</a> · <a lang="zh-CN" href="/zh/art-choices/">艺术选画指南 →</a><p><a href="/gallery.html">Browse all 5,326 paintings →</a></p></section><div class="discovery-grid hub-grid">${arts.map(card).join('')}</div>`));
const guidePaths={en:'/art-choices/',zh:'/zh/art-choices/'};
for(const locale of ['en','zh']){
 const g=guides[locale],zh=locale==='zh',guideUrl=guidePaths[locale];
 const focus=Object.keys(editorials).map(id=>byId.get(id));
 const guideCards=focus.map(a=>{const e=editorials[a.id];return `<a class="discovery-card" href="${zh?'/zh'+url(a):url(a)}"><span class="discovery-image"><img src="/${a.image}" alt="${esc(zh?e.zhTitle:a.title)}" loading="lazy"></span><strong>${esc(zh?e.zhTitle:a.title)}</strong><span>${esc(zh?e.zhArtist:a.artist)} · ${esc(zh?e.zhDate:a.date)}</span></a>`;}).join('');
 const body=`${languageLink(locale,guidePaths)}<article class="choice-guide"><header class="guide-hero"><p class="eyebrow">${zh?'相信你的眼光':'TRUST YOUR EYE'}</p><h1>${esc(g.heading)}</h1><p class="intro">${esc(g.intro)}</p><a class="primary-button" href="/?source=art_guide_${locale}&amp;lang=${locale}">${esc(g.cta)}</a><p class="caption">${esc(g.start)}</p></header><div class="guide-sections">${g.sections.map(([h,...paras])=>`<section><h2>${esc(h)}</h2>${paras.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')}<section><h2>${zh?'从五幅作品练习看画':'Five paintings to start looking closely'}</h2><p>${zh?'馆方背景与本站的画面观察分开标注。选一幅读读，再进入包含它的比较。':'Museum context and site observations are labeled separately. Explore a work, then follow its link into a comparison.'}</p><div class="discovery-grid">${guideCards}</div></section><section><h2>${zh?'艺术选画常见问题':'Questions about art preference comparisons'}</h2>${g.faqs.map(([q,a])=>`<section><h3>${esc(q)}</h3><p>${esc(a)}</p></section>`).join('')}</section><section><h2>${zh?'体验方法与作品来源':'Methods and artwork sources'}</h2><p><a href="/about.html">${zh?'查看本项目的AI比较方法与局限':'Read about the AI comparisons and their limits'}</a> · <a href="/gallery.html">${zh?'浏览5,326幅作品':'Browse 5,326 works'}</a> · <a href="/connection.html">${zh?'检查连接':'Check connection'}</a></p><p><a class="primary-button" href="/?source=art_guide_${locale}&amp;lang=${locale}">${esc(g.cta)}</a></p></section></div></article>`;
 outputs.set(`web${guideUrl}index.html`,shell(g.title,g.description,'https://vincentliu.ai'+guideUrl,body,'met-art/436528.jpg',{locale,alternate:guidePaths}));
}
outputs.set('web/artwork-pages.mjs',`// Generated by tools/build_artwork_pages.mjs from ${selection.version}.\nexport const ARTWORK_PAGES = Object.freeze(${JSON.stringify(Object.fromEntries(arts.map(a=>[a.id,url(a)])),null,2)});\nexport const ZH_ARTWORK_PAGES = Object.freeze(${JSON.stringify(Object.fromEntries(Object.keys(editorials).map(id=>[id,`/zh/artworks/met-${id}/`])),null,2)});\n`);
outputs.set('web/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/','/about.html','/gallery.html','/artworks/',...Object.values(guidePaths),...Object.keys(editorials).map(id=>`/zh/artworks/met-${id}/`),...arts.map(url)].map(p=>`  <url><loc>https://vincentliu.ai${p}</loc></url>`).join('\n')}\n</urlset>\n`);
let stale=[];
for(const [name,content] of outputs){const p=path.join(root,name);if(process.argv.includes('--check')){try{if(readFileSync(p,'utf8')!==content)stale.push(name);}catch{stale.push(name);}}else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,content);}}
if(stale.length)throw Error('Regenerate artwork pages: '+stale.join(', '));
console.log(`${process.argv.includes('--check')?'Verified':'Generated'} ${arts.length} artwork pages, 5 Chinese editions, 2 choice guides, hub, links and sitemap.`);
