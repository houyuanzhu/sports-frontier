import {execFileSync} from 'node:child_process';
const cli=process.env.GH_BIN||'gh';
const repo=process.env.GITHUB_REPOSITORY||'houyuanzhu/sports-frontier';
const api=path=>JSON.parse(execFileSync(cli,['api',`repos/${repo}/actions/runs/${path}`],{encoding:'utf8'}));
const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const local=value=>value?format.format(new Date(value)):null;
const seconds=(a,b)=>a&&b?Math.round((Date.parse(b)-Date.parse(a))/1000):null;
const rows=[];
for(const arg of process.argv.slice(2)){
 const [id,clock]=arg.split('@');
 if(!/^\d+$/.test(id)||clock&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw Error('格式为 RUN_ID 或 RUN_ID@北京时间HH:MM');
 const run=api(id),{jobs}=api(`${id}/jobs?per_page=100`);
 const plan=clock?`${local(run.created_at).slice(0,10)}T${clock}:00+08:00`:null;
 const deploy=jobs.find(j=>j.name==='deploy');
 const release=deploy?.steps.find(s=>s.name.includes('发布静态页面')&&s.conclusion==='success');
 const verify=deploy?.steps.find(s=>s.name.includes('核验公开页面')&&s.conclusion==='success');
 rows.push({id:run.id,event:run.event,planned:local(plan),created:local(run.created_at),started:local(run.run_started_at),finished:local(run.updated_at),scheduleDelaySeconds:seconds(plan,run.created_at),runnerWaitSeconds:seconds(run.created_at,run.run_started_at),executionSeconds:seconds(run.run_started_at,run.updated_at),published:local(release?.completed_at),verified:local(verify?.completed_at),conclusion:run.conclusion,failedJobs:jobs.filter(j=>['failure','timed_out','cancelled'].includes(j.conclusion)).map(j=>({name:j.name,result:j.conclusion}))});
}
console.log(JSON.stringify(rows,null,2));
