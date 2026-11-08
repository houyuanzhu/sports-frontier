import {setTimeout as delay} from 'node:timers/promises';
export function allowedUrl(value,hosts){const u=new URL(value);if(u.protocol!=='https:'||!hosts.includes(u.hostname)||u.username||u.password||u.port)throw Error('地址不在HTTPS允许列表');return u}
export function robotsAllowed(text,url,agent='sports-frontier'){
 const groups=[];let current=null,hasRules=false;
 for(const raw of text.split(/\r?\n/)){const line=raw.replace(/#.*/,'').trim();if(!line||!line.includes(':'))continue;const [key,...rest]=line.split(':');const value=rest.join(':').trim();if(key.toLowerCase()==='user-agent'){if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false}current.agents.push(value.toLowerCase())}else if(current&&['allow','disallow'].includes(key.toLowerCase())){hasRules=true;if(value)current.rules.push({allow:key.toLowerCase()==='allow',path:value})}}
 const exact=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.includes(a)));const selected=exact.length?exact:groups.filter(g=>g.agents.includes('*'));
 const target=new URL(url).pathname+new URL(url).search;const matching=selected.flatMap(g=>g.rules).filter(r=>{const pattern=r.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');return new RegExp('^'+pattern).test(target)}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
 return !matching.length||matching[0].allow;
}
export function createClient(policy){let last=0;const robots=new Map(),blocked=new Set();const stats={requests:0,retries:0};
 async function request(value,{allow404=false,accept,checkRedirect}={}){
  let url=allowedUrl(value,policy.allowedHosts).href;
  if(blocked.has(url))throw Error('该URL已返回403，本轮不再访问，不绕过限制');
  for(let attempt=1;attempt<=3;attempt++){
   try{
    let response;
    for(let redirect=0;redirect<=3;redirect++){
     await delay(Math.max(0,policy.requestGapMs-(Date.now()-last)));last=Date.now();stats.requests++;
     response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(policy.timeoutMs),headers:{'User-Agent':'sports-frontier/3.1 (+https://github.com/houyuanzhu/sports-frontier)','Accept':accept||policy.accept||'text/html,text/plain;q=0.8'}});
     if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();const target=allowedUrl(new URL(response.headers.get('location'),url).href,policy.allowedHosts).href;if(redirect===3||new URL(target).origin!==new URL(url).origin||(checkRedirect&&!checkRedirect(target))){const error=Error('重定向不符合来源访问规则');error.noRetry=true;throw error;}url=target;continue}break;
    }
    if(response.status===404&&allow404){await response.body?.cancel();return {status:404,text:'',url}}
    if(!response.ok){await response.body?.cancel();if(response.status===403)blocked.add(url);const error=Error(`HTTP ${response.status}`);const retryAfter=response.headers.get('retry-after');error.retryMs=retryAfter?(/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now())):0;error.noRetry=(response.status>=400&&response.status<500&&![408,429].includes(response.status))||error.retryMs>30000;throw error}
    if(/noindex|none/i.test(response.headers.get('x-robots-tag')||'')){await response.body?.cancel();const e=Error('来源X-Robots-Tag禁止索引');e.noRetry=true;throw e}
    const reader=response.body.getReader();const chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>policy.maxResponseBytes)throw Error('响应体超过大小限制');chunks.push(value)}}finally{await reader.cancel()}
    const bytes=Buffer.concat(chunks);const charset=/charset\s*=\s*([\w-]+)/i.exec(response.headers.get('content-type')||'')?.[1]||'utf-8';return {status:response.status,text:new TextDecoder(charset).decode(bytes),url,bytes:length};
   }catch(e){if(e.noRetry||attempt===3)throw e;stats.retries++;await delay(Math.max(attempt*1000,e.retryMs||0))}
  }
 }
 return {stats,async page(url,{accept}={}){const origin=allowedUrl(url,policy.allowedHosts).origin;if(!robots.has(origin)){const result=await request(origin+'/robots.txt',{allow404:true,accept:'text/plain,*/*;q=0.2'});robots.set(origin,result)}const rules=robots.get(origin);if(!robotsAllowed(rules.text,url))throw Error('robots.txt禁止访问该路径');const result=await request(url,{accept,checkRedirect:target=>robotsAllowed(rules.text,target)});return {...result,robotsStatus:rules.status}},request};
}
