import {calendarDay} from './publication.mjs';

const recordedStates=['updated','no_change','partial','failed'];
export const checkLabels={
 updated:'采集完成 · 有新增',
 no_change:'采集完成 · 无新增',
 partial:'部分来源失败',
 failed:'全部来源失败',
 skipped:'同日已有上线结果 · 跳过',
 rolled_back:'已恢复历史快照'
};

export function recordDailyCheck(history,status){
 const day=calendarDay(status.checkedAt);
 if(!day||!status.autoPublish||!recordedStates.includes(status.state))return history||{};
 const older=history?.[day];
 if(older&&Date.parse(older.checkedAt)>=Date.parse(status.checkedAt))return history;
 const {checkedAt,state,newCount,runId}=status;
 return {...history,[day]:{checkedAt,state,newCount,runId}};
}

function section(post){
 if(post.signoff&&post.priority)return 'important';
 if(post.category==='policy')return 'policy';
 if(post.informationType==='opportunity')return 'opportunities';
 if(post.informationType==='paper')return 'papers';
 if(post.category==='technology'||post.category==='science')return 'technology';
 if(post.category==='headlines')return 'headlines';
 return 'other';
}

const sections=[
 ['important','已签发的重要资讯'],
 ['headlines','体育动态'],
 ['policy','体育政策'],
 ['technology','体育科技与运动科学'],
 ['opportunities','科研机会'],
 ['other','其他情报'],
 ['papers','论文书目']
];

export function buildEditions(posts,status){
 const checks=recordDailyCheck(status.dailyChecks,status);
 const days=new Map(Object.entries(checks).map(([date,check])=>[date,{date,check,posts:[]}]));
 const seen=new Set();
 for(const post of posts){
  if(post.demo||post.editorial?.action==='withdraw'||seen.has(post.slug))continue;
  const date=calendarDay(post.firstIndexedAt);
  if(!date)continue;
  seen.add(post.slug);
  if(!days.has(date))days.set(date,{date,check:null,posts:[]});
  days.get(date).posts.push(post);
 }
 return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(day=>({
  date:day.date,check:day.check,count:day.posts.length,
  sections:sections.map(([key,label])=>({key,label,posts:day.posts.filter(post=>section(post)===key)})).filter(group=>group.posts.length)
 }));
}

export function editionFact(post){
 if(post.factNote)return post.factNote.text;
 if(post.informationType==='paper')return '本条为期刊论文题录，已核对期刊、日级出版日期和 DOI。';
 if(post.informationType==='opportunity')return post.opportunity?.eligibility||'本条为科研事项原始通知。申报条件与有效性请以原文为准。';
 return post.classificationRule?'收录依据为已核验的公开发布信息。'+post.classificationRule+'。':'本条保留原公开主体、发布日期及原文入口。';
}
