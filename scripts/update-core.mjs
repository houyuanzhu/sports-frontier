import {setTimeout as delay} from 'node:timers/promises';
export async function detect({sources,registry,now=new Date(),previousPublishedAt=null,retryDelay=1000}) {
 const base={checkedAt:now.toISOString(),lastContentPublishedAt:previousPublishedAt,newCount:0,attempts:0};
 if(!sources.length)return {...base,state:'not_configured',message:'系统已检查配置：尚未接入内容源，无新增资讯。'};
 let attempts=0;
 try {
  const candidates=[];
  for(const source of sources){
   if(!registry[source.adapter])throw new Error('来源适配器尚未登记');
   let result;
   for(let n=1;n<=3;n++){
    attempts++;
    try{result=await registry[source.adapter]({signal:AbortSignal.timeout(15000),previousPublishedAt});break}
    catch(error){if(n===3)throw error;await delay(retryDelay*n)}
   }
   if(!result||!Array.isArray(result.candidates))throw new Error('来源返回格式无效');
   for(const c of result.candidates){
    if(!c.id||!c.title||!/^https:\/\//.test(c.url)||!/(Z|[+-]\d{2}:\d{2})$/.test(c.publishedAt)||!Number.isFinite(Date.parse(c.publishedAt))||Date.parse(c.publishedAt)>now.getTime())throw new Error('候选内容缺少可信日期或来源');
    if(!previousPublishedAt||Date.parse(c.publishedAt)>Date.parse(previousPublishedAt))candidates.push(c);
   }
  }
  const count=new Set(candidates.map(c=>c.url)).size;
  return {...base,attempts,state:count?'pending_review':'no_change',newCount:count,message:count?`发现 ${count} 条候选内容，等待审阅；未发布文章。`:'检查完成，无新增内容。'};
 } catch {return {...base,attempts,state:'failed',message:'内容源检查失败，已保留原有文章与发布时间；请查看运行日志。'}}
}
