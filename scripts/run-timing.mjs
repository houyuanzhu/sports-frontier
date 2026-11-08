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
 if(!/^\d+$/.test(id)||clock&&!/^(?:\d{4}-\d{2}-\d{2}T)?([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw Error('格式为 RUN_ID、RUN_ID@HH:MM 或 RUN_ID@YYYY-MM-DDTHH:MM');
 const run=api(id),{jobs}=api(`${id}/jobs?per_page=100`);
 let plannedDay=local(run.created_at).slice(0,10);
 const explicit=clock?.includes('T');
 if(!explicit&&clock&&local(run.created_at).slice(11,16)<clock)plannedDay=local(new Date(Date.parse(run.created_at)-86400000)).slice(0,10);
 const plan=clock?(explicit?clock:plannedDay+'T'+clock)+':00+08:00':null;
 const finished=run.status==='completed'?run.updated_at:null;
 const operational=jobs.filter(job=>['build','persist','deploy','schedule-check'].includes(job.name)&&job.conclusion!=='skipped').map(job=>job.completed_at).filter(Boolean).sort().at(-1);
 const deploy=jobs.find(j=>j.name==='deploy');
 const release=deploy?.steps.find(s=>s.name.includes('发布静态页面')&&s.conclusion==='success');
 const verify=deploy?.steps.find(s=>s.name.includes('核验公开页面')&&s.conclusion==='success');
 rows.push({id:run.id,event:run.event,cron:process.env.SCHEDULE_CRON||null,gateMode:process.env.GATE_MODE||null,gateReason:process.env.GATE_REASON||null,gateSources:(process.env.GATE_IDS||'').split(',').filter(Boolean),planned:local(plan),created:local(run.created_at),started:local(run.run_started_at),finished:local(finished),operationsFinished:local(operational),planBasis:plan?(explicit?'explicit-date':'nearest-prior-cron'):null,crossedBeijingDay:plan?local(plan).slice(0,10)!==local(run.created_at).slice(0,10):null,gateSkipped:process.env.GATE_SKIP?process.env.GATE_SKIP==='true':jobs.find(job=>job.name==='build')?.conclusion==='skipped'&&run.event==='schedule',scheduleDelaySeconds:seconds(plan,run.created_at),runnerWaitSeconds:seconds(run.created_at,run.run_started_at),executionSeconds:seconds(run.run_started_at,finished||operational),published:local(release?.completed_at),verified:local(verify?.completed_at),conclusion:run.conclusion,failedJobs:jobs.filter(j=>['failure','timed_out','cancelled'].includes(j.conclusion)).map(j=>({name:j.name,result:j.conclusion}))});
}
console.log(JSON.stringify(rows,null,2));
