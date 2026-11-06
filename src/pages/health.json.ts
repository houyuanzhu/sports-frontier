import site from '../data/site.json';
export function GET(){return new Response(JSON.stringify({schemaVersion:1,siteId:site.siteId,version:'2.0.0',buildCommit:process.env.GITHUB_SHA||'local',demo:site.demo,autoPublish:false}),{headers:{'Content-Type':'application/json; charset=utf-8'}})}
