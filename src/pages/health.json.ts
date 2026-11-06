import site from '../data/site.json';
import config from '../../sources/config.json';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function GET(){const data=readFileSync('src/data/articles.json');return new Response(JSON.stringify({schemaVersion:1,siteId:site.siteId,version:'3.0.0',buildCommit:process.env.GITHUB_SHA||'local',contentDigest:createHash('sha256').update(data).digest('hex'),articleCount:JSON.parse(data.toString()).length,demo:site.demo,noindex:site.noindex,autoPublish:config.autoPublish}),{headers:{'Content-Type':'application/json; charset=utf-8'}})}
