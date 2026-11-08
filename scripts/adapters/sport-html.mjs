import {load} from 'cheerio';
import {beijingDay,clean,hash,publishedDate,classify,opportunityFields} from '../ingest-core.mjs';
import {discover} from './list-pages.mjs';
export async function collectSource(source,client,policy,now){
 const list=await discover(source,client,policy,now);
 if(!list.entries.length)throw Error('列表结构变化：未发现公开详情链接');
 const candidates=[],skipped=[];let detailErrors=0;
 for(const {url} of list.entries){try{
  const page=await client.page(url);const d=load(page.text);const meta=name=>clean(d(`meta[name="${name}"]`).attr('content'));
  if(/noindex|none/i.test(d('meta[name=robots]').attr('content')||''))throw Error('原文禁止搜索索引');
  if(new URL(page.url).origin!==new URL(source.url).origin||!new RegExp(source.articlePathPattern||'/content\\.html$').test(page.url))throw Error('原文跳转超出审核范围');
  const title=meta('ArticleTitle'),publisher=meta('ContentSource');
  if(!title||title.length>180||!publisher)throw Error('缺少完整标题或原公开主体');
  if(source.expectedSiteId&&meta(source.siteIdField||'SiteIDCode')!==source.expectedSiteId)throw Error('原文站点身份字段不匹配');
  if(!new RegExp(source.publisherPattern||policy.trustedPublisherPattern).test(publisher))throw Error('转载或未知原公开主体，未纳入发布许可范围');
  const date=publishedDate(meta('PubDate'),now,source.timezone);
  if(Date.parse(beijingDay(now))-Date.parse(date.publishedAt.slice(0,10))>(source.maxAgeDays||policy.maxAgeDays)*86400000)throw Error('超出首次采集时间窗口');
  const classification=classify(title,source.defaultCategory,source.classificationProfile);if(!classification.category)throw Error(classification.reason);
  const id=hash(url).slice(0,20);const category=classification.category;
 d('script,style').remove();const text=d(source.bodySelector||'#zoom').first().text();
  const candidate={slug:'info-'+id,id,title,summary:`来源：${publisher}。本站仅整理公开标题与事实字段，完整内容请阅读官方原文。`,category,publishedAt:date.publishedAt,...date,source:publisher,sourceId:source.id,sourceChannel:source.name,url,collectedAt:now.toISOString(),firstIndexedAt:now.toISOString(),demo:false,minutes:1,art:category==='headlines'?'track':category==='technology'?'orbit':category==='science'?'lines':'grid',classificationRule:classification.rule,contentType:'official-index',contentHash:hash(page.text),rightsMode:policy.rightsMode,opportunity:category==='opportunities'?opportunityFields(text):null,body:[{heading:'官方信息索引',text:'本条仅记录官方公开标题、来源、日期和原文入口，不转载正文、图片或附件，也不生成政策解读、科研结论或趋势预测。'}]};
  candidate.region=source.region||null;
  if(candidate.opportunity)candidate.opportunity.kind=classification.kind||'call';
  candidates.push(candidate);
 }catch(e){if(/HTTP|403|fetch|超时|timeout|缺少完整标题|日期格式/.test(e.message))detailErrors++;skipped.push({url,reason:e.message});if(/403/.test(e.message))break}}
 return {sourceId:source.id,name:source.name,url:source.url,status:detailErrors===list.entries.length?'failed':detailErrors||list.listFailure?'partial':'success',httpStatus:list.pages[0].httpStatus,robotsStatus:list.pages[0].robotsStatus,method:'公开 HTML 元数据',checkedAt:now.toISOString(),pages:list.pages,seen:list.listed,pinnedCount:list.pinned,notFetchedCount:list.listed-candidates.length-skipped.length,error:list.listFailure,candidates,skipped};
}
