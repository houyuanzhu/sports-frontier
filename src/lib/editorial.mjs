export const trendTopics={
 'ai-sports':'AI+体育',
 'wearables':'智能可穿戴',
 'exercise-health':'运动健康',
 'fitness':'全民健身',
 'industry':'体育产业',
 'event-economy':'赛事经济',
 'training-tech':'运动训练科技'
};

const text=value=>typeof value==='string'&&value.trim().length>0;
const slug=value=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value||'');
function day(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
function https(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port;}catch{return false;}
}

export function signed(review,today){
 return review?.state==='signed'&&text(review.editor)&&day(review.signedOn)&&review.signedOn<=today;
}

export function signedPaper(post,note,today){
 if(!note||note.state!=='signed')return null;
 if(!post.doi||post.contentType!=='research-index'||post.title!==note.title||post.url!==note.url||!signed(note,today)||
  note.fullTextChecked!==true||!https(note.fullTextUrl)||!['chineseTitle','design','findings','limitations','significance'].every(key=>text(note[key])))throw Error('已签发论文解读缺少原文、全文核验或研究说明 '+post.slug);
 return note;
}

export function signedTrends(entries,today){
 const seen=new Set();
 return entries.filter(entry=>{
  if(entry.state!=='signed')return false;
  const {sources,claims}=entry;
  if(!slug(entry.slug)||seen.has(entry.slug)||!Object.hasOwn(trendTopics,entry.topic)||!signed(entry,today)||
   !text(entry.title)||!text(entry.summary)||!text(entry.author)||!day(entry.materialThrough)||entry.materialThrough>entry.signedOn||
   !Array.isArray(sources)||sources.length<2||!sources.every(s=>slug(s.id)&&https(s.url)&&day(s.date)&&s.date<=entry.materialThrough&&text(s.label))||
   new Set(sources.map(s=>s.url)).size!==sources.length||new Set(sources.map(s=>s.id)).size!==sources.length||
   !Array.isArray(claims)||!claims.length||!claims.every(c=>text(c.text)&&Array.isArray(c.evidence)&&c.evidence.length&&c.evidence.every(id=>sources.some(s=>s.id===id))))throw Error('已签发专题缺少有效证据 '+entry.slug);
  seen.add(entry.slug);
  return true;
 }).sort((a,b)=>b.signedOn.localeCompare(a.signedOn));
}
