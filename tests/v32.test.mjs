import {test} from 'node:test';
import assert from 'node:assert/strict';
import {informationType,recentImportant,priorityCriteria} from '../src/lib/information.mjs';
import {opportunityState} from '../src/lib/publication.mjs';
import {sourceIssue,sourceHistory,collectionQuality,auditQueue} from '../scripts/source-quality.mjs';
import {skipSchedule} from '../scripts/schedule-guard.mjs';

test('重要性需要五项人工依据，论文和机会独立分层',()=>{
 const post={url:'https://test.invalid/1',title:'重大赛事竞赛规程',category:'headlines'};
 const review={url:post.url,title:post.title,reviewedOn:'2026-11-08',...Object.fromEntries(Object.keys(priorityCriteria).map(key=>[key,'仅用于测试']))};
 assert.equal(informationType(post),'index');
 assert.equal(informationType(post,{...review,event:''}),'index');
 assert.equal(informationType({...post,title:'新题名'},review),'index');
 assert.equal(informationType(post,review),'important');
 assert.equal(informationType({...post,category:'opportunities'},review),'opportunity');
 assert.equal(informationType({...post,contentType:'research-index',doi:'10.1000/test'},review),'paper');
 assert.equal(recentImportant({...post,informationType:'important',publishedAt:'2026-10-10'},'2026-11-08'),true);
 assert.equal(recentImportant({...post,informationType:'important',publishedAt:'2026-10-09'},'2026-11-08'),false);
});

test('开闭状态依据经核验的开始与截止区间，截止日不猜时刻',()=>{
 const post={title:'项目申报',opportunity:{deadline:'2026-11-08'}};
 assert.equal(opportunityState(post,'2026-11-06'),'unverified');
 const known={...post,opportunity:{...post.opportunity,opensAt:'2026-11-07'}};
 assert.equal(opportunityState(known,'2026-11-06'),'unverified');
 assert.equal(opportunityState(known,'2026-11-07'),'open');
 assert.equal(opportunityState(known,'2026-11-08'),'unverified');
 assert.equal(opportunityState(known,'2026-11-09'),'closed');
 assert.equal(opportunityState({...known,opportunity:{...known.opportunity,kind:'history'}},'2026-11-09'),'history');
});

test('访问限制、网络、超时、结构和日期故障区分',()=>{
 const errors=[[Error('HTTP 403'),'access'],[new TypeError('fetch failed',{cause:{code:'ECONNRESET'}}),'network'],[new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}}),'timeout'],[Error('列表结构变化'),'structure'],[Error('日期格式或精度不受支持'),'date'],[Error('超出首次采集时间窗口'),'excluded']];
 for(const [error,kind] of errors)assert.equal(sourceIssue(error,'list').kind,kind);
 assert.equal(sourceIssue(errors[2][0],'list').code,'UND_ERR_CONNECT_TIMEOUT');
});

test('真实候选口径分开，连续故障、成功恢复及待抽查队列有分母',()=>{
 const result={sourceId:'test',status:'success',candidates:[{}],skipped:[{issue:{kind:'excluded'}},{issue:{kind:'network'}}]};
 const post={slug:'1',sourceId:'test',url:'https://test.invalid/',category:'science'};
 let history=sourceHistory({},[result],[post],[post],'2026-11-06T00:00:00Z');
 history=sourceHistory(history,[{...result,status:'partial'}],[post],[],'2026-11-07T00:00:00Z');
 history=sourceHistory(history,[{...result,status:'failed',candidates:[]}],[post],[],'2026-11-08T00:00:00Z');
 assert.equal(history.test.failureMs,86400000);
 assert.equal(history.test.lastSuccessAt,'2026-11-06T00:00:00Z');
 assert.deepEqual([history.test.successes,history.test.attempts,history.test.publishedCount],[1,3,1]);
 history=sourceHistory(history,[result],[post],[],'2026-11-09T00:00:00Z');
 assert.equal(history.test.failureSince,null);
 assert.deepEqual(collectionQuality([result],1,1),{duplicateCandidates:{numerator:1,denominator:1},candidateExclusion:{numerator:1,denominator:2},exclusions:1});
 const queue=auditQueue([],[post],[post],'2026-11-08T00:00:00Z');
 assert.equal(queue.length,1);
 assert.deepEqual(auditQueue(queue,[post],[post],'2026-11-09T00:00:00Z'),queue);
});

test('同日已部署即跳过备用，两次计划均使用同一防重复门禁',()=>{
 const live={siteId:'sports-frontier',schemaVersion:1,autoPublish:true,collectionState:'partial',checkedAt:'2026-11-07T16:01:00Z'};
 assert.equal(skipSchedule(live,new Date('2026-11-08T03:37:00Z')),true);
 assert.equal(skipSchedule({...live,collectionState:'failed'},new Date('2026-11-08T03:37:00Z')),false);
 assert.equal(skipSchedule({...live,collectionState:'rolled_back'},new Date('2026-11-08T03:37:00Z')),false);
 assert.equal(skipSchedule(live,new Date('2026-11-09T00:10:00Z')),false);
 assert.equal(skipSchedule(null),false);
});
import {discover} from '../scripts/adapters/list-pages.mjs';

test('福建等重点入口在原预算内预留机会名额，过期和置顶条目不占用预留',async()=>{
 const origin='https://fixture.invalid';
 const entries=[
  ['2026-11-07','体育赛事开赛','event',''],
  ['2026-11-06','体育科研课题申报','open',''],
  ['2026-11-08','体育科研课题申报','pinned','class="pinned"'],
  ['2026-01-01','体育科研课题申报','old','']
 ];
 const client={page:async url=>({url,status:200,robotsStatus:404,text:entries.map(([date,title,slug,attrs])=>`<li ${attrs}>${date}<a href="/detail/${slug}">${title}</a></li>`).join('')})};
 const source={url:origin+'/list',articlePathPattern:'/detail/[a-z]+$',maxDetails:1,opportunitySlots:1,maxAgeDays:45,defaultCategory:'headlines',classificationProfile:'strict'};
 const result=await discover(source,client,{},new Date('2026-11-08'));
 assert.deepEqual(result.entries.map(e=>e.url),[origin+'/detail/open']);
 assert.equal(result.notFetched,3);
});
