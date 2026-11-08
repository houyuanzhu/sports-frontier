import {readFileSync} from 'node:fs';
import {allowedUrl} from './source-client.mjs';

export const registry=JSON.parse(readFileSync(new URL('../sources/registry.json',import.meta.url),'utf8'));
const domainsFor=source=>[new URL(source.url).hostname,...(source.recordHosts||[])];
export const recordHosts=[...new Set(registry.flatMap(domainsFor))];
export function validateRecordUrl(url,sourceId){
 const source=registry.find(entry=>entry.id===sourceId);
 if(sourceId&&!source)throw Error('资讯来源未登记');
 const parsed=allowedUrl(url,source?domainsFor(source):recordHosts);
 if(parsed.hostname==='doi.org'&&(!source||source.method!=='crossref'||!/^\/10\.\d{4,9}\/[A-Za-z0-9._()/;:+-]+$/.test(parsed.pathname)||parsed.search))throw Error('未核验的 DOI 记录地址');
 return parsed;
}
