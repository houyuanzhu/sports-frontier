import {sourceIssue} from '../source-quality.mjs';
import {load} from 'cheerio';
import {beijingDay,canonicalUrl,clean} from '../ingest-core.mjs';

export async function discover(source,client,policy,now){
 const origin=new URL(source.url).origin;
 const articlePattern=new RegExp(source.articlePathPattern||'/content\\.html$');
 const pagination=source.pagination;
 const urls=new Map(),pages=[],visited=new Set();
 const maxPages=Math.min(3,Math.max(1,pagination?.maxPages||1));
 let next=source.url,listFailure;
 while(next&&pages.length<maxPages&&!visited.has(next)){
  visited.add(next);
  let listing;
  try{listing=await client.page(next);}catch(error){if(!pages.length)throw error;listFailure=sourceIssue(error,'list');break;}
  pages.push({url:listing.url,httpStatus:listing.status,robotsStatus:listing.robotsStatus});
  const $=load(listing.text);
  for(const el of $(source.listSelector||'a[href]').toArray()){
   try{
    const link=new URL($(el).attr('href'),listing.url);
    if(source.upgradeAdvertisedHttp&&link.protocol==='http:'&&link.hostname===new URL(source.url).hostname)link.protocol='https:';
    const url=canonicalUrl(link.href);
    if(new URL(url).origin!==origin||!articlePattern.test(url))continue;
    const title=clean($(el).attr('title')||$(el).text());
    const container=$(el).closest('li,tr');
    const raw=container.text()||title;
    const date=/20\d{2}-\d{2}-\d{2}/.exec(raw)?.[0];
    const pinned=/置顶|置 顶/.test(raw)||container.is('.top,.pinned,[data-pinned="true"]');
    if(!urls.has(url)||(!urls.get(url).date&&date))urls.set(url,{url,title,date,pinned});
   }catch{/* 非文章或非 HTTPS 链接 */}
  }
  const link=pagination?.nextSelector?$(pagination.nextSelector).first().attr(pagination.attribute||'href'):pagination?.additionalPages?.[pages.length-1];
  next=null;
  if(link){
   try{const page=new URL(link,listing.url);if(page.origin===origin&&page.protocol==='https:'&&new RegExp(pagination.pathPattern).test(page.pathname)&&!page.search&&!page.hash)next=page.href;}catch{/* 路径未获审核 */}
  }
 }
 const today=beijingDay(now);
 const entries=[...urls.values()].sort((a,b)=>Number(a.pinned)-Number(b.pinned)||(b.date&&b.date<=today?b.date:'').localeCompare(a.date&&a.date<=today?a.date:'', 'en'));
 const maxDetails=Math.min(24,source.maxDetails||policy.maxItemsPerSource);
 const chosen=entries.slice(0,maxDetails);
 return {entries:chosen,listed:entries.length,notFetched:entries.length-chosen.length,pinned:entries.filter(entry=>entry.pinned).length,pages,listFailure};
}
