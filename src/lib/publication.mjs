const dayFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
export function calendarDay(value){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value;
 const date=new Date(value);
 return value&&Number.isFinite(+date)?dayFormat.format(date):null;
}
function ageDays(value,today){const day=calendarDay(value);return day?(Date.parse(today)-Date.parse(day))/86400000:Infinity;}
export function lifecycle(post,today=calendarDay(new Date())){
 if(post.editorial?.action==='withdraw')return '已撤回';
 if(post.category==='opportunities')return opportunityStates[opportunityState(post,today)];
 if(post.category==='policy'&&ageDays(post.publishedAt,today)>=30)return '历史政策，效力以原文为准';
 return null;
}
export function publicationStats(posts,today=calendarDay(new Date())){
 const active=posts.filter(post=>post.editorial?.action!=='withdraw');
 const within=n=>active.filter(post=>{const age=ageDays(post.publishedAt,today);return age>=0&&age<n;});
 const effective=within(30).filter(post=>post.category!=='opportunities'||opportunityState(post,today)==='open');
 return {total:active.length,last7:within(7).length,last30:within(30).length,latestEffective:effective.map(post=>post.publishedAt).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null};
}

export const opportunityStates={open:'开放申请',closed:'已截止',unverified:'待核实',history:'历史公示'};

export function opportunityState(post,today=calendarDay(new Date())){
 const info=post.opportunity;
 if(info?.kind==='history'||/立项名单|立项结果|拟立项|评审结果|入选单位/.test(post.title))return 'history';
 const deadline=calendarDay(info?.deadline);
 if(deadline&&deadline<today)return 'closed';
 const starts=calendarDay(info?.opensAt);
 if(starts&&starts<=today&&deadline&&today<deadline)return 'open';
 return 'unverified';
}
