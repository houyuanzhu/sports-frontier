import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const site=JSON.parse(fs.readFileSync('src/data/site.json','utf8'));
const posts=JSON.parse(fs.readFileSync('src/data/articles.json','utf8')).filter(post=>post.editorial?.action!=='withdraw');
const config=JSON.parse(fs.readFileSync('sources/config.json','utf8'));
const repo=process.env.GITHUB_REPOSITORY?.split('/');
const base=process.env.BASE_PATH??(repo&&repo[1]!==`${repo[0]}.github.io`?`/${repo[1]}`:'');
test('中文品牌、导航、浅深色与全页响应式',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');await expect(page.locator('h1')).toContainText('以体育为中心');
 await expect(page.locator('.brand')).toContainText(site.name);await expect(page.locator('.brand small')).toHaveText(site.tagline);
 await expect(page.getByRole('navigation',{name:'主导航'}).getByRole('link')).toHaveCount(7);
 await page.screenshot({path:testInfo.outputPath('首页浅色.png'),fullPage:true});
 await page.getByRole('button',{name:'切换深色模式'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:testInfo.outputPath('首页深色.png'),fullPage:true});
 const routes=['','articles/','categories/','archive/','about/','status/','search/','sources/','missing/',...posts.map(p=>`articles/${p.slug}/`),...site.categories.map(c=>`categories/${c.slug}/`)];
 for(const route of routes){await page.goto(base+'/'+route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBeTruthy();await expect(page.locator('h1')).toBeVisible();await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/)}
 expect(errors).toEqual([]);
});
test('六栏目导航与归档、文章阅读',async({page},testInfo)=>{
 await page.goto(base+'/categories/');await expect(page.locator('.category-grid>a')).toHaveCount(6);
 for(const c of site.categories){await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:c.name,exact:true}).click();await expect(page.locator('h1')).toContainText(c.name);await expect(page.locator('.post-row')).toHaveCount(posts.filter(p=>p.category===c.slug).length)}
 await page.goto(base+'/archive/');await expect(page.locator('.archive-category')).toHaveCount(posts.length);
 await page.goto(base+`/articles/${posts[0].slug}/`);await expect(page.locator('.notice')).toContainText(posts[0].demo?'演示内容':posts[0].contentType==='research-index'?'论文书目索引':'官方信息索引');await expect(page.locator('.related>a')).toHaveCount(Math.min(2,posts.length-1));await page.screenshot({path:testInfo.outputPath('文章阅读.png'),fullPage:true});
 const health=await (await page.request.get(base+'/health.json')).json();expect(health.siteId).toBe(site.siteId);expect(health.autoPublish).toBe(config.autoPublish);
});
test('搜索建议、栏目筛选、清空与链接状态',async({page},testInfo)=>{
 await page.goto(base+'/search/');await expect(page.locator('.search-result:visible')).toHaveCount(posts.length);
 await page.getByLabel('搜索关键词').fill(posts[0].title);await expect(page.locator('.search-result:visible')).toHaveCount(1);await expect(page).toHaveURL(/q=/);
 await page.getByLabel('筛选栏目').selectOption(site.categories.find(c=>c.slug!==posts[0].category).slug);await expect(page.locator('#search-status')).toContainText('没有找到');
 await page.getByRole('button',{name:'清空条件'}).click();await expect(page.locator('.search-result:visible')).toHaveCount(posts.length);
 await page.getByLabel('筛选栏目').selectOption(posts[0].category);await page.reload();await expect(page.getByLabel('筛选栏目')).toHaveValue(posts[0].category);await expect(page.locator('.search-result:visible')).toHaveCount(posts.filter(p=>p.category===posts[0].category).length);
 await page.getByLabel('搜索关键词').fill('<script>不存在</script>');await expect(page.locator('#search-status')).toContainText('没有找到');
 await page.getByRole('button',{name:'清空条件'}).click();await page.getByLabel('搜索关键词').fill('可穿戴');await page.screenshot({path:testInfo.outputPath('搜索结果.png'),fullPage:true});
});
test('键盘入口与无脚本阅读兜底',async({page,browser})=>{
 await page.goto(base+'/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'跳至正文'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
 const context=await browser.newContext({javaScriptEnabled:false});const reader=await context.newPage();await reader.goto('http://127.0.0.1:4321'+base+`/articles/${posts[0].slug}/`);await expect(reader.locator('.article-body')).toContainText(posts[0].demo?'从体育问题出发':posts[0].contentType==='research-index'?'书目说明':'官方信息索引');await reader.goto('http://127.0.0.1:4321'+base+'/search/');await expect(reader.locator('noscript p')).toContainText('搜索需要启用浏览器脚本');await context.close();
});
test('四类信息和科研机会状态可组合筛选',async({page})=>{
 await page.goto(base+'/search/?type=paper');
 await expect(page.getByLabel('信息类型')).toHaveValue('paper');
 await expect(page.locator('.search-result:visible')).toHaveCount(posts.filter(post=>post.doi).length);
 await page.getByLabel('信息类型').selectOption('opportunity');
 await page.getByLabel('科研机会子类').selectOption('talent');
 const talent=page.locator('[data-type="opportunity"][data-kind="talent"]');
 await expect(page.locator('.search-result:visible')).toHaveCount(await talent.count());
 await page.getByLabel('申请状态').selectOption('closed');
 await expect(page.locator('.search-result:visible')).toHaveCount(await talent.and(page.locator('[data-state="closed"]')).count());
 await page.getByLabel('申请状态').selectOption('open');
 await expect(page.locator('.search-result:visible')).toHaveCount(await talent.and(page.locator('[data-state="open"]')).count());
});
test('每日情报、研究精选和风口观察可公开阅读并适配三种屏宽',async({page})=>{
 await page.goto(base+'/');
 await expect(page.getByRole('link',{name:'阅读最近一期'})).toBeVisible();
 await page.getByRole('link',{name:'阅读最近一期'}).click();
 await expect(page).toHaveURL(/daily\/20\d{2}-\d{2}-\d{2}\//);
 await expect(page.locator('.page-heading')).toContainText('原文发布日期');
 for(const [route,title] of [['daily/','每日体育情报'],['research/','体育科研精选'],['trends/','体育风口观察'],['editorial/','编辑审核与更正']]){
  await page.goto(base+'/'+route);
  await expect(page.locator('h1')).toContainText(title);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBeTruthy();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 }
});
test('首页正式发布与今日收录分开，历史简报同时标明三种时间',async({page})=>{
 await page.goto(base+'/');
 await expect(page.getByRole('heading',{name:/近期正式发布/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'今日新收录'})).toBeVisible();
 await expect(page.getByRole('heading',{name:/常规政策索引与赛事规程/})).toBeVisible();
 const axes=page.getByLabel('情报时间口径');
 await expect(axes).toContainText('最近原始信息发布日期');
 await expect(axes).toContainText('最近一期网站首次收录日');
 await expect(axes).toContainText('最近采集检查时间');
 await page.getByRole('link',{name:'阅读最近一期'}).click();
 await expect(page.locator('h1')).toContainText('首次收录');
 const row=page.locator('.edition-item').first();
 await expect(row.locator('time').first()).toContainText('原始信息发布');
 await expect(row.locator('time').last()).toContainText('网站首次收录');
 expect(await row.locator('time').first().getAttribute('datetime')).not.toBe(await row.locator('time').last().getAttribute('datetime'));
});
