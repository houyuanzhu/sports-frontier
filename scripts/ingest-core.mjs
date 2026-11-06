import {createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function clean(value){return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim()}
export function publishedDate(raw,now=new Date()){
 const value=clean(raw);if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期格式或精度不受支持');
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)throw Error('日期不合法');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(value>today)throw Error('来源日期晚于当前北京时间');
 return {publishedAt:value,datePrecision:'day',publicationTimezone:'Asia/Shanghai',rawPublishedAt:value};
}
export function classify(title,fallback){
 if(/党委|党组|纪委|党建|政治|政绩观|意识形态|廉政|主题教育|巡视|干部任免|预算|决算|获奖名单|入选单位公示|拟授予|行政许可|备案统计表|招聘|采购|招标|中标/.test(title))return {reason:'非体育专业资讯或行政名单，跳过'};
 if(!/体育|运动|健身|赛事|奥运|足球|篮球|羽毛球|体质|滑雪|自行车|游泳|康复训练/.test(title))return {reason:'标题缺少明确体育相关性'};
 if(/解读|评论|研判|预测|猜想/.test(title))return {reason:'复杂解读或观点，需要人工审阅'};
 if(/申报|征集|征询|申请|招生|招募|学术会议|征文|论坛/.test(title)&&/科研|课题|研究项目|科技创新项目|博士|人才|英才计划|智库|学术|科学大会/.test(title))return {category:'opportunities',rule:'体育研究机会与明确征集动作'};
 if(/产业.*(报告|趋势|白皮书|统计)|发展报告/.test(title))return {category:'outlook',rule:'仅索引来源已发布的报告，不生成趋势结论'};
 if(/办法|条例|规划|政策|实施意见|指导意见|管理规定|标准|规范性文件/.test(title))return {category:'policy',rule:'体育制度或标准文件标题'};
 if(/人工智能|可穿戴|智能|数字化|数字体育|科技|运动数据/.test(title))return {category:'technology',rule:'体育技术主题'};
 if(/运动医学|生理|康复|体质|科学健身|运动科学|体育科普|运动训练/.test(title))return {category:'science',rule:'运动科学或科普主题，不扩写研究成果'};
 return {category:fallback,rule:'已核验体育栏目默认分类'};
}
export function canonicalUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('原文地址不安全');u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|from$|spm$)/.test(key))u.searchParams.delete(key);return u.href}
export const eventKey=title=>hash(clean(title).replace(/^(国家体育总局|体育总局)(办公厅)?/,'').replace(/[\p{P}\p{Z}\s]/gu,'').toLowerCase());
export function sameEvent(a,b){
 if(a.url===b.url||eventKey(a.title)===eventKey(b.title))return true;
 // 对不同表述只接受极高相似度，并同时限定数字与日期，避免把同主题当同事件。
 const norm=s=>clean(s).replace(/[\p{P}\p{Z}\s]/gu,'');const x=norm(a.title),y=norm(b.title);
 if(Math.min(x.length,y.length)<24||Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))>2*86400000)return false;
 if(JSON.stringify(x.match(/\d+/g))!==JSON.stringify(y.match(/\d+/g)))return false;
 const grams=s=>new Set(Array.from({length:Math.max(0,s.length-3)},(_,i)=>s.slice(i,i+4)));const g=grams(x),h=grams(y);const intersection=[...g].filter(k=>h.has(k)).length;
 return intersection/(g.size+h.size-intersection)>=.94;
}
export function mergeCandidates(existing,candidates){
 const articles=structuredClone(existing);let added=0,duplicates=0;
 for(const candidate of candidates){const found=articles.find(p=>sameEvent(p,candidate));if(found){duplicates++;const urls=new Set([found.url,...(found.alternateSources||[]).map(s=>s.url)]);if(!urls.has(candidate.url))found.alternateSources=[...(found.alternateSources||[]),{url:candidate.url,source:candidate.source,publishedAt:candidate.publishedAt}];continue}articles.push(candidate);added++}
 articles.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.slug.localeCompare(b.slug));return {articles,added,duplicates};
}
export function opportunityFields(text){
 const matches=[...text.matchAll(/(?:申报截止(?:日期|时间)|受理截止(?:日期|时间)|申请截止(?:日期|时间))\s*[：:为是]?\s*(20\d{2})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/g)];
 const dates=[...new Set(matches.map(m=>`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`))];
 const parsed=dates.length===1?new Date(dates[0]+'T00:00:00Z'):null;const valid=parsed&&Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===dates[0];
 return {deadline:valid?dates[0]:null,deadlinePrecision:valid?'day':null,eligibility:null,verificationNote:'仅当正文出现唯一明确的申报截止日期标签时记录；申报条件未人工核实，留空，以原文为准。'};
}
