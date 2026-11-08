import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {publishedDate} from './ingest-core.mjs';
const git=(args,input)=>execFileSync('git',args,{encoding:'utf8',input,stdio:['pipe','pipe','pipe']}).trim();
export function validateSnapshot(articles,status,state){
 if(!Array.isArray(articles)||articles.length>20000||state.schemaVersion!==1||!Array.isArray(state.records))throw Error('持久化数据结构无效');
 const ids=new Set();for(const p of articles){const u=new URL(p.url);if(p.demo!==false||!/^info-[a-f0-9]{20}$/.test(p.slug)||!p.source||!p.publishedAt||!p.collectedAt||u.protocol!=='https:'||!['www.sport.gov.cn','tyj.sh.gov.cn'].includes(u.hostname)||u.username||u.password||u.port||!Array.isArray(p.body)||ids.has(p.slug)||!['headlines','policy','technology','science','opportunities','outlook'].includes(p.category))throw Error('历史条目安全检查失败');publishedDate(p.publishedAt);ids.add(p.slug)}
 if(state.records.length!==articles.length||new Set(state.records.map(r=>r.slug)).size!==articles.length||state.records.some(r=>!ids.has(r.slug)))throw Error('去重账本与历史资讯不一致');
 if(!status.checkedAt)throw Error('状态缺少检查时间');
}
export async function restore(){
 const remote=git(['ls-remote','origin','refs/heads/content-data']);
 if(!remote){if(process.env.ROLLBACK_REF)throw Error('无历史数据可回滚');if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,'base_data_sha=\n',{flag:'a'});console.log('尚无content-data分支，将首次创建持久化快照。');return}
 git(['fetch','--no-tags','origin','refs/heads/content-data:refs/remotes/origin/content-data']);const base=git(['rev-parse','refs/remotes/origin/content-data']);let target=base;
 if(process.env.ROLLBACK_REF){if(!/^[a-f0-9]{40}$/.test(process.env.ROLLBACK_REF))throw Error('回滚必须指定完整数据提交SHA');git(['merge-base','--is-ancestor',process.env.ROLLBACK_REF,base]);target=process.env.ROLLBACK_REF}
 const read=name=>JSON.parse(git(['show',`${target}:${name}`]));const articles=read('articles.json'),status=read('status.json'),state=read('state.json');validateSnapshot(articles,status,state);
 await writeFile('src/data/articles.json',JSON.stringify(articles,null,2)+'\n');await writeFile('src/data/status.json',JSON.stringify(status,null,2)+'\n');await mkdir('data',{recursive:true});await writeFile('data/ingestion-state.json',JSON.stringify(state,null,2)+'\n');
 if(process.env.GITHUB_ENV)await writeFile(process.env.GITHUB_ENV,`BASE_DATA_SHA=${base}\n`,{flag:'a'});
 if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`base_data_sha=${base}\n`,{flag:'a'});
 if(process.env.ROLLBACK_REF){
  const latestStatus=JSON.parse(git(['show',`${base}:status.json`]));
  const rolledBackAt=new Date().toISOString();
  const manifest={schemaVersion:1,mode:'rollback',sourceCommit:process.env.GITHUB_SHA,baseDataSha:base,rollbackRef:target,createdAt:rolledBackAt,articleCount:articles.length};
  const rollbackStatus={
   ...latestStatus, rolledBackAt, newCount:0, storedCount:articles.length,
   lastContentPublishedAt:articles.map(article=>article.publishedAt).sort().at(-1)??null,
   state:'rolled_back',message:'已恢复所选历史数据快照，本次未采集新内容。'
  };
  await mkdir('reports/publish-bundle',{recursive:true});
  await writeFile('src/data/status.json',JSON.stringify(rollbackStatus,null,2)+'\n');
  const bundle={'articles.json':articles,'state.json':state,'status.json':rollbackStatus,'manifest.json':manifest};
  for(const [name,value] of Object.entries(bundle))await writeFile('reports/publish-bundle/'+name,JSON.stringify(value,null,2)+'\n');
 }
 console.log(`已恢复 ${articles.length} 条历史资讯；数据版本 ${target}`);
}
export async function persist(dir='bundle'){
 const read=async name=>JSON.parse(await readFile(`${dir}/${name}`,'utf8'));const articles=await read('articles.json'),state=await read('state.json'),status=await read('status.json'),manifest=await read('manifest.json');validateSnapshot(articles,status,state);
 if(manifest.sourceCommit!==process.env.GITHUB_SHA)throw Error('候选包不属于当前代码提交');
 const remote=git(['ls-remote','origin','refs/heads/content-data']);const actual=remote.split(/\s/)[0]||'';
 if(actual)git(['fetch','--no-tags','origin','refs/heads/content-data:refs/remotes/origin/content-data']);
 const entries=[];for(const name of ['articles.json','manifest.json','state.json','status.json']){const blob=git(['hash-object','-w','--stdin'],await readFile(`${dir}/${name}`,'utf8'));entries.push(`100644 blob ${blob}\t${name}`)}
 const tree=git(['mktree'],entries.join('\n')+'\n');if(actual&&tree===git(['show','-s','--format=%T',actual])){console.log('快照内容完全相同，不创建重复提交。');return}
 if(actual!==(manifest.baseDataSha||''))throw Error('持久化分支已发生变化，拒绝覆盖');
 const sha=git(['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit-tree',tree,...(actual?['-p',actual]:[])],`保存已验证体育索引快照（${manifest.mode}）\n`);
 // token只经运行器环境进入官方gh凭据助手，不写入Git配置或命令参数。
 git(['-c','credential.helper=','-c','credential.helper=!gh auth git-credential','push','origin',`${sha}:refs/heads/content-data`]);console.log(`已保存数据提交 ${sha}`);
 if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`data_sha=${sha}\n`,{flag:'a'});
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/content-state.mjs'))await (process.argv[2]==='persist'?persist(process.argv[3]):restore());
