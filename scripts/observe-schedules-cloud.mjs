import {execFileSync} from 'node:child_process';
import {appendFile,readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {beijingDay} from './ingest-core.mjs';
import {primaryCron,backupCron} from './schedule-guard.mjs';

export const startDay='2026-11-10';
export const finalDay='2026-11-17';
const start=new Date(startDay+'T00:00:00+08:00');
const slots=[[primaryCron,'08:10'],[backupCron,'11:37']];
const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'});
const stamp=value=>value?format.format(new Date(value)):null;
const elapsed=(a,b)=>a&&b?Math.round((Date.parse(b)-Date.parse(a))/1000):null;
const finiteCount=n=>Number.isInteger(n)&&n>=0?n:null;

export function plannedSlots(){
 return Array.from({length:7},(_,i)=>slots.map(([cron,clock])=>({
  day:beijingDay(new Date(+start+i*86400000)),cron,clock
 }))).flat();
}

export function evaluateRun(run,jobs,timing,collection,previous){
 if(run.event!=='schedule')throw Error('非 schedule 事件不得入账');
 const validTiming=String(timing?.id)===String(run.id)&&timing.event==='schedule'?timing:previous?.timing;
 const attempt=run.run_attempt||1;
 const build=jobs.find(job=>job.name==='build');
 const deploy=jobs.find(job=>job.name==='deploy');
 const deployed=deploy?.steps?.find(step=>step.name.startsWith('发布静态页面')&&step.conclusion==='success');
 const verified=deploy?.steps?.find(step=>step.name.startsWith('核验公开页面')&&step.conclusion==='success');
 const status=collection?.status;
 const checked=Date.parse(status?.checkedAt);
 // 采集工件没有尝试编号，必须与本次 build 的实际时间区间匹配。
 const from=Date.parse(build?.started_at), until=Date.parse(build?.completed_at);
 const belongs=String(status?.runId)===String(run.id)&&Number.isFinite(checked)&&checked>=from&&checked<=until;
 const evidence=belongs?{
  mode:status.collectionMode||null, sources:status.scannedSourceIds||[],
  added:finiteCount(status.newCount), duplicates:finiteCount(status.duplicateCount), checkedAt:status.checkedAt
 }:previous?.attempt===attempt?previous.collection:null;
 const gate=validTiming?.gateMode??null;
 const skipped=run.status==='completed'&&gate==='skip'&&build?.conclusion==='skipped';
 const slot=plannedSlots().find(item=>item.cron===validTiming?.cron&&
  validTiming?.planned===item.day+' '+item.clock+':00');
 return {
  id:run.id,attempt,url:run.html_url,commit:run.head_sha,event:run.event,slot:slot??null,
  createdAt:stamp(run.created_at),startedAt:stamp(run.run_started_at),
  finishedAt:run.status==='completed'?stamp(run.updated_at):null,
  delaySeconds:slot?elapsed(slot.day+'T'+slot.clock+':00+08:00',run.created_at):null,
  status:run.status,conclusion:run.conclusion,gate,gateReason:validTiming?.gateReason??null,
  plannedRecovery:validTiming?.gateSources||[],collection:evidence,
  build:build?.conclusion??null,deploy:deploy?.conclusion??null,
  publishedAt:stamp(deployed?.completed_at),verifiedAt:stamp(verified?.completed_at),
  confirmedNew:verified?evidence?.added??null:skipped?0:null,
  timing:validTiming??null
 };
}

function reportMarkdown(report,final){
 const lines=['# 政视体育 V4.1 '+(final?'七天观察最终复核':'七天观察台账'),'',
  '观察期为北京时间 2026-11-10 至 2026-11-16。查询时间为 '+report.observedAt+'。',''];
 const all=report.runs;
 const observed=report.cells.filter(cell=>cell.ids.length).length;
 const classified=all.filter(run=>run.slot);
 const published=classified.filter(run=>run.verifiedAt);
 const known=published.filter(run=>run.confirmedNew!==null);
 lines.push('14 个计划时点中，已确认触发 '+observed+' 个，已到但未见可归属事件 '+report.cells.filter(c=>!c.ids.length&&c.due).length+' 个。');
 lines.push('已归属的定时运行 '+classified.length+' 次，GitHub 结论成功 '+classified.filter(r=>r.conclusion==='success').length+' 次，确认补检 '+classified.filter(r=>r.collection?.mode==='recovery').length+' 次，确认门禁跳过 '+classified.filter(r=>r.gate==='skip'&&r.build==='skipped').length+' 次。');
 lines.push('当前运行尝试中，确认发布新增 '+(known.length?known.reduce((n,r)=>n+r.confirmedNew,0):'暂无可核验数值')+(known.length?' 条':'')+'。新增证据完整的 Pages 核验为 '+known.length+'/'+published.length+' 次。');
 lines.push('','| 北京计划时点 | 真实运行 | 创建延迟（秒） | 创建／开始／结束 | 结论 | 补检与去重 | Pages 发布／核验 | 已核验新增 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |');
 const v=x=>x??'待核实';
 for(const cell of report.cells){
  const label=cell.day+' '+cell.clock;
  if(!cell.ids.length){
   lines.push('| '+label+' | '+(cell.due?'截至查询未见可归属事件':'计划时点尚未到')+' | — | — | — | — | — | — |');
   continue;
  }
  for(const id of cell.ids){
   const r=all.find(item=>item.id===id);
   const mode=r.collection?.mode==='recovery'?'已补检 '+r.collection.sources.join('、'):
    r.gate==='recovery'?'计划补检 '+r.plannedRecovery.join('、'):
    r.gate==='skip'?'跳过 '+v(r.gateReason):r.gate==='normal'?'正常检查':'待核实';
   lines.push('| '+[label,'['+id+']('+r.url+') · 尝试 '+r.attempt+(cell.ids.length>1?' · 同时点多运行':''),
    v(r.delaySeconds),[r.createdAt,r.startedAt,r.finishedAt].map(v).join('／'),
    r.conclusion||r.status,mode+' · 重复候选 '+v(r.collection?.duplicates),
    [r.publishedAt,r.verifiedAt].map(v).join('／'),v(r.confirmedNew)].join(' | ')+' |');
  }
 }
 const unknown=all.filter(r=>!r.slot);
 if(unknown.length){
  lines.push('','## 未能归属的真实定时事件','');
  for(const r of unknown)lines.push('- ['+r.id+']('+r.url+')，创建 '+r.createdAt+'，开始 '+v(r.startedAt)+'，结束 '+v(r.finishedAt)+'，'+(r.conclusion||r.status)+'。');
 }
 const earlier=report.priorAttempts.filter(r=>r.verifiedAt);
 if(earlier.length){
  lines.push('','## 先前运行尝试的存档','');
  for(const r of earlier)lines.push('- ['+r.id+']('+r.url+') 第 '+r.attempt+' 次尝试，'+r.verifiedAt+' 核验，新增 '+v(r.confirmedNew)+'。该尝试与当前尝试同属一个触发。');
 }
 lines.push('','只统计原采集工作流实际产生的 schedule 事件。无确切 cron 工件的事件不猜测归属。跨日计划日沿用定时工件中的最近计划推定。确认跳过记 0，发布成功但缺少可匹配采集记录时保留待核实。','');
 return lines.join('\n');
}

async function main(){
 const repo=process.env.GITHUB_REPOSITORY||'houyuanzhu/sports-frontier';
 const gh=process.env.GH_BIN||'gh';
 const runGh=args=>execFileSync(gh,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:35000,maxBuffer:10*1024*1024});
 const api=suffix=>JSON.parse(runGh(['api','repos/'+repo+'/'+suffix]));
 const out=path.resolve(process.env.OBSERVATION_OUTPUT||'reports/cloud-schedule-observation');
 const temp=await mkdtemp(path.join(tmpdir(),'v41-observe-'));
 async function artifact(id,name,files){
  const dest=path.join(temp,String(id),name);
  try{runGh(['run','download',String(id),'-R',repo,'-n',name,'-D',dest]);}
  catch{return null;}
  for(const file of files){
   try{return JSON.parse(await readFile(path.join(dest,file),'utf8'));}
   catch{/* 工件目录结构不同或无法解析 */}
  }
  return null;
 }
 const ledgerName='v41-schedule-observation';
 const priorList=api('actions/artifacts?name='+ledgerName+'&per_page=50').artifacts;
 const priorArtifact=priorList.find(a=>!a.expired&&a.workflow_run?.head_branch==='main'&&String(a.workflow_run.id)!==process.env.GITHUB_RUN_ID);
 const prior=priorArtifact?await artifact(priorArtifact.workflow_run.id,ledgerName,['evidence.json']):null;
 if(priorArtifact&&(!prior||prior.repo!==repo||prior.startDay!==startDay||!Array.isArray(prior.runs)))throw Error('上一轮云端台账存在但无法恢复，保留原工件并等待补查');
 const previous=new Map((prior?.runs||[]).map(r=>[r.id,r]));
 const earlier=new Map((prior?.priorAttempts||[]).map(r=>[r.id+'/'+r.attempt,r]));
 const params=new URLSearchParams({event:'schedule',branch:'main',per_page:'100',created:'2026-11-09..2026-11-24'});
 const queried=api('actions/workflows/pages.yml/runs?'+params);
 if(queried.total_count>queried.workflow_runs.length)throw Error('真实运行查询未覆盖全部分页');
 const all=new Map(previous);
 for(const run of queried.workflow_runs){
  if(run.event!=='schedule')continue;
  const old=previous.get(run.id);
  if(old&&old.attempt===run.run_attempt&&old.status==='completed'&&old.timing&&old.collection)continue;
  const jobs=api('actions/runs/'+run.id+'/attempts/'+(run.run_attempt||1)+'/jobs?per_page=100').jobs;
  const timing=old?.timing??(await artifact(run.id,'schedule-timing',['schedule-timing.json']))?.[0];
  const needsCollection=jobs.some(job=>job.name==='build'&&job.conclusion!=='skipped');
  const collection=needsCollection?await artifact(run.id,'check-reports',['reports/collection.json','collection.json']):null;
  const entry=evaluateRun(run,jobs,timing,collection,old);
  if(old&&old.attempt!==entry.attempt)earlier.set(old.id+'/'+old.attempt,old);
  all.set(run.id,entry);
 }
 const now=new Date();
 const runs=[...all.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id-b.id)
  .filter(r=>r.slot||!r.timing?.planned||r.timing.planned.slice(0,10)>=startDay&&r.timing.planned.slice(0,10)<finalDay);
 const cells=plannedSlots().map(slot=>({...slot,
  due:+now>=Date.parse(slot.day+'T'+slot.clock+':00+08:00'),
  ids:runs.filter(r=>r.slot?.day===slot.day&&r.slot.cron===slot.cron).map(r=>r.id)
 }));
 const report={repo,startDay,observedAt:stamp(now),observerEvent:process.env.GITHUB_EVENT_NAME??'local',
  previousObserverRun:priorArtifact?.workflow_run.id??null,cells,runs,priorAttempts:[...earlier.values()]};
 await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2)+'\n');
 const final=beijingDay(now)>=finalDay;
 const markdown=reportMarkdown(report,final);
 await writeFile(path.join(out,final?'final-report.md':'daily-report.md'),markdown);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
 console.log('已保存 '+cells.length+' 个时段；真实定时事件 '+runs.length+' 个；上一轮观察 '+(report.previousObserverRun??'无'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
