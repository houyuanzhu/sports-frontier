# V3 自动化运行手册

当前采用分阶段门禁。`sources/config.json` 的 phase=1 表示只试采集首批三个入口，autoPublish=false 不发布候选。phase=2增加两个入口；只有实际来源核验、数据和构建测试通过后才允许 phase=3、autoPublish=true、publicationGate=metadata-reviewed。不能只修改autoPublish一个字段。

## 真实来源与使用规则

已登记国家体育总局通知公告、地方动态、科教司体育科技、科教司通知公告和科教司体育科普，共五个栏目入口，属于同一门户，并非五个独立媒体。采用公开HTML中的ArticleTitle、PubDate、ContentSource元数据，未发现RSS，不宣称存在专有开放API。

只保留原始标题、原公开主体、发布日期、原文链接与事实字段，摘要由固定模板生成，不搬运原文段落、图片、附件。总局公开答复要求标明原公开主体；该答复不等于所有内容均获开放许可，转载媒体内容及未知主体会跳过。

权利依据：https://www.sport.gov.cn/n323/n10459/c24206655/content.html

robots.txt本地实测返回404，表示未发现robots规则，不表示获得版权许可；每次运行仍重新检查。403立即触发该来源本轮熔断，不换身份、代理或其他路径绕过。未知访问失败、结构变化、缺少日期或主体会写日志。

体育科学研究所列表返回403、基金委连接失败，未接入。上海体育局列表可访问但使用规则未充分确认。Crossref、OpenAlex等元数据接口可访问，但中文结果的来源/学术质量尚未通过筛选，不将其检索结果当作已核实重要成果自动发布。

## 检测与存储

- `npm run collect`：真实试采集，仅保存reports中的候选和检查状态，不写文章。
- `npm run collect:publish`：必须通过三项门禁才写真实索引与待验证快照。
- `sources/registry.json`：真实入口；`sources/policy.json`：允许主机、权利边界、速率、时间窗口与发布主体规则。
- `scripts/source-client.mjs`：HTTPS允许列表、重定向校验、robots规则、体积/超时限制、限速、三次网络重试与403单源熔断。
- `scripts/ingest-core.mjs`：体育相关性、六栏目规则、保守跨来源去重、日期精度与机会空字段处理。
- `reports/collection.json`：真实采集结果、跳过原因、请求与重试次数。单个来源故障不停止其他来源；被拒绝的URL不会再次请求；独立栏目仍分别检查，不改路径获取被拒绝内容。

原文只给日期时保存YYYY-MM-DD、datePrecision=day、publicationTimezone=Asia/Shanghai，不补造00:00为发布时间。采集时间使用独立collectedAt。科研机会无唯一明确截止日期时保留null，申报条件未核实时保留null，不从公示期/落款日期推断截止时间。

同原文URL、规范化标题与极高相似且同数字/近日期的条目保守归为同事件。宁可保留两个不同事件，也不使用宽泛相似度吞掉历史资讯；模糊跨语言或改写报道的语义去重尚不保证。历史保存在content-data分支的articles.json、state.json、status.json、manifest.json中，正文不依赖运行器缓存或临时artifact长期保留。

## GitHub Actions与最小权限

每天UTC 00:10即北京时间08:10，支持手动update或rollback。云端运行无需本机/Codex在线。平台排队可能延迟，60天无仓库活动可能停用定时任务。

1. build仅contents:read。正式模式先从content-data恢复历史，恢复失败停止，禁止用空数据覆盖历史。采集、去重、单元/构建/浏览器检查通过后上传验证后的快照与Pages产物。
2. persist单独申请contents:write，仅写content-data分支，验证源提交与父数据版本。使用提交树和普通快进推送，拒绝并发覆盖；完全相同的树不重复提交。每次真实检查状态发生变化可产生状态快照，不为无新增内容制造文章提交。
3. deploy只有pages:write和id-token:write。数据持久化成功后才部署；构建/存储失败保持旧站点。核验公开页面、稳定站点标识、代码SHA和内容摘要一致。
4. 最终检查保留“所有来源失败”的失败信号；部分来源失败可继续发布其他来源的合格内容。日志和报告保留7天，待验证内容artifact保留2天。

main代码分支触发push，content-data不触发该工作流，且Actions内置GITHUB_TOKEN提交不再引发代码工作流，避免循环。PR只读试采集和测试，不持久化、不部署。token只进入persist作业环境的官方gh凭据助手，不写文件、Git配置或命令参数。

首次真实发布前，将V2演示文件保留于archive/demo-articles-v2.json，公开文章数组由真实索引替换，site.demo=false。演示档案不生成公开路由。noindex是独立字段，真实发布也保持true，待内容与站点其他合规事项确认后另行调整。

## 发布失败与回滚

Pages部署失败时旧站点继续可访问，已提交的内容快照仍保留，下一次运行恢复后可再次部署。内容最近日期只代表来源发布日期，不假称精确的网站发布时间。

手动回滚入口：Actions → 网站检查与免费部署 → Run workflow → mode=rollback，并填写content-data历史提交的完整40位SHA。只允许该数据分支的祖先提交。系统恢复旧数据、跳过抓取，通过相同测试后以新快照提交保存并重新部署，不重写历史。选取已成功部署的历史数据版本；首次发布前没有可回滚的正式数据。脚本实现是否完成实跑以本轮检查报告为准。

本地恢复线上内容：在源码仓库执行 `npm run content:restore`。这只读远程数据分支并写本地数据文件；不要把恢复出的生成数据随手提交回main。源码压缩包与数据快照可分别备份。

## 运行验收

测试中的离线元数据fixture来自本轮实际HTTP抓取，附原文URL和原响应哈希；它们验证纯函数，不代替外部连通性验收。网络403、空结果和来源质量问题必须如实报告，不通过伪造资讯或降低门禁来凑足内容。

依次执行npm ci、npm run verify、npm run test:browser。真实新条目、历史恢复、空新增、故障隔离、回滚、公开网址和云端schedule实际触发必须分别记录。手动运行成功不等于定时触发已经发生。
