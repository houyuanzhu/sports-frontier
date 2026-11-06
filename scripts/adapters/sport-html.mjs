import {load} from 'cheerio';
import {clean,hash,canonicalUrl,publishedDate,classify,opportunityFields} from '../ingest-core.mjs';
export async function collectSource(source,client,policy,now){
 const listing=await client.page(source.url);const $=load(listing.text);
 const urls=[...new Set($('a[href]').toArray().map(e=>{try{return canonicalUrl(new URL($(e).attr('href'),source.url).href)}catch{return null}}).filter(Boolean))].filter(u=>new URL(u).hostname===new URL(source.url).hostname&&new RegExp(source.articlePathPattern||'/content\\.html$').test(u)).slice(0,policy.maxItemsPerSource);
 if(!urls.length)throw Error('列表结构变化：未发现公开详情链接');
 const candidates=[],skipped=[];let detailErrors=0;
 for(const url of urls){try{
  const page=await client.page(url);const d=load(page.text);const meta=name=>clean(d(`meta[name="${name}"]`).attr('content'));
  if(/noindex|none/i.test(d('meta[name=robots]').attr('content')||''))throw Error('原文禁止搜索索引');
  const title=meta('ArticleTitle'),publisher=meta('ContentSource');
  if(!title||title.length>180||!publisher)throw Error('缺少完整标题或原公开主体');
  if(source.expectedSiteId&&meta('SiteIDCode')!==source.expectedSiteId)throw Error('原文站点身份字段不匹配');
  if(!new RegExp(policy.trustedPublisherPattern).test(publisher))throw Error('转载或未知原公开主体，未纳入发布许可范围');
  const date=publishedDate(meta('PubDate'),now);if(now.getTime()-Date.parse(date.publishedAt)>policy.maxAgeDays*86400000)throw Error('超出首次采集时间窗口');
  const classification=classify(title,source.defaultCategory);if(!classification.category)throw Error(classification.reason);
  const id=hash(url).slice(0,20);const category=classification.category;
  d('script,style').remove();const text=d('#zoom').text();
  const candidate={slug:'info-'+id,id,title,summary:`来源：${publisher}。本站仅整理公开标题与事实字段，完整内容请阅读官方原文。`,category,publishedAt:date.publishedAt,...date,source:publisher,sourceId:source.id,sourceChannel:source.name,url,collectedAt:now.toISOString(),firstIndexedAt:now.toISOString(),demo:false,minutes:1,art:category==='headlines'?'track':category==='technology'?'orbit':category==='science'?'lines':'grid',classificationRule:classification.rule,contentType:'official-index',contentHash:hash(page.text),rightsMode:policy.rightsMode,opportunity:category==='opportunities'?opportunityFields(text):null,body:[{heading:'官方信息索引',text:'本条仅记录官方公开标题、来源、日期和原文入口，不转载正文、图片或附件，也不生成政策解读、科研结论或趋势预测。'}]};
  candidates.push(candidate);
 }catch(e){if(/HTTP|403|fetch|超时|timeout|缺少完整标题|日期格式/.test(e.message))detailErrors++;skipped.push({url,reason:e.message});if(/403/.test(e.message))break}}
 return {sourceId:source.id,name:source.name,url:source.url,status:detailErrors===urls.length?'failed':detailErrors?'partial':'success',httpStatus:listing.status,robotsStatus:listing.robotsStatus,rssDiscovered:$('link[type*="rss"],link[type*="atom"]').length>0,method:'公开HTML元数据（非RSS、非专有API）',checkedAt:now.toISOString(),seen:urls.length,notFetchedCount:urls.length-candidates.length-skipped.length,candidates,skipped};
}
