import {createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function clean(value){return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim()}
export const beijingDay = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function publishedDate(raw,now=new Date(),timezone=null){
 const value=clean(raw);
 const match=/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(\+08:00)?)?$/.exec(value);
 if(!match)throw Error('日期格式或精度不受支持');
 const [,day,hour,minute,second,offset]=match;
 const calendar=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(+calendar)||calendar.toISOString().slice(0,10)!==day)throw Error('日期不合法');
 if(!hour){
  if(day>beijingDay(now))throw Error('来源日期晚于当前北京时间');
  return {publishedAt:day,datePrecision:'day',publicationTimezone:timezone,rawPublishedAt:value};
 }
 if(!offset&&timezone!=='Asia/Shanghai')throw Error('来源时间缺少已核验时区');
 if(+hour>23||+minute>59||(second!==undefined&&+second>59))throw Error('时刻不合法');
 const publishedAt=`${day}T${hour}:${minute}${second===undefined?'':`:${second}`}+08:00`;
 if(Date.parse(publishedAt)>+now)throw Error('来源日期晚于当前北京时间');
 return {publishedAt,datePrecision:second===undefined?'minute':'second',publicationTimezone:'Asia/Shanghai',rawPublishedAt:value};
}
export const opportunityLabels={call:'项目征集',proposal:'课题申报',talent:'人才计划',conference:'学术会议',recruitment:'科研招聘',history:'历史公示'};
export function opportunityKind(title){
 if(/立项名单|立项结果|拟立项|入选单位|评审结果|获资助/.test(title))return 'history';
 if(/招聘|招收/.test(title)&&/科研|博士后|研究助理|研究所/.test(title))return 'recruitment';
 if(/学术会议|学术论坛|科学大会|学术年会/.test(title))return 'conference';
 if(/人才计划|英才计划|博士后/.test(title))return 'talent';
 if(/申报|申请/.test(title))return 'proposal';
 return 'call';
}
export function classify(title,fallback,profile='legacy'){
 if(/党委|党组|纪委|党建|政治|政绩观|意识形态|廉政|主题教育|巡视|干部任免|预算|决算|获奖名单|拟授予|授予.*称号|批准.*裁判员|技术官员|参赛资格|人员名单|行政许可|备案统计表|采购|招标|中标/.test(title))return {reason:'非体育专业资讯或行政名单，跳过'};
 if(!/体育|运动|健身|赛事|奥运|足球|篮球|羽毛球|体质|滑雪|自行车|游泳|康复训练|省运|跆拳道|散打|跳水|速滑|匹克球|跆拳/.test(title))return {reason:'标题缺少明确体育相关性'};
 if(/解读|一图读懂|评论|研判|预测|猜想/.test(title))return {reason:'复杂解读或观点，需要人工审阅'};
 const research=/科研|课题|研究项目|科技创新项目|博士|人才|英才计划|智库|学术|科学大会/.test(title);
 if(research&&/申报|征集|征询|申请|招生|招募|学术会议|征文|论坛|招聘|招收|立项名单|立项结果|拟立项|入选单位|评审结果/.test(title)){
  if(/入选单位公示/.test(title))return {reason:'行政名单，跳过'};
  if(profile==='legacy'&&/立项名单|立项结果/.test(title)&&/科技创新/.test(title))return {category:'technology',rule:'已公开的体育科技立项信息'};
  return {category:'opportunities',kind:opportunityKind(title),rule:'体育研究活动及明确的申报、征集或结果文种'};
 }
 if(/招聘|公示|名单|结果公告/.test(title))return {reason:'非明确科研机会或个人名单，跳过'};
 if(/统计调查工作|报送.*统计|补助申报/.test(title))return {reason:'统计或补助办理通知，不作趋势研判或赛事新闻'};
 if(/产业.*(报告|白皮书|统计公报)|发展报告/.test(title)&&!/征集|编制|调研通知/.test(title))return {category:'outlook',rule:'仅索引来源已发布的报告，不生成趋势结论'};
 if(/办法|条例|规划|政策|实施方案|实施意见|指导意见|管理规定|标准|规范性文件/.test(title))return {category:'policy',rule:'体育制度或标准文件标题'};
 if(/人工智能|可穿戴|智能体育|数字化|数字体育|科技创新|运动数据/.test(title))return {category:'technology',rule:'官方体育技术方案、案例或工具索引'};
 if(/运动医学|生理|康复|体质|科学健身|运动科学|体育科普|运动训练/.test(title))return {category:'science',rule:'运动科学或科普主题，不扩写研究成果'};
 if(profile==='legacy'||(/开赛|开幕|收官|完赛|夺金|斩获|勇夺|赛事|竞赛规程|足球比赛|锦标赛|公开赛|运动会/.test(title)&&!/座谈|调研|动员|交流会/.test(title)))return {category:fallback,rule:profile==='legacy'?'已核验体育栏目默认分类':'官方体育赛事、赛果或竞赛通知'};
 return {reason:'缺少明确的专业栏目依据，留待人工核验'};
}
export function canonicalUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('原文地址不安全');u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|from$|spm$)/.test(key))u.searchParams.delete(key);return u.href}
export const eventKey=title=>hash(clean(title).replace(/^(国家体育总局|体育总局)(办公厅)?/,'').replace(/[\p{P}\p{Z}\s]/gu,'').toLowerCase());
export function sameEvent(a,b){
 if(canonicalUrl(a.url)===canonicalUrl(b.url))return true;
 if(a.doi||b.doi)return !!a.doi&&!!b.doi&&a.doi.toLowerCase()===b.doi.toLowerCase();
 const distance=Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
 if(!Number.isFinite(distance)||distance>2*86400000)return false;
 const aRegion=a.region,bRegion=b.region;
 if(aRegion&&bRegion&&aRegion!==bRegion)return false;
 if(a.category&&b.category&&a.category!==b.category)return false;
 if(eventKey(a.title)===eventKey(b.title))return true;
 // 对不同表述只接受极高相似度，并同时限定数字与日期，避免把同主题当同事件。
 const norm=s=>clean(s).replace(/[\p{P}\p{Z}\s]/gu,'');const x=norm(a.title),y=norm(b.title);
 if(Math.min(x.length,y.length)<24)return false;
 if(JSON.stringify(x.match(/\d+/g))!==JSON.stringify(y.match(/\d+/g)))return false;
 const grams=s=>new Set(Array.from({length:Math.max(0,s.length-3)},(_,i)=>s.slice(i,i+4)));const g=grams(x),h=grams(y);const intersection=[...g].filter(k=>h.has(k)).length;
 return intersection/(g.size+h.size-intersection)>=.94;
}
export function applyCorrection(post,change){
 if(!change)return post;
 const {action,date,note,verifiedDeadline}=change;
 const opportunity=verifiedDeadline&&post.category==='opportunities'?{...post.opportunity,deadline:verifiedDeadline,deadlinePrecision:'day'}:post.opportunity;
 return {...post,opportunity,editorial:{action,date,note}};
}
export function mergeCandidates(existing,candidates,corrections=[]){
 const articles=structuredClone(existing);let added=0,duplicates=0,held=0;
 const review=[];
 const normalized=post=>[canonicalUrl(post.url),...(post.alternateSources||[]).map(s=>canonicalUrl(s.url))];
 const changes=new Map(corrections.map(c=>[canonicalUrl(c.url),c]));
 for(const candidate of candidates){
  const key=canonicalUrl(candidate.url);
  if(changes.get(key)?.action==='withdraw'){held++;continue;}
  const found=articles.find(p=>normalized(p).includes(key)||sameEvent(p,candidate));
  if(found){
   duplicates++;
   if(normalized(found).includes(key)&&key===canonicalUrl(found.url)&&(found.title!==candidate.title||found.publishedAt!==candidate.publishedAt))review.push({url:key,slug:found.slug,reason:'原文标题或发布日期变更，保留原始记录待人工复核'});
   if(!normalized(found).includes(key))found.alternateSources=[...(found.alternateSources||[]),{url:candidate.url,source:candidate.source,sourceId:candidate.sourceId,publishedAt:candidate.publishedAt}];
   continue;
  }
  articles.push(candidate);added++;
 }
 const corrected=articles.map(post=>applyCorrection(post,changes.get(canonicalUrl(post.url))));
 corrected.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.slug.localeCompare(b.slug));
 return {articles:corrected,added,duplicates,held,review};
}
export function opportunityFields(text){
 const matches=[...text.matchAll(/(?:申报截止(?:日期|时间)|受理截止(?:日期|时间)|申请截止(?:日期|时间))\s*[：:为是]?\s*(20\d{2})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/g)];
 const dates=[...new Set(matches.map(m=>`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`))];
 const parsed=dates.length===1?new Date(dates[0]+'T00:00:00Z'):null;const valid=parsed&&Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===dates[0];
 return {deadline:valid?dates[0]:null,deadlinePrecision:valid?'day':null,eligibility:null,verificationNote:'仅当正文出现唯一明确的申报截止日期标签时记录；申报条件未人工核实，留空，以原文为准。'};
}
