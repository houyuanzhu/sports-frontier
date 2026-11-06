import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createClient} from './source-client.mjs';
import {collectSource} from './adapters/sport-html.mjs';
import {mergeCandidates,hash} from './ingest-core.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const config=await read('sources/config.json'),policy=await read('sources/policy.json'),registry=await read('sources/registry.json');
const phase=Number(process.env.SOURCE_PHASE||config.phase||1),now=new Date();
const publish=process.argv.includes('--publish');
if(publish&&(!config.autoPublish||config.phase!==3||config.publicationGate!=='metadata-reviewed'))throw Error('自动发布门禁未通过');
const existing=(await read('src/data/articles.json')).filter(p=>p.demo===false);
const previous=await read('src/data/status.json');const client=createClient(policy);const results=[];
for(const source of registry.filter(s=>s.enabled&&s.phase<=phase)){
 try{results.push(await collectSource(source,client,policy,now))}
 catch(e){results.push({sourceId:source.id,name:source.name,url:source.url,status:'failed',checkedAt:now.toISOString(),candidates:[],skipped:[],error:e.message})}
}
const all=results.flatMap(s=>s.candidates);const merged=mergeCandidates(existing,all);
const failures=results.filter(s=>s.status==='failed').length;const partial=results.some(s=>s.status!=='success');
const state=failures===results.length?'failed':partial?'partial':merged.added?'updated':'no_change';
const status={checkedAt:now.toISOString(),state,newCount:publish?merged.added:0,candidateCount:merged.added,duplicateCount:merged.duplicates,attempts:client.stats.requests,retries:client.stats.retries,lastContentPublishedAt:(publish?merged.articles[0]?.publishedAt:existing[0]?.publishedAt)||previous.lastContentPublishedAt||null,latestCandidatePublishedAt:merged.articles[0]?.publishedAt||null,storedCount:publish?merged.articles.length:existing.length,autoPublish:publish,message:state==='failed'?'所有来源均不可用，保留已有资讯；请查看日志。':publish?(merged.added?`本次核验新增 ${merged.added} 条官方信息索引。`:'检查完成，没有通过核验的新增资讯。'):`试采集发现 ${merged.added} 条候选，未发布。`,sources:results.map(({candidates,...rest})=>({...rest,acceptedCount:candidates.length}))};
const ledger={schemaVersion:1,records:merged.articles.map(p=>({id:p.id,slug:p.slug,url:p.url,titleHash:hash(p.title),publishedAt:p.publishedAt,firstIndexedAt:p.firstIndexedAt})),lastCheckedAt:now.toISOString()};
await mkdir('reports/publish-bundle',{recursive:true});
await writeFile('reports/collection.json',JSON.stringify({status,candidates:all,network:client.stats},null,2));
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
console.log(JSON.stringify({state,checkedAt:status.checkedAt,added:merged.added,total:merged.articles.length,duplicates:merged.duplicates,network:client.stats,sources:status.sources.map(s=>({id:s.sourceId,status:s.status,accepted:s.acceptedCount,skipped:s.skipped.length,error:s.error}))},null,2));
