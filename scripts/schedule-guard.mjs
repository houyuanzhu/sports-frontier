import {readFileSync} from 'node:fs';
import {beijingDay} from './ingest-core.mjs';

export function skipSchedule(health,now=new Date()){
 return health?.siteId==='sports-frontier'&&health.schemaVersion===1&&health.autoPublish===true&&
  ['updated','no_change','partial'].includes(health.collectionState)&&
  Number.isFinite(Date.parse(health.checkedAt))&&beijingDay(new Date(health.checkedAt))===beijingDay(now);
}

if(process.argv[1]?.replace(/\\/g,'/').endsWith('/schedule-guard.mjs')){
 const health=JSON.parse(readFileSync(process.argv[2],'utf8'));
 process.exitCode=skipSchedule(health)?0:1;
}
