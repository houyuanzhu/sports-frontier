export const informationTypes = {
 important:'重要体育资讯',
 index:'一般体育信息索引',
 paper:'科研论文书目',
 opportunity:'科研基金及申报机会'
};

export const priorityCriteria = {
 authority:'发布权威性',
 timing:'时效性',
 relevance:'体育相关性',
 use:'实际应用价值',
 event:'事件性质'
};

export function importantReview(post,review){
 if(post.demo||post.category==='opportunities'||post.doi||!review||review.url!==post.url||review.title!==post.title||!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedOn||''))return null;
 return Object.keys(priorityCriteria).every(key=>typeof review[key]==='string'&&review[key].trim())?review:null;
}

export function informationType(post,review){
 if(post.contentType==='research-index'&&post.doi)return 'paper';
 if(post.category==='opportunities')return 'opportunity';
 return importantReview(post,review)?'important':'index';
}

export function recentImportant(post,today){
 const days=(Date.parse(today)-Date.parse(post.publishedAt.slice(0,10)))/86400000;
 return post.informationType==='important'&&days>=0&&days<30;
}
