import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
const site=JSON.parse(await readFile('src/data/site.json','utf8'));
const posts=JSON.parse(await readFile('src/data/articles.json','utf8'));
const root=path.resolve('dist');let pages=0,links=0;const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);e.isDirectory()?await walk(f):files.push(f)}}await walk(root);
const repo=process.env.GITHUB_REPOSITORY?.split('/');
const base=process.env.BASE_PATH??(repo&&repo[1]!==`${repo[0]}.github.io`?`/${repo[1]}`:'');
for(const file of files.filter(f=>f.endsWith('.html'))){
 const html=await readFile(file,'utf8');const $=load(html);pages++;
 assert.equal($('html').attr('lang'),'zh-CN');assert.equal($('h1').length,1);
 assert.ok($('title').text().includes(site.name));assert.ok($('head meta[name=description]').attr('content'));
 assert.equal($('meta[name=site-id]').attr('content'),site.siteId);
 assert.equal($('nav[aria-label="主导航"] a').length,7);
 if(site.noindex||site.demo)assert.match($('meta[name=robots]').attr('content'),/noindex/);
 assert.ok(Buffer.byteLength(html)<100000,'HTML超过性能预算');
 assert.doesNotMatch(html,/\/categories\/(observation|ideas|practice)\//,'发现旧栏目链接');
 for(const el of $('a[href],link[href],script[src]').toArray()){
  let href=$(el).attr('href')||$(el).attr('src');
  if(!href||/^(https?:|mailto:|data:)/.test(href))continue;
  if(href.startsWith('#')){assert.ok($(href).length);continue}
  href=decodeURIComponent(href.split(/[?#]/)[0]);if(base&&href.startsWith(base+'/'))href=href.slice(base.length);
  let target=href.startsWith('/')?path.join(root,href):path.resolve(path.dirname(file),href);
  try{if((await stat(target)).isDirectory())target=path.join(target,'index.html');await stat(target);links++}
  catch{throw Error(`链接不存在：${file} → ${href}`)}
 }
}
assert.equal(pages,9+site.categories.length+posts.length);
for(const c of site.categories)assert.ok(files.includes(path.join(root,`categories/${c.slug}/index.html`)));
for(const required of ['index.html','articles/index.html','categories/index.html','search/index.html','archive/index.html','about/index.html','status/index.html','404.html','sitemap-index.xml','robots.txt','health.json'])assert.ok(files.includes(path.join(root,required)),required);
const health=JSON.parse(await readFile('dist/health.json','utf8'));
const config=JSON.parse(await readFile('sources/config.json','utf8'));assert.equal(health.siteId,site.siteId);assert.equal(health.buildCommit,process.env.GITHUB_SHA||'local');assert.equal(health.autoPublish,config.autoPublish);assert.equal(health.articleCount,posts.length);
const css=(await Promise.all(files.filter(f=>f.endsWith('.css')).map(f=>readFile(f,'utf8')))).join('');
assert.ok(css.includes('prefers-reduced-motion'));assert.ok(css.includes('700px'));
console.log(`静态检查通过：${pages} 页、六大栏目、${links} 个站内资源链接；中文、SEO、健康接口及体积预算通过。`);
