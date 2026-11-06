# 政视体育 · V3.0

洞察体育发展，追踪科技与科研前沿。

公开网站：https://houyuanzhu.github.io/sports-frontier/

沿用V2的Astro、Tailwind CSS、六栏目、搜索、归档、响应式与Pages架构。全部必要服务为免费公开GitHub仓库、标准Actions运行器与github.io子域名，无收费API、模型、数据库或服务器。

## 当前真实运行状态

已完成三阶段试采集与真实数据检查，启用**只发布标题、来源、日期、链接等事实字段的官方信息索引**，不生成新闻正文、政策解读、科研结论或趋势预测。首轮云端运行42190527362采集新增6条，写入content-data分支并部署成功。原文日期为2026年5月至10月；这是首次收录历史公开信息，不宣称这些文件今天发布。

V2演示数据已从公开页面移除，源码档案在archive/demo-articles-v2.json，不生成公开路由。site.demo=false，独立noindex=true仍保留；真实索引技术上线不等于全部站点合规事项或搜索引擎收录已完成。

目前6条内容分为体育政策3条、科研机会3条。其余四栏目没有合格内容时保留空栏目说明，绝不填充假新闻。机会的有效性、资格条件与截止时间无法核实时留空，并提示以官方原文为准。

## 真实来源

| 正在检查的入口 | 本轮实际结果与边界 |
| --- | --- |
| 国家体育总局·通知公告 | 列表200，2条合格；一个详情403后停止该来源余下请求。仅已验证的官方主体元数据 |
| 上海市体育局·政策法规 | 列表与详情200，4条合格；保留官方公开页面日期，不从URL或印发时间推断 |
| 上海市体育局·公告通知 | 列表与详情200；本批均为名单/行政许可等，过滤后0条 |

这是两个官方门户的三个栏目入口，并非三个独立媒体。四个返回403的总局栏目已停用。未发现这三个入口的RSS；使用公开HTML元数据，不声称具有专有开放API。访问前检查robots、限速、校验HTTPS允许主机；不绕过登录、403或其他限制。

公开来源的可访问性不是全文转载许可。本项目不转载正文、图片、附件；保留原公开主体和链接。总局使用规则依据公开答复，上海仅做官方政府信息公开元数据链接索引。详见SOURCE-AUDIT.md和网站“来源与规则”。

## 日常自动化

每天北京时间08:10（UTC 10 0 * * *）在GitHub Actions运行，本机和Codex关闭不影响云端任务。支持手动update与rollback。首次schedule事件是否已经发生，见运行报告，不能把push或手动运行当成定时触发。

build只读内容：恢复content-data历史 → 真实采集与单源故障隔离 → 日期/主题/分类/去重 → 测试构建与浏览器检查。persist单独使用contents:write，将验证后的快照原子保存到content-data。deploy只使用pages:write和id-token:write，存储成功后部署并检查代码SHA、内容摘要及公开页面。

历史保存在Git分支，不依赖临时artifact。content-data不触发main的代码工作流，避免循环提交。没有新增时不造文章；检查状态本身可保存一个真实快照，同一包重试不重复提交。来源错误保留旧数据，所有来源失败最终标红；部分失败不阻止其他合格内容。

平台调度可能延迟；长期无仓库活动可能停用计划任务，需定期维护。所有日期与时间均保留实际来源精度。未来服务规则变化应重新审查，不填写支付信息或升级付费方案。

## 本地运行

安装Node22.12或更新的受支持Node版本与自带npm。Git仓库检出后：

    npm ci
    npm run content:restore
    npm run dev

main只保存代码，src/data/articles.json为空占位；真实历史在content-data，构建和运行前先恢复。压缩交付包额外附有已校验的数据快照，可离线恢复；详见交付清单。不要把自动生成数据提交回main。

    npm run collect

以上为真实试采集，不发布。正式发布的三重门禁为phase=3、autoPublish=true、publicationGate=metadata-reviewed；只在已审查的来源范围内启用。不要为凑齐栏目扩大未知来源白名单。

    npm run verify
    npx playwright install chromium
    npm run test:browser

测试fixture为本轮实际抓取的官方元数据，附原文URL和响应哈希；纯函数测试不代替真实连通性与云端运行验收。存储测试使用真实本地Git仓库验证事务，不伪造外部资讯。

## 配置与维护入口

- src/data/site.json：名称、副标题、六栏目、noindex。
- sources/registry.json：启用/停用来源；sources/policy.json：域名、署名、速率、时间窗口及元数据边界。
- scripts/adapters/sport-html.mjs：政府公开元数据解析；scripts/source-client.mjs：请求与访问规则。
- scripts/ingest-core.mjs：标题分类、日精度校验、保守事件去重、机会空字段。
- scripts/content-state.mjs：读取、原子保存、幂等与历史回滚。
- V3-OPERATIONS.md：详细流程、权限、失败处理及手动回滚方法。

真实跨语言/大幅改写事件的语义去重、论文质量评审、复杂资格/附件解析、自动撤回及人工纠错审批仍需后续完善。当前不会因此扩写原创结论或擅自填写未知字段。
