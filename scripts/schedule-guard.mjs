import {readFileSync} from 'node:fs';
import {beijingDay} from './ingest-core.mjs';

export const primaryCron='10 0 * * *';
export const backupCron='37 3 * * *';
export const recoveryCooldownMs=15*60*1000;
const complete=['updated','no_change'];
const checked=['updated','no_change','partial','failed'];
const occurrence=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

function dayOf(value){
 const date=new Date(value);
 return value&&Number.isFinite(+date)?beijingDay(date):null;
}

export function scheduleDay(cron,createdAt){
 const time=cron===primaryCron?'08:10':cron===backupCron?'11:37':null;
 if(!time||!dayOf(createdAt))throw Error('缺少可验证的计划时间或 GitHub 创建时间');
 const created=new Date(createdAt);
 return beijingDay(occurrence.format(created)<time?new Date(+created-86400000):created);
}

function recoverable(source){
 const issues=[source.issue,...(source.skipped||[]).map(row=>row.issue)].filter(Boolean);
 if(source.status==='success'||!issues.length||issues.some(issue=>issue.kind==='access'||[401,403,429,451].includes(issue.http)))return false;
 return issues.some(issue=>['network','timeout'].includes(issue.kind)||issue.kind==='http'&&issue.http>=500&&issue.http<600);
}

export function collectionReceipt(status){
 return {
  attempts:status.recoveryAttempts||{},
  sources:(status.sources||[]).map(source=>({
   id:source.sourceId,
   lastAttemptAt:source.lastAttemptAt||source.checkedAt||status.finishedAt,
   recoverable:recoverable(source)
  }))
 };
}

export function recoverySources(receipt,day,now=new Date()){
 return (receipt?.sources||[]).filter(source=>{
  const attempted=Date.parse(source.lastAttemptAt);
  return source.recoverable&&/^[a-z0-9-]+$/.test(source.id||'')&&dayOf(source.lastAttemptAt)===day&&
   +now-attempted>=recoveryCooldownMs&&receipt.attempts?.[source.id]!==day;
 }).map(source=>source.id);
}

function siteHealth(health){
 return health?.siteId==='sports-frontier'&&health.schemaVersion===1&&health.autoPublish===true;
}

export function skipSchedule(health,now=new Date()){
 return siteHealth(health)&&complete.includes(health.collectionState)&&dayOf(health.checkedAt)===beijingDay(now);
}

export function planSchedule({health,cron,createdAt,manualRecovery=false,now=new Date()}){
 const today=beijingDay(now);
 const day=manualRecovery?today:scheduleDay(cron,createdAt);
 const result=(mode,reason,ids=[])=>({mode,reason,day,ids});
 if(day!==today)return result('skip','cross_day');
 const backup=manualRecovery||cron===backupCron;
 if(!siteHealth(health))return backup?result('skip','health_unavailable'):result('normal','no_receipt');
 const sameDay=dayOf(health.checkedAt)===day&&checked.includes(health.collectionState);
 if(sameDay&&skipSchedule(health,now))return result('skip','complete_today');
 if(!sameDay)return manualRecovery?result('skip','no_receipt'):result('normal','no_receipt');
 if(!backup)return result('skip','primary_already_checked');
 const ids=recoverySources(health.recovery,day,now);
 return ids.length?result('recovery','retry_transient',ids):result('skip','no_eligible_sources');
}

if(process.argv[1]?.replace(/\\/g,'/').endsWith('/schedule-guard.mjs')){
 const file=process.argv[2];
 const health=file?JSON.parse(readFileSync(file,'utf8')):null;
 const plan=planSchedule({health,cron:process.env.SCHEDULE_CRON,createdAt:process.env.RUN_CREATED_AT,manualRecovery:process.env.INPUT_MODE==='recover'});
 console.log(JSON.stringify(plan));
}
