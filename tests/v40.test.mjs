import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildEditions,recordDailyCheck,editionFact} from '../src/lib/daily.mjs';
import {signed,signedPaper,signedTrends} from '../src/lib/editorial.mjs';

const a={slug:'a',title:'测试用标题',category:'policy',publishedAt:'2026-11-01',firstIndexedAt:'2026-11-07T16:00:00.000Z'};
const check={checkedAt:'2026-11-08T04:15:00.000Z',autoPublish:true,state:'partial',newCount:0,runId:'1'};
const today='2026-11-08';

test('日归属以北京时间首次收录为准，原文时间不变',()=>{
 const [day]=buildEditions([a],check);
 assert.equal(day.date,today);
 assert.equal(day.count,1);
 assert.equal(day.sections[0].posts[0].publishedAt,'2026-11-01');
 assert.equal(buildEditions([{...a,firstIndexedAt:'2026-11-07T15:59:59Z'}],check)[1].date,'2026-11-07');
});

test('同日重跑、乱序重放和跳过不重复，零新增可归档',()=>{
 const initial={...check,checkedAt:'2026-11-08T01:00:00Z',state:'updated',newCount:1};
 const history=recordDailyCheck({},initial);
 const updated=recordDailyCheck(history,check);
 assert.equal(Object.keys(updated).length,1);
 assert.equal(recordDailyCheck(updated,check),updated);
 assert.equal(recordDailyCheck(updated,initial),updated);
 assert.equal(recordDailyCheck(updated,{...check,state:'skipped',checkedAt:'2026-11-08T10:00:00Z'}),updated);
 assert.equal(buildEditions([a,a],{...check,dailyChecks:updated})[0].count,1);
 assert.equal(buildEditions([],{...check,state:'no_change'})[0].count,0);
});

test('全部来源失败不制造条目，回滚后只展示快照内的记录',()=>{
 const history=recordDailyCheck({},check);
 const report=buildEditions([],{...check,state:'failed'});
 assert.equal(report[0].check.state,'failed');
 assert.equal(report[0].count,0);
 const rollback=buildEditions([{...a,editorial:{action:'withdraw'}}],{...check,state:'rolled_back',dailyChecks:history});
 assert.equal(rollback[0].count,0);
 assert.equal(rollback[0].check.state,'partial');
});

test('每日分组优先已签发与政策，论文事实保留在题录边界',()=>{
 const paper={...a,slug:'paper',category:'technology',informationType:'paper'};
 const opportunity={...a,slug:'op',category:'opportunities',informationType:'opportunity'};
 const lead={...a,slug:'lead',priority:{},signoff:{editor:'测试编辑'}};
 const day=buildEditions([paper,opportunity,a,lead],check)[0];
 assert.deepEqual(day.sections.map(section=>section.key),['important','policy','opportunities','papers']);
 assert.match(editionFact(paper),/题录/);
});

test('签发日期、原题、全文证明及论文四段说明缺一不可',()=>{
 const p={...a,doi:'10.1000/test',contentType:'research-index',url:'https://doi.org/10.1000/test'};
 const note={state:'signed',editor:'测试编辑',signedOn:today,url:p.url,title:p.title,fullTextChecked:true,fullTextUrl:p.url,chineseTitle:'测试',design:'测试',findings:'测试',limitations:'测试',significance:'测试'};
 assert.equal(signedPaper(p,{...note,state:'draft'},today),null);
 assert.equal(signedPaper(p,note,today),note);
 assert.throws(()=>signedPaper(p,{...note,fullTextChecked:false},today),/全文核验/);
 assert.throws(()=>signedPaper(p,{...note,title:'错误题名'},today),/缺少原文/);
 assert.equal(signed({...note,signedOn:'2026-11-09'},today),false);
});

test('专题必须签发且有可回查的两条原始资料，草稿没有公开路由',()=>{
 const topic={slug:'fixture',topic:'ai-sports',state:'signed',title:'测试专题',summary:'只用于测试',author:'测试作者',editor:'测试编辑',signedOn:today,materialThrough:today,sources:[{id:'a',label:'资料一',url:'https://example.invalid/a',date:today},{id:'b',label:'资料二',url:'https://example.invalid/b',date:today}],claims:[{text:'测试结论',evidence:['a','b']}]};
 assert.deepEqual(signedTrends([topic,{...topic,slug:'draft',state:'draft'}],today),[topic]);
 assert.throws(()=>signedTrends([{...topic,claims:[{text:'测试结论',evidence:['unknown']}]}],today),/缺少有效证据/);
 assert.throws(()=>signedTrends([{...topic,sources:topic.sources.slice(0,1)}],today),/缺少有效证据/);
});
