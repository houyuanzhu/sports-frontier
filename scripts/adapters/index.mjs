// 插件必须只检测，不得写入文章。显式登记模块，禁止动态导入外部URL。
export const adapters = Object.freeze({});
// 未来示例：import {check} from './public-rss.mjs'; adapters 中登记 publicRss: check
// 接口 async check({signal, previousPublishedAt}) => { candidates: [{id, title, url, publishedAt}] }
// 仅添加经维护者选择的免费公开来源。必须限制域名、响应体大小、超时并安全解析XML。
