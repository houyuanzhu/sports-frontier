import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {beijingDay} from './ingest-core.mjs';
import {backupCron,primaryCron} from './schedule-guard.mjs';

const [start,daysValue='7',directory='reports/schedule-observation']=process.argv.slice(2);
const count=Number(daysValue);
const startDate=new Date(start+'T00:00:00+08:00');
if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!Number.isFinite(+startDate)||beijingDay(startDate)!==start||!Number.isInteger(count)||count<7||count>30)throw Error('用法：node scripts/observe-schedules.mjs YYYY-MM-DD [7到30天] [输出目录]');
const repo=process.env.GITHUB_REPOSITORY||'houyuanzhu/sports-frontier';
const gh=process.env.GH_BIN||'gh';
const api=endpoint=>JSON.parse(execFileSync(gh,['api','repos/'+repo+'/'+endpoint],{encoding:'utf8'}));
const dayAt=offset=>beijingDay(new Date(+startDate+offset*86400000));
const period=new URLSearchParams({event:'schedule',per_page:'100',created:dayAt(-1)+'..'+dayAt(count+1)});
const {workflow_runs:runs}=api('actions/workflows/pages.yml/runs?'+period);
const startSlots=new Map([[primaryCron,'08:10'],[backupCron,'11:37']]);
const cells=Array.from({length:count},(_,index)=>[...startSlots].map(([cron,clock])=>({day:dayAt(index),cron,clock,runs:[]}))).flat();
const unknown=[];
const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'});
const stamp=value=>value?local.format(new Date(value)):null;
for(const run of runs){
 const {id,created_at,run_started_at,updated_at,status,conclusion,html_url}=run;
 const dir=path.join(directory,'artifacts',String(id));
 const timing=path.join(dir,'schedule-timing.json');
 let evidence;
 try{
  await mkdir(dir,{recursive:true});
  try{evidence=JSON.parse(await readFile(timing,'utf8'))[0];}
  catch{
   execFileSync(gh,['run','download',String(id),'-R',repo,'--name','schedule-timing','--dir',dir],{stdio:'pipe'});
   evidence=JSON.parse(await readFile(timing,'utf8'))[0];
  }
 }catch{/* 没有事件附件时保留为未归属 */}
 const entry={id,url:html_url,createdAt:stamp(created_at),startedAt:stamp(run_started_at),finishedAt:status==='completed'?stamp(updated_at):null,status,conclusion,gate:evidence?.gateMode||null,reason:evidence?.gateReason||null,recoverySources:evidence?.gateSources||[],delaySeconds:evidence?.scheduleDelaySeconds??null,crossedBeijingDay:evidence?.crossedBeijingDay??null};
 const cell=cells.find(slot=>slot.day===evidence?.planned?.slice(0,10)&&slot.cron===evidence?.cron);
 if(cell)cell.runs.push(entry);
 else unknown.push(entry);
}
const observedAt=new Date();
for(const cell of cells){
 const planned=new Date(cell.day+'T'+cell.clock+':00+08:00');
 cell.observation=cell.runs.length?'有已归属定时事件':planned>observedAt?'计划时点尚未到':'截至查询未见可归属事件';
}
await mkdir(directory,{recursive:true});
const file=path.join(directory,'observation.json');
await writeFile(file,JSON.stringify({repo,observedAt:stamp(observedAt.toISOString()),timezone:'Asia/Shanghai',cells,unassignedScheduleEvents:unknown},null,2)+'\n');
console.log(file);
