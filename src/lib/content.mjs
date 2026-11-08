import articles from '../data/articles.json';
import site from '../data/site.json';
import corrections from '../../sources/corrections.json';
import editorial from '../../sources/editorial.json';
import {applyCorrection,canonicalUrl} from '../../scripts/ingest-core.mjs';
import {informationType,informationTypes,importantReview} from './information.mjs';
export {site,informationTypes};
export const contentTag = post => post.demo ? '演示' : informationTypes[post.informationType];
const changes=new Map(corrections.map(c=>[canonicalUrl(c.url),c]));
function present(post){
 const corrected=post.demo?post:applyCorrection(post,changes.get(canonicalUrl(post.url)));
 const review=editorial.important[post.slug];
 const type=informationType(corrected,review);
 const paper=editorial.papers[post.slug];
 const opportunity=editorial.opportunities[post.slug];
 const checkedOpportunity=type==='opportunity'&&opportunity?.url===post.url&&opportunity.reviewedOn;
 const verifiedFacts=checkedOpportunity?Object.fromEntries(['eligibility','funding','region','opensAt'].filter(key=>opportunity[key]).map(key=>[key,opportunity[key]])):{};
 return {
  ...corrected,
  informationType:type,
  priority:importantReview(corrected,review),
  paperNote:type==='paper'&&paper?.url===post.url&&paper.title===post.title&&paper.reviewedOn&&paper.reviewer?paper:null,
  opportunity:checkedOpportunity?{...corrected.opportunity,...verifiedFacts}:corrected.opportunity
 };
}
export const allPosts = articles.map(present).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
export const posts = allPosts.filter(post=>post.editorial?.action!=='withdraw');
export const categoryName = slug => site.categories.find(c=>c.slug===slug)?.name || '未分类';
export {dateText,monthKey} from './dates.mjs';
export const url = path => `${import.meta.env.BASE_URL.replace(/\/$/,'')}/${path.replace(/^\//,'')}`;
