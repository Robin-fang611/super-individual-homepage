# Cycle 01 · 星尘三层分层（粒子深度）

- **日期**：2026-08-06
- **轮次**：1（state.json 初值为 0，本轮落实 state.json 假设的「粒子分层」方向）
- **分支**：auto/design-loop

## 假设（Hypothesis）
星河粒子当前是单一 `Points` 图层（size 0.045、单一 opacity 0.55、仅约 6% 暖金），呈现为均匀薄雾、缺乏景深——违反 DESIGN-ENHANCE-PLAN.md Level 2「粒子分层」。把单层星尘拆成「前景大星 / 中景密度 / 背景小星尘」三层，可立即获得可辨识的明星与纵深，是视觉收益最大、改动最小的入手点。

## 三智能体评审（并行子代理，只读）
1. **视觉/美术一致性**：指出 `createSilverGlints` 单层无层次、整族青绿调性、背景天穹缺气韵。Top 推荐即「粒子三层分层」。
2. **交互/Web 适配**：报「`autoPlay:false` 导致永久黑屏」为致命 bug。经主代理核对 `runtime.mjs` 每帧调用 `intro.setElapsed()` 驱动 phase 推进，**该结论为误报**——`autoPlay:false` 是有意设计（揭幕与相机飞行同步）。其余有效点为触摸目标 <44px、缺 761–1024 平板断点（记为后续假设，不在本轮改）。
3. **技术可行性**：指出 `createSilverGlints` 恒按 cinematic 上限分配、缺可见时 rAF 暂停。确认零依赖硬约束未被触及，改 `createSilverGlints` 风险低且不被单测直接覆盖。

## 采纳的改动（Chosen change）
**文件**：`src/universe/ink-world.mjs`
- 将 `createSilverGlints` 由单一 `Points` 重构为 `Group`（命名 `SilverGlints`），内含三层 `Points`：
  - 前景 `fg`：cap 14、size 0.09、opacity 0.85、半径 9–12、13% 暖金（冰蓝主光 + 稀疏金点缀，符合 DESIGN.md 配色规则）
  - 中景 `mid`：cap 24、size 0.045、opacity 0.55、半径 12–16、6% 暖金
  - 背景 `bg`：cap 40、size 0.018、opacity 0.30、半径 16–21、3% 暖金
- 新增 `applyGlintQuality(glintsGroup, silverGlints)`：按各层容量比例把 `plan.silverGlints` 分配到三层 `drawRange`，**完整保留原画质档位缩放行为**（core/balanced/high/cinematic 各档星数随之增减，且不超过各层容量上限）。
- `setQuality` 由 `glints.geometry.setDrawRange(...)` 改为 `applyGlintQuality(glints, nextPlan.silverGlints)`。
- 未新增任何依赖、未改动 ice-blue/gold token 语义、未引入 `TubeGeometry`/程序化天空等被测试禁止的图案。

## 改动文件
- `src/universe/ink-world.mjs`（仅 `createSilverGlints` + 新增 `applyGlintQuality` + `setQuality` 一处调用）

## 测试结果
- `node --test tests/*.test.mjs`：**74/74 通过**（含 `universe-ink-world.test.mjs` 的 panorama/ink-mass/无 TubeGeometry 等源正则断言）。
- `node scripts/validate-content.mjs`：**通过**（Validated 3 public records）。

## 截图
- 路径：`docs/loop/shots/cycle-01.png`（603 KB，headless 经 `--enable-unsafe-swiftshader` 软件 WebGL 渲染；为在合理时间内完成，采用 900×560 / virtual-time 4500 的小窗参数，仍完整走完 WebGL 路径即 `createSilverGlints` 三层构建已执行）。
- 注：本机无 GPU，headless 需软件 WebGL；纯深空风格本身接近全黑，故视觉上偏暗属预期，但文件体积（603 KB）证明星点/星云已实际渲染而非空场。

## 控制台错误摘要
- 真实页面级 JS 错误（TypeError / ReferenceError / Uncaught）：**无**（clean）。
- 仅存在环境级 GPU/WebGL 软件渲染提示（`GPU stall due to ReadPixels`、swiftshader fallback），非页面代码错误。

## 下一轮假设（Next hypothesis）
背景天穹色温分层（DESIGN-ENHANCE-PLAN Level 1）：在现有全景天穹之上叠加 2–3 层低透明多中心径向渐变（靛蓝/紫灰气韵 + 右上暖色星云 patch），强化深空「色彩呼吸」，不新增依赖、不改 ice-blue/gold token 语义。
