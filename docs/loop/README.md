# 设计迭代循环 · 记录

本目录由自动化循环（每 30 分钟一轮）写入，便于逐轮回溯。

- `cycle-NN.md`：每一轮的假设、三智能体发现、采纳的改动、测试结果、可视化结论、下一轮假设。
- `state.json`：当前轮次与下一轮假设。
- `health-NN.md`：验证 / 可视化反馈循环的输出。
- `shots/`：浏览器截图（realm-road / realm-inner / realm-interactive）。
- `last-smoke.json`：最近一次交互级冒烟的结构化结果。

## 验证方式（真实浏览器，非仅截图）
两个自动化都用 `scripts/smoke-interaction.mjs` 驱动已缓存的无头 Chrome
（`puppeteer-core`，仅装在管理 node workspace，不影响站点零依赖规则），
**真实点击**三界 pills、展开星思、提交星屑，并扫描控制台 / 页面错误。
- 设计迭代自动化（A）：每轮改动后跑 `node --test` + `validate-content` + 交互冒烟，全绿才提交。
- 可视化校验自动化（B）：每 30 分钟（错峰 15 分钟）复跑交互冒烟，产出 `health-NN.md`。
注意：静态服务须用**线程化** `ThreadingHTTPServer`，单线程 `http.server` 会因并行模块请求死锁。

## 回滚
每一轮都是一次 git 提交，位于 `auto/design-loop` 分支。
查看历史：`git log auto/design-loop`
定位某轮：`git show <sha>` 或 `git checkout <sha>`
回退某轮：`git revert <sha>`
确认无误后合并到 `main` 上线。

## 暂停
在 WorkBuddy 设置中停用对应自动化即可停止循环。
