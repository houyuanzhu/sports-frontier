import {load} from 'cheerio';
import {beijingDay,clean,hash,publishedDate} from '../ingest-core.mjs';

export function researchCandidate(item,source,now){
 if(item.type!=='journal-article'||!item.ISSN?.includes(source.issn)||item['container-title']?.[0]!==source.journal)throw Error('期刊或文献类型与审核配置不符');
 const doi=String(item.DOI||'').toLowerCase();
 if(!/^10\.\d{4,9}\/[a-z0-9._()/;:+-]+$/.test(doi))throw Error('无有效 DOI');
 const title=clean(load(item.title?.[0]||'',null,false).text());
 if(title.length<12||title.length>260||/^(editorial|erratum|corrigendum|correction|retraction|expression of concern|letter to the editor)\b/i.test(title)||item['update-to']?.length||item['updated-by']?.length)throw Error('更正、撤回或编辑信息需人工核验');
 const dateField=item['published-online']?'published-online':'published';
 const parts=item[dateField]?.['date-parts']?.[0];
 if(parts?.length!==3||!parts.every(Number.isInteger))throw Error('缺少精确到日的原始出版日期');
 const date=publishedDate(parts.map((n,i)=>String(n).padStart(i?2:4,'0')).join('-'),now);
 if(Date.parse(beijingDay(now))-Date.parse(date.publishedAt)>source.maxAgeDays*86400000)throw Error('超出采集日期窗口');
 const url=`https://doi.org/${doi}`;
 const id=hash(url).slice(0,20),category=source.defaultCategory;
 return {
  slug:'info-'+id,id,title,summary:`${source.journal} 论文书目。出版日期和 DOI 来自 Crossref。`,
  category,...date,source:source.journal,sourceId:source.id,sourceChannel:source.name,url,doi,dateField,
  collectedAt:now.toISOString(),firstIndexedAt:now.toISOString(),demo:false,minutes:1,art:category==='technology'?'orbit':'lines',
  classificationRule:source.classificationBasis,contentType:'research-index',rightsMode:'bibliographic-only',
  body:[{heading:'书目说明',text:'本条提供原始英文题名、期刊、出版日期与 DOI。研究设计、证据强度和实际适用性需查阅论文并独立判断。'}]
 };
}

export async function collectResearch(source,client,now){
 const url=new URL(source.url);
 const from=new Date(Date.parse(beijingDay(now))-source.maxAgeDays*86400000).toISOString().slice(0,10);
 url.searchParams.set('filter',`from-pub-date:${from},until-pub-date:${beijingDay(now)},type:journal-article`);
 url.searchParams.set('sort','published');url.searchParams.set('order','desc');url.searchParams.set('rows',String(source.maxDetails));
 const result=await client.page(url.href,{accept:'application/json'});
 const items=JSON.parse(result.text).message?.items;
 if(!Array.isArray(items))throw Error('Crossref 未返回书目列表');
 const candidates=[],skipped=[];
 for(const item of items){try{candidates.push(researchCandidate(item,source,now));}catch(error){skipped.push({doi:item.DOI,reason:error.message});}}
 return {sourceId:source.id,name:source.name,url:source.url,status:'success',httpStatus:result.status,robotsStatus:result.robotsStatus,method:'Crossref 公共书目 API',checkedAt:now.toISOString(),pages:[{url:url.href,httpStatus:result.status}],seen:items.length,candidates,skipped};
}
