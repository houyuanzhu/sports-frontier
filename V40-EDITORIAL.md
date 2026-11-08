# V4.0 编辑操作说明

网站自动发布已核验的官方记录和期刊书目。编辑手工录入的内容与采集分支独立，由 Git 记录变更和签发。编辑配置在 `main`，采集快照在 `content-data`。GitHub 公开仓库的草稿源文件也可被访问。涉及未公开资料的草稿请留在本地，确认可公开后再提交。

## 每日情报

`/daily/` 为归档目录，`/daily/YYYY-MM-DD/` 为单期。按记录的 `firstIndexedAt` 转为北京时间日历日归档。条目仍以 `publishedAt` 展示原文日期和精度。同日重跑不复制一期，也不复制已收录文章。某次检查无新增时，显示本轮暂无新增，同时保留当日先前收录。未取得任何可核验新记录的检查日显示空态。采集失败与没有新增分别展示。定时跳过只见于 Actions 日志，保留公开快照。回滚保留已发生的检查记录，只用恢复后的文章集合生成每日情报。

每条包含原题、来源、原文日期、类型、事实说明和原文链接。没有手工事实说明时，只用已核验的来源字段、分类或题录元数据生成固定说明。对需要原文语义的字段不从标题推断。补充事实时，在 `sources/editorial.json` 的 `facts` 以文章 slug 为键，写入 `url`、`title`、`text`、`checkedOn`。标题和链接须与已存档记录完全一致。数值注明单位、适用条件和事实性质，例如政策目标、补助上限或申报日期。

## 重要资讯和签发

在 `sources/editorial.json` 的 `important` 保留条目原题、原文 URL、复核日期和五项依据。五项为 `authority` 发布权威性、`timing` 时效性、`relevance` 体育相关性、`use` 实际应用价值、`event` 事件性质。只有值班编辑核对原文及表述后才填写 `state: "signed"`、`editor` 和 `signedOn`。公开页展示签发人、签发日和复核依据。未签发条目可保留历史复核标记，首页重点和每日已签发分组只收签发条目。首页重点另外检查原文日期近 30 天。

## 论文精选

在 `sources/editorial.json` 的 `papers` 以原书目 slug 为键。用 `title`、`url` 绑定现有英文原题和 DOI 链接。阅读原论文全文、核验许可后填写 `fullTextUrl`、`fullTextChecked: true`，再写 `chineseTitle` 中文题名、`design` 研究设计、`findings` 主要发现、`limitations` 局限性、`significance` 专业意义。发布还需 `state: "signed"`、`editor`、`signedOn`。任何一项缺失，构建会拒绝已签发配置。保留英文原标题、期刊、出版日期和 DOI。只有普通题录时请留空，不从题名猜研究结论或训练建议。

## 体育风口观察

在 `sources/trends.json` 的数组录入专题。必要字段为 `slug`、`topic`、`title`、`summary`、`author`、`materialThrough`、`sources`、`claims`。专题方向为 `ai-sports`、`wearables`、`exercise-health`、`fitness`、`industry`、`event-economy`、`training-tech`。每条来源写入唯一 `id`、`label`、原始 HTTPS `url` 和资料日期 `date`，至少两条不同原始来源。分析项写入 `text` 与所引用的 `evidence` 来源 ID 数组。注明范围、适用条件和证据局限。审阅每条分析及证据后，才填写 `state: "signed"`、`editor`、`signedOn`。只渲染签发条目，正文采用普通文本，原始资料链接可追溯。

## 质量、公开更正与发布

- 复核抽查从 `status.auditQueue` 开始。对应的 `sources/quality-reviews.json` 条目用 `correct` 记录栏目是否正确，用 `recordCorrect` 记录已发布标题、来源、日期、链接及栏目整体是否正确。只有完成核验才填布尔值。
- 候选排除率分母为可判定候选，包含通过与被编辑排除、日期或必填字段无效的详情。未访问和纯网络故障不计入。重复候选比例分母为通过采集门槛的候选。已发布记录错误率分母为实际完成记录核验的已发布样本。
- 更正与撤回写入 `sources/corrections.json`。保留旧地址上的更正或撤回说明，撤回会从首页、搜索和每日情报隐藏。公众可从 `/editorial/` 提交公开更正，敏感事项需由运营方另行提供非公开渠道。
- 在本地运行 `npm ci`、`npm run content:restore` 和 `npm run verify`，再核对预览。正式提交后按现有免费 Pages 工作流测试、持久化和部署。保持 `src/data/site.json` 的 `noindex: true`，待运营方完成来源授权范围、主体及适用事项核验后再另行决定。
