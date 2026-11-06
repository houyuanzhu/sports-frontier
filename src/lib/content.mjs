import articles from '../data/articles.json';
import site from '../data/site.json';
export {site};
export const posts = [...articles].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
export const categoryName = slug => site.categories.find(c=>c.slug===slug)?.name || '未分类';
export {dateText,monthKey} from './dates.mjs';
export const url = path => `${import.meta.env.BASE_URL.replace(/\/$/,'')}/${path.replace(/^\//,'')}`;
