# 政视体育 · V4.0

[公开网站](https://houyuanzhu.github.io/sports-frontier/) · [信源与使用规则](https://houyuanzhu.github.io/sports-frontier/sources/) · [运行状态](https://houyuanzhu.github.io/sports-frontier/status/)

沿用 Astro、Tailwind CSS、六栏目、搜索、归档、响应式设计和免费 GitHub Pages。V4.0 保留 V3.2 的 11 个信源入口和历史快照，并增加每日情报、科研精选、体育风口观察与公开审核更正页。以真实原文日期排序，保存首次收录时间。期刊记录保留英文原题，栏目依据为经过审核的期刊范围，书目不代表成果评级。

## 自动化与维护

- 主计划为北京时间 08:10，备用检查为 11:37。两者均使用 GitHub Actions，平台可能延迟。同日公开健康接口已有正常状态时跳过重复工作。同日已有部分成功的公开快照时也跳过第二次计划采集。没有可验证的公开快照、全失败或回滚时允许备用。手动运行始终可执行。
- 单源故障隔离、robots 规则、HTTPS 域名、同源跳转和路径校验。仅访问审核过的入口；遇到 403 不绕过。政府列表按公开分页与来源配置设上限，非置顶新条目优先。实际详情中的原文发布时间和站点身份才作为发布依据。
- 工作流恢复 `content-data` 分支历史后采集、测试，先保存快照再部署。相同候选包幂等，数据分支更新不会触发发布循环。全源失败留档并标记失败，无合格新增时只刷新状态。
- 主要来源、可用性、事实字段及规则在 `sources/registry.json` 和网站信源页。变更入口前先核实访问权、发布时间字段、域名、原公开主体和版权。Crossref 仅用书目事实。政府入口仅用标题、原公开主体、公开日期和原文链接。
- `sources/corrections.json` 支持人工复核后的 `notice` 与 `withdraw`。记录 `url`、`sourceId`、`date`（北京时间日历日期）、`action` 和公开 `note`，通过 Git 变更留痕。对原文已人工核验的历史截止日期，可用 `verifiedDeadline` 补录并说明对应环节。撤回保留不含原题和原摘要的说明页，且从栏目、列表、归档和搜索排除。复核同一原文的标题或日期变化看采集报告 `review`。联系入口位于关于页。
- 定时事件的计划、触发、执行、发布与失败可以用 `node scripts/run-timing.mjs RUN_ID@08:10` 查询，备用使用 `@11:37`，手动运行仅填 ID。可设置 `GH_BIN` 选择本地已授权的官方 GitHub CLI。
- `site.noindex=true`。解除前由站点运营者完成公开信息使用条件、适用许可、联系更正及个人信息审核。V2 演示数据只在 `archive/demo-articles-v2.json` 留档。

## 本地验证

安装 Node 22.12 或更新的受支持版本。检出仓库后执行：

```sh
npm ci
npm run content:restore
npm run verify
npx playwright install chromium
npm run test:browser
npm run dev
```

`main` 只保存代码，真实历史来自 `content-data`。交付压缩包可用随附快照离线构建。运行 `npm run collect` 做真实试采集，候选与失败原因写入 `reports/`。使用 `SOURCE_ID` 可定点检查单源，单源模式不会正式发布。恢复旧快照的方法见 [V3 运行手册](V3-OPERATIONS.md)。

科研机会缺少可信截止日期时显示待核实，过期项与历史公示继续留档。历史政策按原文日期展示，效力以官方原文为准。跨语言和重写幅度大的报道仍需人工去重。

## V3.2 信息分层与抽查

四类信息与六大栏目独立。重要性复核、论文人工导读和科研机会事实录入使用 `sources/editorial.json`。未来新增内容每轮每来源最多抽一条进 `status.auditQueue`，人工决策填入 `sources/quality-reviews.json`。来源完整成功率使用最近最多 30 次采集，不计跳过和回滚。细节见 [V3.2 内容分层与重要性规则](V32-QUALITY.md)。

## V4.0 每日情报与签发

每日情报按北京时间首次收录日归档。采集运行时间和原文发布日期分别展示。重要资讯、精选论文解读与原创专题使用 Git 中的编辑签发记录。详见 [V4.0 编辑操作说明](V40-EDITORIAL.md)。
