import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classify,mergeCandidates,publishedDate,sameEvent} from '../scripts/ingest-core.mjs';
import {discover} from '../scripts/adapters/list-pages.mjs';
import {researchCandidate} from '../scripts/adapters/crossref.mjs';
import {registry,validateRecordUrl} from '../scripts/source-registry.mjs';
import {lifecycle,publicationStats} from '../src/lib/publication.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v31-actual-titles.json',import.meta.url)));
test('真实官方样本、统计通知和赛事补助的栏目边界',()=>{
 const expected=['headlines','headlines','technology','policy','opportunities',undefined,undefined];
 for(const [i,p] of fixtures.entries()){
  const source=registry.find(s=>s.id===p.sourceId);
  assert.equal(classify(p.title,source.defaultCategory,source.classificationProfile).category,expected[i],p.title);
  validateRecordUrl(p.url,p.sourceId);
 }
});

test('北京时间分钟精度、日历统计与过期科研机会',()=>{
 const now=new Date('2026-11-07T16:02:00Z');
 assert.equal(publishedDate('2026-11-08 00:01',now,'Asia/Shanghai').publishedAt,'2026-11-08T00:01+08:00');
 assert.throws(()=>publishedDate('2026-11-08 00:01',now));
 assert.throws(()=>publishedDate('2026-11-08T00:03+08:00',now));
 const past={category:'opportunities',publishedAt:'2026-11-08',title:'课题申报',opportunity:{deadline:'2026-11-07'}};
 const article={category:'technology',publishedAt:'2026-11-02'};
 assert.equal(lifecycle(past,'2026-11-08'),'已截止');
 assert.equal(lifecycle({...past,opportunity:{deadline:null}},'2026-11-08'),'待核实');
 assert.equal(lifecycle({category:'policy',publishedAt:'2026-09-08'},'2026-11-08'),'历史政策，效力以原文为准');
 assert.deepEqual(publicationStats([past,article,{...article,publishedAt:'2026-10-10'},{...article,publishedAt:'2026-10-09'},{...article,editorial:{action:'withdraw'}}],'2026-11-08'),
  {total:4,last7:2,last30:3,latestEffective:'2026-11-02'});
});

test('同日转载、原文更正及撤回，跨日期同标题不合并',()=>{
 const original={...fixtures[0],category:'headlines',slug:'test-record'};
 const variant={...original,url:fixtures[1].url};
 assert.equal(sameEvent(original,{...variant,publishedAt:'2026-10-01'}),false);
 const first=mergeCandidates([original],[variant]);
 assert.equal(first.added,0);
 assert.equal(first.articles[0].alternateSources[0].url,variant.url);
 assert.equal(mergeCandidates(first.articles,[variant]).duplicates,1);
 assert.equal(mergeCandidates(first.articles,[{...original,title:'原文有变更'}]).review.length,1);
 const withdrawn=mergeCandidates(first.articles,[original],[{url:original.url,action:'withdraw',date:'2026-11-08',note:'内部机制测试'}]);
 assert.equal(withdrawn.held,1);
 assert.equal(withdrawn.articles[0].editorial.action,'withdraw');
 const reviewed=mergeCandidates([{...original,category:'opportunities'}],[],[{url:original.url,action:'notice',date:'2026-11-08',note:'内部机制测试',verifiedDeadline:'2026-11-07'}]);
 assert.equal(reviewed.added,0);
 assert.equal(lifecycle(reviewed.articles[0],'2026-11-08'),'已截止');
});

test('分页机制优先采集非置顶的新条目，忽略超范围的下一页',async()=>{
 const origin='https://fixture.invalid';
 const listings=[
  '<li class="pinned">置顶 2026-10-01 <a href="/detail/old">旧公告</a></li><li>2026-11-01 <a href="/detail/first">第一条</a></li><a class="next" href="/list/2">下一页</a>',
  '<li>2026-11-07 <a href="/detail/fresh">新公告</a></li><a class="next" href="https://other.invalid/list/3">下一页</a>'
 ];
 const client={page:async url=>({url,text:listings.shift(),status:200,robotsStatus:404})};
 const result=await discover({url:origin+'/list/1',articlePathPattern:'/detail/[a-z]+$',maxDetails:1,pagination:{maxPages:3,nextSelector:'.next',pathPattern:'^/list/[23]$'}},client,{},new Date('2026-11-08'));
 assert.equal(result.pages.length,2);
 assert.equal(result.entries[0].url,origin+'/detail/fresh');
 assert.equal(result.pinned,1);
 assert.equal(result.notFetched,2);
});

test('学术入口拒绝不匹配期刊、更正文献和缺乏日级出版日期的记录',()=>{
 const source=registry.find(s=>s.id==='crossref-sports-engineering');
 const base={type:'journal-article',ISSN:[source.issn],'container-title':[source.journal],DOI:'10.1000/test',title:['Test for adapter rules']};
 assert.throws(()=>researchCandidate({...base,'published':{'date-parts':[[2026,11]]}},source,new Date('2026-11-08')),/缺少精确到日/);
 assert.throws(()=>researchCandidate({...base,'container-title':['Unrelated journal']},source,new Date('2026-11-08')),/期刊/);
 assert.throws(()=>researchCandidate({...base,title:['Correction to a sports paper']},source,new Date('2026-11-08')),/更正/);
 assert.throws(()=>validateRecordUrl('https://doi.org/10.1000/test','sport-notices'));
});
