# 政视体育 · V2.0

洞察体育发展，追踪科技与科研前沿。

在既有 public-info-site 工程上定点升级，沿用 Astro 5.18.2、Tailwind CSS 4、GitHub Pages 与 GitHub Actions，未更换框架或部署系统。仅使用免费公开仓库、标准运行器及 github.io 子域名，不配置支付方式、收费接口或自建服务器。

## 内容与栏目

当前全部8篇文章是明确标注的演示内容，不是真实新闻、政策、研究成果或基金公告。名称暂定为“政视体育”。没有抓取真实资讯或调用AI写稿。演示模式启用，所有HTML带有 noindex, follow，不宣称已获搜索引擎收录。

| 栏目 | 路由 |
| --- | --- |
| 体育头条 | /categories/headlines/ |
| 体育政策 | /categories/policy/ |
| 体育科技 | /categories/technology/ |
| 运动科学 | /categories/science/ |
| 科研机会 | /categories/opportunities/ |
| 趋势研判 | /categories/outlook/ |

以体育为中心，向体育政策、科技、科研与产业延伸。不设置综合政治新闻栏目，不发布政治人物动态、政治关系研判与未经核实的政治传闻。全部旧栏目引用已从应用中移除，旧演示文章由新的体育演示数据替换。

## 配置入口

- src/data/site.json：名称、副标题、六栏目、稳定站点标识和demo开关。
- src/data/articles.json：演示文章、摘要、所属栏目与带时区的发布时间。归档使用北京时间；系统检查不会修改文章日期。
- src/styles/global.css：保留的基础排版；src/styles/sports.css：V2体育品牌与响应式样式。
- src/pages/：首页、列表、文章、栏目、搜索、归档、关于、运行状态与404。
- sources/config.json 与 scripts/adapters/：未来真实内容检测入口。

搜索支持关键词、中文栏目、筛选、建议词、清空及URL保存查询条件，全部在浏览器本地执行。主题偏好只保存在本机，支持浅色、深色、键盘跳转、减少动效偏好和无脚本阅读。无外部字体、追踪脚本和远程图片依赖。

## 本地运行与检查

安装Node.js 22.12或以上受支持版本及自带npm：

    npm ci
    npm run dev

完整验证：

    npm run build
    npm test
    node scripts/verify-build.mjs
    npx playwright install chromium
    npm run test:browser

或者 npm run verify 执行单元、构建和静态检查。浏览器测试覆盖390px手机、768px平板、1440px桌面。CI额外测试实际仓库子路径。Node24本地也已验证；云端固定Node22。锁文件与依赖版本均保留，无框架迁移。

本地默认根路径、canonical占位域名example.invalid；云端从GITHUB_REPOSITORY推导 https://用户名.github.io/仓库名/，也可显式设置SITE_URL和BASE_PATH。health.json提供稳定siteId、版本和buildCommit；本地buildCommit为local，云端为实际GITHUB_SHA。

## 首次免费上线

优先复用 deploy.ps1。在源码目录完成GitHub CLI浏览器授权后执行：

    gh auth login --hostname github.com --git-protocol https --web --scopes workflow
    powershell -ExecutionPolicy Bypass -File ./deploy.ps1

默认创建公开仓库sports-frontier。若无origin且同名仓库已存在，明确报告冲突并尝试sports-frontier-v2等替代名，不覆盖已有仓库。已有origin时校验其目标与指定名称一致。可以用 -RepositoryName 指定名称。

脚本检查未提交变更、提交代码、推送、启用Pages自定义Actions构建、触发工作流并等待对应提交。最终同时验证首页HTTP响应、zh-CN、稳定site-id、health.json的schemaVersion与本次提交SHA；不依赖品牌名或“演示”字样判断成功。工作流使用相同标准检查。浏览器登录及授权需本人完成，不发送或提交令牌、密码、私人数据。已安装的官方CLI将凭据保存在系统密钥环。

部署与定时任务的实际运行结果见 VALIDATION.md，不把手动运行当作定时触发记录。日常推送main会自动测试部署；PR仅测试。

## 每天北京时间08:10

.github/workflows/pages.yml的cron为UTC 10 0 * * *，即每天北京时间08:10。支持手动运行、最多三次适配器重试、日志、7天报告留存和最终状态检查。

autoPublish始终为false，sources为空。当前检查只确认配置并记录真实checkedAt，newCount为0，lastContentPublishedAt保持null。系统检查成功不是资讯更新；演示时间不计入真实资讯发布。来源检查失败时尝试部署失败状态快照，最终作业仍标为失败。构建或部署失败则网页保留旧版，以Actions日志为准。

顶级permissions为空；build只有contents:read，deploy只有pages:write和id-token:write；checkout不保留凭据；不使用pull_request_target，不向工作流注入用户令牌。Actions仅使用公开仓库标准免费运行器。

GitHub调度可能排队或延迟；公共仓库60天无活动可能停用计划任务，需要定期维护、必要时在Actions重新启用。静态网站无需常驻进程，但第三方可用性与免费额度不由本项目保证。

## 后续接入真实体育资讯

1. 选定并核验免费RSS、官方公告、公开科研数据源，明确转载/引用权限和栏目规则；当前未预选实际来源。
2. 在scripts/adapters/实现带中止信号、超时、固定HTTPS域名、响应体限制和安全XML解析的适配器，在index.mjs显式登记，在sources/config.json启用。返回candidates数组，每条含id、title、url、带时区publishedAt。
3. 补齐来源链接、原文与内容类型、研究/政策版本状态、机会截止时间核验、持久去重、内容清洗、人工审阅、更正与撤回、发布事务及失败恢复。
4. 检测器目前只统计候选，不写文章、不自动发布；autoPublish=true会被拒绝。必须实现并验证发布器后才讨论开启自动发布。真实内容准备完毕后统一替换演示数据、标签与署名，再取消noindex。

## 官方参考

- [GitHub Pages发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub CLI登录](https://cli.github.com/manual/gh_auth_login)
- [GitHub Pages REST接口](https://docs.github.com/en/rest/pages/pages)
- [公共仓库定时工作流停用规则](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
