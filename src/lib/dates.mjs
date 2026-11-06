export function dateText(value, time=false) {
 if (!value) return '尚无记录';
 const date=new Date(value);
 if (!Number.isFinite(date.getTime())) return '日期待核验';
 return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(date);
}
export function monthKey(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date(value));}
