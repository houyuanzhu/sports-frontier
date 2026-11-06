import {test,expect} from '@playwright/test';
const repo=process.env.GITHUB_REPOSITORY?.split('/');const base=process.env.BASE_PATH??(repo&&repo[1]!==`${repo[0]}.github.io`?`/${repo[1]}`:'');
test('中文导航、深色模式、搜索与响应式',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');await expect(page.locator('h1')).toContainText('看见信息');
 await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5);
 await page.screenshot({path:testInfo.outputPath('首页浅色.png'),fullPage:true});
 await page.getByRole('button',{name:'切换深色模式'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:testInfo.outputPath('首页深色.png'),fullPage:true});
 for(const route of ['','articles/','categories/','archive/','about/','status/','articles/reading-with-context/','categories/ideas/','search/','missing/']){await page.goto(base+'/'+route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.locator('h1')).toBeVisible()}
 await page.goto(base+'/search/');await page.getByLabel('搜索关键词').fill('公开数据');await expect(page.locator('#search-status')).toContainText('找到');await expect(page.locator('.search-result:visible')).toHaveCount(1);await page.getByLabel('搜索关键词').fill('<script>不存在</script>');await expect(page.locator('#search-status')).toContainText('没有找到');expect(errors).toEqual([]);
});
test('键盘入口与无脚本阅读兜底',async({page,browser})=>{
 await page.goto(base+'/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'跳至正文'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
 const context=await browser.newContext({javaScriptEnabled:false});const reader=await context.newPage();await reader.goto('http://127.0.0.1:4321'+base+'/articles/reading-with-context/');await expect(reader.locator('.article-body')).toContainText('先理解，再判断');await reader.goto('http://127.0.0.1:4321'+base+'/search/');await expect(reader.locator('noscript p')).toContainText('搜索需要启用浏览器脚本');await context.close();
});

