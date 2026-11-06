# 中文公共资讯网站（演示工程）

使用 Astro 5、Tailwind CSS 4、静态 JSON 与 GitHub Pages。没有服务器、数据库、付费 API、外部字体、追踪或支付配置。名称“资讯样刊”、署名、全部栏目与文章均为演示。不要将演示内容当作真实新闻。`package-lock.json` 锁定版本。

## 当前交付与上线

当前已完成本地构建与测试，**尚未创建远程仓库、尚未上线**。GitHub 连接可识别账户，但未返回可访问仓库；本机无 GitHub 命令行凭据；浏览器自动化因无法核定当前网址被工具阻止。云端权限、Actions 和公开网址均待实际上线验证。详见同目录 `VALIDATION.md`。

Windows 最少操作（只需做一次）：

1. 若没有 GitHub CLI，执行 `winget install --id GitHub.cli --exact`，重新打开 PowerShell。Git 已安装。脚本无需本地 Node，构建在免费公开仓库的标准运行器进行。
2. 执行 `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`，按提示登录。凭据由官方 CLI 保管，禁止把 token 写入仓库。
3. 在源码目录执行 `powershell -ExecutionPolicy Bypass -File .\deploy.ps1`。默认新建公开仓库 `public-info-demo`，可用 `-RepositoryName 新仓库英文名` 更改。脚本会提交代码、配置 Pages 使用 GitHub Actions、手动触发首次运行、等待结果并请求公开页面。仅在全部成功后输出“部署成功”。现有同名远程仓库不会被覆盖。

免费地址由 GitHub 返回，形式为 `https://你的用户名.github.io/public-info-demo/`。不能把此示例地址当作已经上线的网址。脚本失败时可查看仓库 Actions 的中文步骤与日志；权限不足时，手动在仓库 Settings → Pages → Source 选择 GitHub Actions，再在 Actions 运行“网站检查与免费部署”。若账户或组织策略禁止公开仓库、Pages 或 Actions，需账户管理员处理。

## 本地运行

安装 Node.js 22（至少22.12）与自带 npm，执行：

```powershell
npm ci
npm run dev
```

本地默认使用 `/` 路径，canonical 使用不可访问的占位域名 `example.invalid`，避免误认部署。GitHub 上自动从 `GITHUB_REPOSITORY` 推导站点与仓库子路径。自定义部署可设置 `SITE_URL` 为站点源、`BASE_PATH` 为仓库子路径；根路径使用 `/`。无需购买域名。

## 修改名称、栏目与文章

- `src/data/site.json`：名称、描述、栏目、演示模式。正式数据准备完毕后，将 `demo` 改为 `false`，取消搜索引擎 noindex；同时清理页面中所有演示说明与演示署名。
- `src/data/articles.json`：文章 slug、标题、摘要、栏目、发布时间、正文段落。日期必须是带时区的 ISO 格式，如 `2026-11-05T09:00:00+08:00`；禁止仅填日期或缺少时区。
- `src/styles/global.css`：排版、颜色和响应式设计。使用系统中文字体，无外部字体下载；图形为本地 CSS 绘制，视觉不依赖远程资源。
- `src/pages/`：首页、文章列表、详情、分类、搜索、归档、关于、运行状态、404。导航在 Layout 中统一管理。

## 每天北京时间08:10的检查

`.github/workflows/pages.yml` 的 `10 0 * * *` 为 UTC 00:10，即北京时间08:10。支持 push、PR、定时和手动触发。GitHub 调度是尽力执行，繁忙时可能延迟或丢弃，不能保证准点。公共仓库60天没有活动时定时工作流可能被平台停用，需要在 Actions 中重新启用；请定期维护仓库，本站不以多余写权限或伪造文章掩盖平台限制。

当前来源列表为空：检查配置后显示“尚未接入内容源，无新增资讯”。`checkedAt` 表示系统执行检查的真实时间；`lastContentPublishedAt` 只表示真实已发布资讯时间，当前为 null。演示文章时间保持不变，候选内容不计作已发布。

适配器网络失败自动重试最多三次，失败后保留旧内容及发布时间，生成失败状态。检测失败仍尝试部署状态快照，最后 `check-result` 将任务标记为失败；构建或部署失败时网页保持旧版，不能反映最新故障，应查看 Actions。支持 Actions 页面 Re-run failed jobs（重新运行失败作业）或 Run workflow（运行工作流）。日志和报告保留7天。状态文件只在构建产物内改变，不提交到仓库；因此不申请 `contents: write`。

工作流顶级 `permissions: {}`；构建只读内容，deploy 仅有 Pages 写入与身份令牌权限，PR 不部署，不使用 `pull_request_target`，checkout 不保留凭据。标准公开仓库运行器免费；不使用大运行器、付费缓存或其他托管服务。后续升级依赖和 Actions 时应审阅来源与版本。

## 自动内容接入入口

1. 在 `scripts/adapters/` 编写免费公共 RSS 或公开数据适配器，导出 `async check({signal,previousPublishedAt})`，返回 `{candidates:[{id,title,url,publishedAt}]}`；在 `scripts/adapters/index.mjs` 显式登记。不得导入任意外部模块。
2. `sources/config.json` 添加 `{"adapter":"登记名称"}`，保持 `autoPublish: false`。当前不预选任何内容来源，也不请求任何付费 AI。
3. 适配器须支持中止、固定允许的 HTTPS 域名、限制体积、安全解析 XML（禁用外部实体）、处理错误和去重；核验来源授权、保留原文链接与明确时区。当前预留接口尚未做真实 RSS 集成验证。
4. 检测模块 `scripts/update-core.mjs` 只统计候选、不写文章，拒绝未来日期和无时区日期。真实内容的审阅、持久去重、内容清洗及发布事务需要接入时实现；**当前没有自动发布器**。开启自动发布必须另行实现审核和发布模块，不能只把 `autoPublish` 改为 true（会被脚本拒绝）。

## 测试与维护

```powershell
npm run verify
npx playwright install chromium
npm run test:browser
```

验证中文页面、全部内部链接、唯一主标题、SEO、日期跨月、空来源/失败重试/无新增/候选不发布、工作流权限，以及手机390px、平板768px、桌面1440px的导航、搜索、主题持久化和横向溢出。含键盘焦点、跳至正文、搜索状态播报、减少动效偏好、无脚本阅读兜底。无障碍功能并不等于完整合规认证。

项目子路径验证：设置 `GITHUB_REPOSITORY=你的用户名/仓库名`，再构建及运行测试。GitHub Actions 自动验证实际仓库子路径。404 使用绝对带子路径链接，避免嵌套路由错误。静态主页面每页限制100KB；没有做生产网络 Lighthouse 评分，不能宣称分数。

## 免费服务边界与参考

- [GitHub Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)：公开仓库可使用 GitHub Free 的 Pages。
- [GitHub Actions 计划事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)：队列延迟与公共仓库60天停用约束。
- [GitHub Actions 计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions)：标准运行器的公开仓库使用免费。
- [Tailwind CSS 与 Astro](https://tailwindcss.com/docs/installation/framework-guides/astro)：Vite 插件集成。

服务规则未来可能变化；不填写支付信息、不升级付费方案。静态网站不需要常驻进程，但平台可用性、带宽额度与计划任务仍受 GitHub 免费服务限制。
