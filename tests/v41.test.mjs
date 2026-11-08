import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupCron,primaryCron,planSchedule,collectionReceipt,scheduleDay} from '../scripts/schedule-guard.mjs';

const ts='2026-11-08T00:12:00Z';
const day='2026-11-08';
const health={siteId:'sports-frontier',schemaVersion:1,autoPublish:true,collectionState:'partial',checkedAt:ts};
const failed=(sourceId,issue,lastAttemptAt=ts)=>({sourceId,status:'failed',issue,lastAttemptAt});
const timeout={kind:'timeout',code:'ETIMEDOUT'};
const access={kind:'access',http:403};
const eligible=collectionReceipt({sources:[
 failed('timeout',timeout),failed('denied',access),failed('server',{kind:'http',http:503}),
 failed('rate-limit',{kind:'access',http:429}),failed('parse',{kind:'structure'}),
 {...failed('mixed',timeout),skipped:[{issue:access}]},
 failed('still-cooling',timeout,'2026-11-08T03:27:00Z'),
 failed('yesterday',timeout,'2026-11-07T03:00:00Z'),
 failed('already-tried',timeout)
],recoveryAttempts:{'already-tried':day}});
const backup=(status=health,now='2026-11-08T03:37:00Z',createdAt=now)=>planSchedule({health:status,cron:backupCron,createdAt,now:new Date(now)});
const primary=(status=health)=>planSchedule({health:status,cron:primaryCron,createdAt:'2026-11-08T00:10:00Z',now:new Date('2026-11-08T00:11:00Z')});

test('正常检查和完整成功的同日防重',()=>{
 assert.equal(primary(null).mode,'normal');
 assert.equal(backup({...health,checkedAt:'2026-11-07T01:00:00Z'}).mode,'normal');
 assert.equal(backup({...health,collectionState:'no_change'}).reason,'complete_today');
 assert.equal(backup(null).reason,'health_unavailable');
});

test('部分失败仅补检满足冷却条件的暂时故障',()=>{
 assert.deepEqual(backup({...health,recovery:eligible}),{mode:'recovery',reason:'retry_transient',day,ids:['timeout','server']});
 assert.equal(primary({...health,recovery:eligible}).reason,'primary_already_checked');
});

test('同一来源当天已补检、仅有403或结构异常时不重复采集',()=>{
 const receipt={...eligible,attempts:{timeout:day,server:day,'already-tried':day}};
 assert.deepEqual(backup({...health,recovery:receipt}).ids,[]);
 assert.equal(backup({...health,recovery:receipt}).mode,'skip');
});

test('跨日调度和跨日排队均跳过过期时段',()=>{
 assert.equal(scheduleDay(backupCron,'2026-11-08T16:05:00Z'),day);
 assert.equal(backup(health,'2026-11-08T16:05:00Z').reason,'cross_day');
 assert.equal(backup(health,'2026-11-08T16:05:00Z','2026-11-08T04:00:00Z').reason,'cross_day');
 assert.throws(()=>scheduleDay('unknown',ts),/缺少可验证/);
});

test('手动补检有明确来源范围，使用与备用计划相同的权限和冷却规则',()=>{
 const scoped=planSchedule({health:{...health,recovery:eligible},manualRecovery:true,now:new Date('2026-11-08T00:28:00Z')});
 assert.deepEqual(scoped.ids,['timeout','server']);
 assert.equal(scoped.mode,'recovery');
});
