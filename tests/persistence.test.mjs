import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {persist,restore,validateSnapshot} from '../scripts/content-state.mjs';import {hash} from '../scripts/ingest-core.mjs';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/source-metadata.json',import.meta.url),'utf8'));
test('真实Git事务验证：历史持久化、同包重试幂等、并发覆盖拒绝及祖先回滚',async()=>{
 const original=process.cwd();await mkdir('work',{recursive:true});const temp=await mkdtemp(path.join(original,'work/storage-test-'));const bare=path.join(temp,'remote.git'),repo=path.join(temp,'repo');
 const git=(cwd,args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 execFileSync('git',['init','--bare',bare],{stdio:'pipe'});execFileSync('git',['init',repo],{stdio:'pipe'});git(repo,['remote','add','origin',bare]);
 await mkdir(path.join(repo,'src/data'),{recursive:true});await mkdir(path.join(repo,'bundle'));
 const saved={...process.env};delete process.env.GITHUB_ENV;delete process.env.GITHUB_OUTPUT;delete process.env.ROLLBACK_REF;process.env.GITHUB_SHA=hash('local-storage-regression').slice(0,40);
 try{process.chdir(repo);
  const a=fixtures.filter(f=>/科技创新项目立项|智能体育典型案例/.test(f.title)).map(f=>({...f,source:f.publisher,id:hash(f.url).slice(0,20),slug:'info-'+hash(f.url).slice(0,20),demo:false,category:'technology',collectedAt:new Date().toISOString(),firstIndexedAt:new Date().toISOString(),body:[]}));
  const status={checkedAt:new Date().toISOString(),state:'no_change',newCount:0};
  const save=async(articles,base)=>{const state={schemaVersion:1,records:articles.map(p=>({slug:p.slug}))};validateSnapshot(articles,status,state);for(const [name,value]of Object.entries({'articles.json':articles,'state.json':state,'status.json':status,'manifest.json':{schemaVersion:1,sourceCommit:process.env.GITHUB_SHA,baseDataSha:base,mode:'update'}}))await writeFile('bundle/'+name,JSON.stringify(value,null,2)+'\n')};
  await save(a.slice(0,1),'');await persist();const first=git(bare,['rev-parse','refs/heads/content-data']);await persist();assert.equal(git(bare,['rev-parse','refs/heads/content-data']),first,'同一候选包重试不得重复提交');
  await save(a,first);await persist();const second=git(bare,['rev-parse','refs/heads/content-data']);assert.notEqual(first,second);
  await restore();assert.equal(JSON.parse(await readFile('src/data/articles.json','utf8')).length,a.length);
  await save(a.slice(0,1),'');await assert.rejects(()=>persist(),/拒绝覆盖/);
  process.env.ROLLBACK_REF=first;await restore();assert.equal(JSON.parse(await readFile('src/data/articles.json','utf8')).length,1);assert.equal(JSON.parse(await readFile('src/data/status.json','utf8')).state,'rolled_back');
  await persist('reports/publish-bundle');const third=git(bare,['rev-parse','refs/heads/content-data']);assert.notEqual(third,first);assert.equal(git(bare,['rev-parse',third+'^']),second,'回滚采用新提交，不能重写历史');
 }finally{process.chdir(original);for(const key of ['GITHUB_SHA','GITHUB_ENV','GITHUB_OUTPUT','ROLLBACK_REF']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]}}
});
