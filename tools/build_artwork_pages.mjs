import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const selection=read('Data/artwork_page_selection.json'),catalog=read('web/met_catalog.json');
const data=read('web/met_experience_data.json'),matched=new Set(read('web/met_style_matched_pairs.json').pairIds);
const pairs=data.pairs.filter(p=>matched.has(p.id));
const byId=new Map(catalog.artworks.map(a=>[a.id,a]));
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
function shell(title,description,canonical,body,image){
 const metadata=image?`<meta property="og:image" content="https://vincentliu.ai/${esc(image)}"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:card" content="summary_large_image">`:'';
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Follow Your Eye</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Follow Your Eye"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">${metadata}
<link rel="stylesheet" href="/style.css?v=20261030-discovery-v1"><link rel="stylesheet" href="/artwork.css?v=20261030-discovery-v1"></head>
<body><a class="skip-link" href="#main">Skip to the artwork</a><div class="app-shell"><header class="site-header"><a class="brand" href="/">Follow Your Eye</a><nav class="main-nav" aria-label="Main navigation"><a href="/artworks/">Explore paintings</a><a href="/gallery.html">Met gallery</a><a href="/">Choose paintings</a></nav></header>
<main id="main">${body}</main><footer class="site-footer"><span>Images and artwork metadata: The Metropolitan Museum of Art Open Access (CC0).</span><a href="https://www.metmuseum.org/hubs/open-access">Source policy ↗</a><a href="/about.html">About Follow Your Eye</a></footer></div></body></html>\n`;
}
function card(a){return `<a class="discovery-card" href="${url(a)}"><span class="discovery-image"><img src="/${esc(a.image)}" alt="${esc(a.title)}" loading="lazy" decoding="async"></span><strong>${esc(a.title)}</strong><span>${esc(a.artist)} · ${esc(a.date)}</span></a>`;}
const outputs=new Map();
for(const [i,a] of arts.entries()){
 const [heading,prompt]=prompts[i%prompts.length];
 const related=arts.filter(x=>x.id!==a.id).sort((x,y)=>Number(y.artist===a.artist)-Number(x.artist===a.artist)||Number(y.period===a.period)-Number(x.period===a.period)).slice(0,3);
 const description=`Explore ${a.title} by ${a.artist}, ${a.date}. View the Met painting and compare it with another work in Follow Your Eye.`;
 const schema={'@context':'https://schema.org','@type':'VisualArtwork',name:a.title,creator:{'@type':'Person',name:a.artist},artMedium:a.medium,image:`https://vincentliu.ai/${a.image}`,url:full(a),sameAs:a.sourceUrl,license:'https://creativecommons.org/publicdomain/zero/1.0/'};
 const body=`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/artworks/">Explore paintings</a><span aria-hidden="true"> / </span><span>${esc(a.title)}</span></nav>
<article><div class="work-layout"><figure class="work-image"><a href="/${esc(a.image)}" aria-label="Open the image of ${esc(a.title)}"><img src="/${esc(a.image)}" alt="${esc(a.title)} by ${esc(a.artist)}" fetchpriority="high"></a><figcaption>Image: The Met Open Access · <a href="${esc(a.sourceUrl)}">Collection record ${esc(a.id)} ↗</a></figcaption></figure>
<div class="work-copy"><p class="eyebrow">THE MET · OPEN ACCESS</p><h1>${esc(a.title)}</h1><p class="work-artist">${esc(a.artist)}</p><a class="work-quick-start" href="/?artwork=${a.id}&amp;source=artwork-${a.id}">Compare this painting →</a><dl><div><dt>Date</dt><dd>${esc(a.date)}</dd></div><div><dt>Medium</dt><dd>${esc(a.medium)}</dd></div><div><dt>Collection</dt><dd>The Metropolitan Museum of Art</dd></div></dl>
<p class="work-context">The Met collection record lists <cite>${esc(a.title)}</cite> under ${esc(a.artist)}, dated ${esc(a.date)}. The recorded medium is ${esc(a.medium)}. Dates and attributions follow the museum metadata, including any uncertainty.</p>
<div class="look-prompt"><h2>${heading}</h2><p>${prompt}</p><p class="caption">A looking prompt from Follow Your Eye.</p></div>
<div class="work-invitation"><p>Now put your first impression beside another painting.</p><a class="primary-button" href="/?artwork=${a.id}&amp;source=artwork-${a.id}">Which painting catches your eye? →</a><p class="caption">Start with this work, then explore 10 choices and compare your preferences with AI. If a round is in progress, this work will start your next round.</p><p lang="zh-CN" class="caption">从这幅作品开始选画。已有未完成的一轮时，将保留进度，并在下一轮展示这幅作品。</p></div>
<a class="work-source" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read the museum’s collection record ↗</a><p class="caption">An online record does not mean the work is currently on view.</p></div></div>
<section class="related"><p class="eyebrow">KEEP LOOKING</p><h2>Another place to follow your eye.</h2><div class="discovery-grid">${related.map(card).join('')}</div></section></article>
<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`;
 outputs.set(`web${url(a)}index.html`,shell(`${a.title} — ${a.artist}`,description,full(a),body,a.image));
}
outputs.set('web/artworks/index.html',shell('Explore 40 Met paintings','Discover 40 Met Open Access paintings. Explore each work, follow a looking prompt, and start a painting comparison.','https://vincentliu.ai/artworks/',`<section class="discovery-heading"><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h1>One painting is a beginning.</h1><p class="intro">Explore 40 paintings from The Met. Stay with a detail, then see what catches your eye beside another work.</p><p lang="zh-CN">从一幅作品开始，看看下一幅是否同样打动你。</p><a href="/gallery.html">Browse all 5,326 paintings →</a></section><div class="discovery-grid hub-grid">${arts.map(card).join('')}</div>`));
outputs.set('web/artwork-pages.mjs',`// Generated by tools/build_artwork_pages.mjs from ${selection.version}.\nexport const ARTWORK_PAGES = Object.freeze(${JSON.stringify(Object.fromEntries(arts.map(a=>[a.id,url(a)])),null,2)});\n`);
outputs.set('web/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/','/about.html','/gallery.html','/artworks/',...arts.map(url)].map(p=>`  <url><loc>https://vincentliu.ai${p}</loc></url>`).join('\n')}\n</urlset>\n`);
let stale=[];
for(const [name,content] of outputs){const p=path.join(root,name);if(process.argv.includes('--check')){try{if(readFileSync(p,'utf8')!==content)stale.push(name);}catch{stale.push(name);}}else{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,content);}}
if(stale.length)throw Error('Regenerate artwork pages: '+stale.join(', '));
console.log(`${process.argv.includes('--check')?'Verified':'Generated'} ${arts.length} artwork pages, hub, links and sitemap.`);
