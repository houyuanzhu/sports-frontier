# V4.1 七天云端观察

独立工作流为 `.github/workflows/observe-v41.yml`。观察 2026 年 11 月 10–16 日北京时间的 08:10 主任务与 11:37 备用任务，合计 14 个时段。11 月 10–17 日北京时间 20:23 为观察程序计划时间。17 日及之后的执行生成 `final-report.md`，此前生成 `daily-report.md`。GitHub 允许调度延迟，程序以实际北京时间选用日报或汇总。GitHub cron 不含年份，工作流日期门禁使以后年份的自然触发直接跳过；本轮迟到触发宽限至 11 月 24 日。 [GitHub 定时事件说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

观察任务使用公开仓库标准 GitHub 运行器，仅需 `contents: read` 与 `actions: read`。它通过 GitHub API 和现有工件读取原采集工作流的 `schedule` 事件，保留创建、启动、结束、延迟、补检、候选重复、跳过、发布核验和实际新增。原采集任务、数据分支与 Pages 均独立运行。 [GitHub Actions 计费说明](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 查看和补查

1. 到仓库 Actions 打开「V4.1 七天定时运行观察」，查看对应运行的摘要和 `v41-schedule-observation` 工件。工件含 Markdown 和 `evidence.json`，保留 60 天。 [下载工件说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
2. 漏检或待核实时，在**观察工作流**选择 Run workflow，或执行 `gh workflow run observe-v41.yml -R houyuanzhu/sports-frontier`。手动观察也会重查全部 14 个时段和迟到运行，合并上一轮已保留的证据。手动观察本身不进入采集统计。
3. 用真实运行 ID 合并同一触发。不同尝试保留已采集的先前证据。失效或缺失的采集工件不得补写为 0。没有可信定时工件时，真实事件单列为未归属，不能单凭时刻硬分主、备。采集工件若在首次成功归档前过期，证据可能无法恢复。
4. 11 月 17 日后补查会生成较新的汇总。以最新成功观察运行的工件为准。
