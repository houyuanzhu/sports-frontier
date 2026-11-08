const transport = new Set(['access','network','timeout','http','structure','date','unexpected']);

export function sourceIssue(error,stage){
 const message=error.message||String(error);
 const code=error.cause?.code||error.code;
 const http=error.httpStatus||Number(/\bHTTP (\d{3})\b/.exec(message)?.[1])||null;
 let kind=error.kind;
 if(!kind){
  if([401,403,429,451].includes(http)||/robots|禁止索引|允许列表|重定向不符合|跳转超出/.test(message))kind='access';
  else if(http===408||/TIMEOUT|ETIMEDOUT/.test(code||'')||/TimeoutError|AbortError/.test(error.name)||/超时|timeout/i.test(message))kind='timeout';
  else if(http)kind='http';
  else if(code||/fetch failed|socket|network/i.test(message))kind='network';
  else if(/日期|时刻|时区/.test(message)&&!/超出.*窗口/.test(message))kind='date';
  else if(/结构变化|列表|缺少完整标题|站点身份|JSON|Unexpected token/.test(message))kind='structure';
  else if(/窗口|标题缺少|公开主体|跳过|留待|需要人工|未纳入|不符|有效 DOI|证实|需人工|技术方案|办理通知/.test(message))kind='excluded';
  else kind='unexpected';
 }
 return {kind,stage:error.sourceStage||stage,http,code:code&&/^[A-Z0-9_]+$/.test(code)?code:null,message};
}

export function affectsSource(issue){return transport.has(issue.kind);}

export function sourceHistory(previous,results,published,added,now){
 const history={...previous};
 for(const source of results){
  const old=history[source.sourceId]||{};
  const sample={at:now,state:source.status,accepted:source.candidates.length,new:added.filter(p=>p.sourceId===source.sourceId).length};
  const recent=[...(old.recent||[]),sample].slice(-30);
  const successes=recent.filter(r=>r.state==='success').length;
  const failureSince=source.status==='success'?null:old.failureSince||now;
  history[source.sourceId]={
   recent,attempts:recent.length,successes,partial:recent.filter(r=>r.state==='partial').length,
   lastSuccessAt:source.status==='success'?now:old.lastSuccessAt||null,
   failureSince,failureMs:failureSince?Date.parse(now)-Date.parse(failureSince):0,
   publishedCount:published.filter(p=>p.sourceId===source.sourceId&&p.editorial?.action!=='withdraw').length,
   consecutiveSuccesses:source.status==='success'?(old.consecutiveSuccesses||0)+1:0
  };
 }
 return history;
}

export function collectionQuality(results,accepted,duplicates){
 const exclusions=results.flatMap(source=>source.skipped).filter(row=>row.issue?.kind==='excluded').length;
 const rejected=results.flatMap(source=>source.skipped).filter(row=>['excluded','structure','date'].includes(row.issue?.kind)).length;
 return {duplicateCandidates:{numerator:duplicates,denominator:accepted},candidateExclusion:{numerator:rejected,denominator:accepted+rejected},exclusions};
}

export function auditQueue(previous,posts,added,now){
 const active=new Set(posts.filter(p=>p.editorial?.action!=='withdraw').map(p=>p.slug));
 const queued=(previous||[]).filter(entry=>active.has(entry.slug));
 const pending=new Set(queued.map(entry=>entry.slug));
 const sources=new Set();
 for(const post of added){
  if(!active.has(post.slug)||pending.has(post.slug)||sources.has(post.sourceId))continue;
  queued.push({slug:post.slug,url:post.url,sourceId:post.sourceId,category:post.category,queuedAt:now});
  sources.add(post.sourceId);
 }
 // 未完成项不静默删除，审校决定存放在 Git。
 return queued;
}
