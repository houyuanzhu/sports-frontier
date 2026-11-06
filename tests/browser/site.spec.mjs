import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const site=JSON.parse(fs.readFileSync('src/data/site.json','utf8'));
const posts=JSON.parse(fs.readFileSync('src/data/articles.json','utf8'));
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
 await page.goto(base+`/articles/${posts[0].slug}/`);await expect(page.locator('.notice')).toContainText(posts[0].demo?'演示内容':'官方信息索引');await expect(page.locator('.related>a')).toHaveCount(Math.min(2,posts.length-1));await page.screenshot({path:testInfo.outputPath('文章阅读.png'),fullPage:true});
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
 const context=await browser.newContext({javaScriptEnabled:false});const reader=await context.newPage();await reader.goto('http://127.0.0.1:4321'+base+`/articles/${posts[0].slug}/`);await expect(reader.locator('.article-body')).toContainText(posts[0].demo?'从体育问题出发':'官方信息索引');await reader.goto('http://127.0.0.1:4321'+base+'/search/');await expect(reader.locator('noscript p')).toContainText('搜索需要启用浏览器脚本');await context.close();
});
