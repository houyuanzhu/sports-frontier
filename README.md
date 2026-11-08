# 政视体育 · V3.1

[公开网站](https://houyuanzhu.github.io/sports-frontier/) · [信源与使用规则](https://houyuanzhu.github.io/sports-frontier/sources/) · [运行状态](https://houyuanzhu.github.io/sports-frontier/status/)

沿用 Astro、Tailwind CSS、六栏目、搜索、归档、响应式设计和免费 GitHub Pages。V3.1 在国家体育总局和上海原入口基础上，增加北京、福建、厦门政府公开信息及两种 Crossref 期刊书目。以真实原文日期排序，保存首次收录时间。期刊记录保留英文原题，栏目依据为经过审核的期刊范围，书目不代表成果评级。

## 自动化与维护

- 主计划为北京时间 08:10，备用检查为 11:37。两者均使用 GitHub Actions，平台可能延迟。同日公开健康接口已有正常状态时跳过重复工作。主检查部分失败时允许备用再检查；备用已部署部分成功结果后，同日计划运行直接跳过。手动运行始终可执行。
- 单源故障隔离、robots 规则、HTTPS 域名、同源跳转和路径校验。仅访问审核过的入口；遇到 403 不绕过。政府列表按公开分页与来源配置设上限，非置顶新条目优先。实际详情中的原文发布时间和站点身份才作为发布依据。
- 工作流恢复 `content-data` 分支历史后采集、测试，先保存快照再部署。相同候选包幂等，数据分支更新不会触发发布循环。全源失败留档并标记失败，无合格新增时只刷新状态。
- 主要来源、可用性、事实字段及规则在 `sources/registry.json` 和网站信源页。变更入口前先核实访问权、发布时间字段、域名、原公开主体和版权。Crossref 仅用书目事实。政府入口仅用标题、原公开主体、公开日期和原文链接。
- `sources/corrections.json` 支持人工复核后的 `notice` 与 `withdraw`。记录 `url`、`sourceId`、`date`（北京时间日历日期）、`action` 和公开 `note`，通过 Git 变更留痕。撤回保留不含原题和原摘要的说明页，且从栏目、列表、归档和搜索排除。复核同一原文的标题或日期变化看采集报告 `review`。联系入口位于关于页。
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
