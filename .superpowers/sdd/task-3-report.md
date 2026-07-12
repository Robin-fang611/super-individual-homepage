# 水墨全景宇宙重做 Task 3 实现报告

## 状态

DONE

## 结果

- 将随机散布的精灵云改为 22 个确定位置的大尺度薄雾：前方、左上、远右三组均覆盖；性能档位的前 8 个也横跨三组。
- 保留 13 条墨河路径，其中第 2、6、10 条改用半透明 `TubeGeometry` 墨带，另 10 条仍是命名为 `FlyWhiteRiverEdge-*` 的克制细线。
- 墨旋仍维持 7 圈，移动到左后远处，避开初始入场主视线。
- 通过共享 `FLIGHT_BOUNDARY_RADIUS` 与 `PANORAMA_SHELL_CLEARANCE`，确保 25.2 的全景壳始终包住 24 的可达飞行边界；飞行边界与控制参数不变。

## TDD 证据

### RED 1：三维前景

Command: `node --test tests/universe-ink-world.test.mjs`

Result: exit 1；新增契约断言因源码没有 `TubeGeometry` 和 `InkRiverRibbon` 失败。

### GREEN 1：三维前景

Command: `node --test tests/universe-ink-world.test.mjs`

Result: exit 0，5 tests，5 pass。

### RED 2：全景壳安全边距

Command: `node --test tests/universe-ink-world.test.mjs`

Result: exit 1，`ERR_MODULE_NOT_FOUND`；安全半径共享常量在修复前不存在，当前 23.6 的全景壳小于可达的近 24 飞行边界。

### GREEN 2：全景壳安全边距

Command: `node --test tests/universe-ink-world.test.mjs`

Result: 通过；测试验证壳半径严格大于 `FLIGHT_BOUNDARY_RADIUS`，且等于边界半径加显式安全边距。

## 最终验证

- `node --test tests/universe-ink-world.test.mjs`: exit 0，6 tests，6 pass，0 fail。
- `node --test tests/*.test.mjs`: exit 0，91 tests，91 pass，0 fail。
- `git diff --check`: exit 0，无输出。

## 提交

- 前景提交：`a105275` — `feat: strengthen ink river and spatial masses`
- 壳半径修复提交：由本次修复提交记录。

## 顾虑

- 三维前景的最终构图和半透明层次仍需在浏览器中与全景穹顶一起做视觉验收；本任务只完成了可验证的前景结构与回归。
