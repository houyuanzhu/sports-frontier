import {sourceIssue,sourceHistory,collectionQuality,auditQueue} from './source-quality.mjs';
import {readFile},writeFile,mkdir} from 'node:fs/promises';
import {createClient} from './source-client.mjs';
import {collectSource} from './adapters/sport-html.mjs';
import {collectResearch} from './adapters/crossref.mjs';
import {registry,validateRecordUrl} from './source-registry.mjs';
import {mergeCandidates,hash,publishedDate,canonicalUrl} from './ingest-core.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const config=await read('sources/config.json'),policy=await read('sources/policy.json');
const phase=Number(process.env.SOURCE_PHASE||config.phase||1),now=new Date();
const publish=process.argv.includes('--publish');
if(publish&&(!config.autoPublish||config.phase!==3||config.publicationGate!=='metadata-reviewed'))throw Error('自动发布门禁未通过');
const existing=(await read('src/data/articles.json')).filter(p=>p.demo===false);
const previous=await read('src/data/status.json');
const corrections=await read('sources/corrections.json');
const correctionUrls=new Set();
for(const c of corrections){
 const url=canonicalUrl(validateRecordUrl(c.url,c.sourceId).href);
 if(correctionUrls.has(url)||!['withdraw','notice'].includes(c.action)||typeof c.note!=='string'||!c.note.trim()||c.note.length>500||!/^\d{4}-\d{2}-\d{2}$/.test(c.date))throw Error('更正条目格式不合法');
 publishedDate(c.date,now);
 if(c.verifiedDeadline!==undefined&&(c.action!=='notice'||publishedDate(c.verifiedDeadline,now).datePrecision!=='day'))throw Error('更正中的历史截止日期无效');
 correctionUrls.add(url);
}
const selected=registry.filter(s=>s.enabled&&s.phase<=phase&&(!process.env.SOURCE_ID||s.id===process.env.SOURCE_ID));
if(!selected.length||(publish&&process.env.SOURCE_ID))throw Error('选定来源不符合采集模式');
const client=createClient({...policy,allowedHosts:[...new Set(selected.map(s=>new URL(s.url).hostname))]});const results=[];
for(const source of selected){
 try{results.push(await (source.method==='crossref'?collectResearch(source,client,now):collectSource(source,client,policy,now)))}
 catch(e){results.push({sourceId:source.id,name:source.name,url:source.url,status:'failed',checkedAt:now.toISOString(),candidates:[],skipped:[],error:e.message,issue:sourceIssue(e,source.method==='crossref'?'api':'list')})}
}
const all=results.flatMap(s=>s.candidates);const merged=mergeCandidates(existing,all,corrections);
const failures=results.filter(s=>s.status==='failed').length;const partial=results.some(s=>s.status!=='success');
const state=failures===results.length?'failed':partial?'partial':merged.added?'updated':'no_change';
const status={checkedAt:now.toISOString(),finishedAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID||null,schedule:process.env.SCHEDULE_CRON||null,state,newCount:publish?merged.added:0,candidateCount:merged.added,duplicateCount:merged.duplicates,heldCount:merged.held,reviewCount:merged.review.length,attempts:client.stats.requests,retries:client.stats.retries,lastContentPublishedAt:(publish?merged.articles[0]?.publishedAt:existing[0]?.publishedAt)||previous.lastContentPublishedAt||null,latestCandidatePublishedAt:all.map(post=>post.publishedAt).sort().at(-1)||null,storedCount:publish?merged.articles.length:existing.length,autoPublish:publish,message:state==='failed'?'所有来源均不可用，保留已有资讯；请查看日志。':publish?(merged.added?`本次核验新增 ${merged.added} 条公开信息索引。`:'检查完成，没有通过核验的新增资讯。'):`试采集发现 ${merged.added} 条候选，未发布。`,sources:results.map(({candidates,...rest})=>({...rest,acceptedCount:candidates.length}))};
const known=new Set(existing.map(post=>post.slug));
const added=merged.articles.filter(post=>!known.has(post.slug)&&post.editorial?.action!=='withdraw');
status.sourceHistory=sourceHistory(previous.sourceHistory,results,publish?merged.articles:existing,publish?added:[],status.finishedAt);
status.quality=collectionQuality(results,all.length,merged.duplicates);
const reviews=await read('sources/quality-reviews.json');
const decisions=Object.values(reviews);
status.quality.classification={numerator:decisions.filter(review=>review.correct===true).length,denominator:decisions.filter(review=>typeof review.correct==='boolean').length};
status.auditQueue=auditQueue((previous.auditQueue||[]).filter(entry=>!reviews[entry.slug]),merged.articles,publish?added:[],status.finishedAt);
const ledger={schemaVersion:1,records:merged.articles.map(p=>({id:p.id,slug:p.slug,url:p.url,titleHash:hash(p.title),publishedAt:p.publishedAt,firstIndexedAt:p.firstIndexedAt})),lastCheckedAt:now.toISOString()};
await mkdir('reports/publish-bundle',{recursive:true});
await writeFile('reports/collection.json',JSON.stringify({status,candidates:all,review:merged.review,network:client.stats},null,2));
await writeFile('reports/candidates.json',JSON.stringify(merged.articles,null,2));
if(!publish)await writeFile('src/data/status.json',JSON.stringify(status,null,2)+'\n');
if(publish&&!merged.articles.length)throw Error('首次正式发布没有通过核验的真实内容，保留线上原版本');
if(publish){
 await writeFile('src/data/articles.json',JSON.stringify(merged.articles,null,2)+'\n');await writeFile('src/data/status.json',JSON.stringify(status,null,2)+'\n');await mkdir('data',{recursive:true});await writeFile('data/ingestion-state.json',JSON.stringify(ledger,null,2)+'\n');
 const manifest={schemaVersion:1,createdAt:now.toISOString(),sourceCommit:process.env.GITHUB_SHA||'local',baseDataSha:process.env.BASE_DATA_SHA||'',mode:'update',articleCount:merged.articles.length};
 for(const [name,value] of Object.entries({'articles.json':merged.articles,'state.json':ledger,'status.json':status,'manifest.json':manifest}))await writeFile('reports/publish-bundle/'+name,JSON.stringify(value,null,2)+'\n');
}
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`### 真实来源检查\n\n${status.message}\n\n- 系统检查：${status.checkedAt}\n- 来源内容最新日期：${status.lastContentPublishedAt||'无'}\n- 实际新增：${status.newCount}\n- 去重：${status.duplicateCount}\n- 失败来源：${failures}/${results.length}\n`,{flag:'a'});
if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`all_failed=${state==='failed'}\nnew_count=${status.newCount}\n`,{flag:'a'});
console.log(JSON.stringify({state,checkedAt:status.checkedAt,added:merged.added,total:merged.articles.length,duplicates:merged.duplicates,network:client.stats,sources:status.sources.map(s=>({id:s.sourceId,status:s.status,accepted:s.acceptedCount,skipped:s.skipped.length,issue:s.issue,error:s.error}))},null,2));
