import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateRun,plannedSlots} from '../scripts/observe-schedules-cloud.mjs';

const run={id:123,run_attempt:1,event:'schedule',created_at:'2026-11-10T00:20:00Z',
 run_started_at:'2026-11-10T00:21:00Z',updated_at:'2026-11-10T00:23:00Z',
 status:'completed',conclusion:'success',html_url:'https://github.com/example/project/actions/runs/123'};
const timing={id:123,event:'schedule',cron:'10 0 * * *',planned:'2026-11-10 08:10:00',gateMode:'normal'};
const collection={status:{runId:'123',checkedAt:'2026-11-10T00:21:10Z',collectionMode:'normal',newCount:2,duplicateCount:9}};
const build={name:'build',conclusion:'success',started_at:'2026-11-10T00:21:00Z',completed_at:'2026-11-10T00:22:00Z'};
const deploy={name:'deploy',conclusion:'success',steps:[
 {name:'发布静态页面（失败保留上一版本）',conclusion:'success',completed_at:'2026-11-10T00:22:30Z'},
 {name:'核验公开页面、代码提交与内容摘要',conclusion:'success',completed_at:'2026-11-10T00:22:40Z'}
]};

test('严格覆盖北京 10–16 日每日主备共 14 个时段',()=>{
 const cells=plannedSlots();
 assert.equal(cells.length,14);
 assert.deepEqual(cells[0],{day:'2026-11-10',cron:'10 0 * * *',clock:'08:10'});
 assert.deepEqual(cells.at(-1),{day:'2026-11-16',cron:'37 3 * * *',clock:'11:37'});
});

test('保留实际起止、延迟、候选去重和成功核验的上线新增',()=>{
 const entry=evaluateRun(run,[build,deploy],timing,collection);
 assert.equal(entry.delaySeconds,600);
 assert.equal(entry.startedAt,'2026-11-10 08:21:00');
 assert.equal(entry.finishedAt,'2026-11-10 08:23:00');
 assert.equal(entry.collection.duplicates,9);
 assert.equal(entry.confirmedNew,2);
 assert.equal(entry.verifiedAt,'2026-11-10 08:22:40');
});

test('排除手动事件，缺工件不猜时段或新增',()=>{
 assert.throws(()=>evaluateRun({...run,event:'workflow_dispatch'},[],null,null),/不得入账/);
 const entry=evaluateRun(run,[build,deploy],null,null);
 assert.equal(entry.slot,null);
 assert.equal(entry.confirmedNew,null);
 assert.equal(evaluateRun(run,[build],timing,collection).confirmedNew,null);
});

test('确认跳过记零，备份恢复不把旧尝试计入新尝试',()=>{
 const skipped=evaluateRun(run,[{name:'build',conclusion:'skipped'}],{...timing,gateMode:'skip'},null);
 assert.equal(skipped.confirmedNew,0);
 const original=evaluateRun(run,[build,deploy],timing,collection);
 assert.equal(evaluateRun(run,[build,deploy],null,null,original).confirmedNew,2);
 const later={...build,started_at:'2026-11-10T00:40:00Z',completed_at:'2026-11-10T00:41:00Z'};
 assert.equal(evaluateRun({...run,run_attempt:2},[later,deploy],null,collection,original).confirmedNew,null);
});
