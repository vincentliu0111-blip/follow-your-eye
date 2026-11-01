import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
const text=p=>readFileSync(path.join(root,p),'utf8');
const editorial=JSON.parse(text('Data/artwork_editorial_v1.json')).artworks;
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const sitemap=[...text('web/sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
const local=url=>path.join(root,'web',new URL(url,'https://vincentliu.ai').pathname,'index.html');

test('all sitemap routes exist, have self canonicals and resolve internal links and images',()=>{
 assert.equal(sitemap.length,51);assert.equal(new Set(sitemap).size,51);
 for(const url of sitemap){
  const pathname=new URL(url).pathname,p=pathname.endsWith('/')?local(url):path.join(root,'web',pathname),html=readFileSync(p,'utf8');
  assert.ok(html.includes(`rel="canonical" href="${url}"`),url);
  for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
   const target=decode(m[1]);if(target.startsWith('https:')||target.startsWith('data:'))continue;
   const linked=new URL(target,url),file=linked.pathname.endsWith('/')?local(linked):path.join(root,'web',linked.pathname);
   assert.ok(existsSync(file),`${url}: missing ${target}`);
  }
 }
});

test('five translated artwork editions and two guide editions use reciprocal hreflang and independent canonicals',()=>{
 const pairs=Object.keys(editorial).map(id=>[`/artworks/met-${id}/`,`/zh/artworks/met-${id}/`]);pairs.push(['/art-choices/','/zh/art-choices/']);
 for(const [en,zh]of pairs){
  for(const p of [en,zh]){
   const html=readFileSync(local(p),'utf8');assert.ok(html.includes(`hreflang="en" href="https://vincentliu.ai${en}"`));assert.ok(html.includes(`hreflang="zh-Hans" href="https://vincentliu.ai${zh}"`));
   assert.ok(html.includes(`rel="canonical" href="https://vincentliu.ai${p}"`));assert.ok(html.includes(`<html lang="${p===zh?'zh-CN':'en'}">`));
  }
 }
 for(const [id,e] of Object.entries(editorial)){
  const en=readFileSync(local(`/artworks/met-${id}/`),'utf8'),zh=readFileSync(local(`/zh/artworks/met-${id}/`),'utf8');
  assert.ok(en.includes(e.sourceUrl));assert.ok(zh.includes(e.sourceUrl));
  for(const [language,html]of [['en',en],['zh',zh]]){
   assert.equal(e[language].sections.length,3);for(const [heading]of e[language].sections)assert.ok(html.includes(heading));
   assert.ok(html.includes('reading-content'));assert.ok(html.includes(`lang=${language}`));
  }
  const schema=JSON.parse(zh.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(schema.sameAs,e.sourceUrl);assert.equal(schema.url,`https://vincentliu.ai/zh/artworks/met-${id}/`);
 }
});

test('guide entry links lead to the existing experience with valid per-language sources',()=>{
 for(const lang of ['en','zh']){
  const html=readFileSync(local(lang==='zh'?'/zh/art-choices/':'/art-choices/'),'utf8');
  const links=[...html.matchAll(/href="(\/\?source=art_guide_[^"]+)"/g)].map(m=>new URL(decode(m[1]),'https://vincentliu.ai'));
  assert.equal(links.length,2);for(const l of links){assert.equal(l.searchParams.get('lang'),lang);assert.equal(l.searchParams.get('source'),`art_guide_${lang}`);}
 }
});

test('an explicit supported guide language changes UI locale without modifying or clearing saved experience data',()=>{
 const app=text('web/app.js'),start=app.indexOf('const requestedLanguage'),end=app.indexOf('const COPY',start),code=app.slice(start,end);
 assert.ok(start>=0&&end>start);
 for(const lang of ['zh','en','invalid','']){
  const calls=[],store=new Map([['follow-your-eye-experience-v1:dataset','retained']]);
  const c=vm.createContext({URLSearchParams,locale:'en',LOCALE_KEY:'language',location:{search:`?lang=${lang}`},localStorage:{setItem:(k,v)=>{store.set(k,v);calls.push(k);}}});
  vm.runInContext(code,c);assert.equal(c.locale,lang==='zh'?'zh':'en');assert.equal(store.get('follow-your-eye-experience-v1:dataset'),'retained');assert.deepEqual(calls,lang==='en'||lang==='zh'?['language']:[]);
 }
});
