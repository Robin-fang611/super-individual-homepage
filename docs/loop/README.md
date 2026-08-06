# 设计迭代循环 · 记录

本目录由自动化循环（每 30 分钟一轮）写入，便于逐轮回溯。

- `cycle-NN.md`：每一轮的假设、三智能体发现、采纳的改动、测试结果、可视化结论、下一轮假设。
- `state.json`：当前轮次与下一轮假设。
- `health-NN.md`：验证 / 可视化反馈循环的输出。
- `shots/`：浏览器截图（若环境支持）。

## 回滚
每一轮都是一次 git 提交，位于 `auto/design-loop` 分支。
查看历史：`git log auto/design-loop`
定位某轮：`git show <sha>` 或 `git checkout <sha>`
回退某轮：`git revert <sha>`
确认无误后合并到 `main` 上线。

## 暂停
在 WorkBuddy 设置中停用对应自动化即可停止循环。
