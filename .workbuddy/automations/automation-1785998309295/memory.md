# ink-loop-design-iteration — execution log

## Cycle 01 (2026-08-06)
- **Hypothesis**: 星尘(silver glints)单点云缺乏景深，违反 `DESIGN-ENHANCE-PLAN` Level 2（粒子三层分层）。
- **Change**: 把 `src/universe/ink-world.mjs` 的 `createSilverGlints` 从单一 `THREE.Points` 重构为三层 `THREE.Group`（fg/mid/bg，caps 14/24/40，gold 概率递减），保留质量档位缩放（新增 `applyGlintQuality`，用 `setDrawRange` 做 LOD）。零新依赖，ice-blue/gold token 语义不变。
- **Verification**: `node --test tests/*.test.mjs` → 74/74 pass；`node scripts/validate-content.mjs` → "Validated 3 public records" pass；headless 截图 `docs/loop/shots/cycle-01.png` 603 KB（非黑屏），无页面级 JS 错误（仅 SwiftShader 软件渲染 GPU 噪声）。
- **Branch**: 在 `auto/design-loop` 提交 `d95be8d`，push 到 `origin`（93427fc..d95be8d）。`main` 未触碰。
- **Next hypothesis**: 背景天穹色温分层（`DESIGN-ENHANCE-PLAN` Level 1）——在现有全景天穹之上叠加 2-3 层低透明多中心径向渐变（靛蓝/紫灰气韵 + 右上暖色星云 patch），强化深空"色彩呼吸"，不新增依赖、不改 ice-blue/gold token。

## 过程笔记（供后续周期参考）
- **分支陷阱**: `state.json` 在 `main` 上是 untracked，在 `auto/design-loop` 上是 tracked（cycle 0）。直接 `checkout`/`merge` 会因 "untracked working tree files would be overwritten" 中止。修复法：先把 4 个工作文件（ink-world.mjs / cycle-01.md / shots/cycle-01.png / state.json）备份到 /tmp，移除 untracked 的 state.json，`git checkout auto/design-loop`，再拷回并覆盖 state.json 为 cycle 1。
- **本地 `auto/design-loop` 当时已 == `origin/auto/design-loop`（93427fc），无分叉**；此前误判需要 merge，实际只需在该分支上叠加提交。
- `src/universe/ink-world.mjs` 在 main 与 auto/design-loop 两分支 base 完全相同，编辑可无冲突应用。
- `docs/loop` 下历史临时产物（health-01.* / baseline* / realm-road|inner|interactive.png / server.log / last-smoke.json）为 `smoke-interaction.mjs` 的输出，可再生成。按"删文件先问"规则本次**保留**，待用户确认后再清理。
- headless Chrome 在 macOS 需 `--enable-unsafe-swiftshader` 才能软件渲染 WebGL（否则全黑 ~13KB）；截图用 900×560、virtual-time 4500 约 40s 完成，避免 1280×800/8000 卡死。

## Cycle 02 (2026-08-06) — 背景天穹色温分层
- **Change**: 新增 `src/universe/ink-sky-tint.mjs`（4 层确定性色温渐变壳，additive、低透明、BackSide，半径 0.985×全景天穹），`ink-world.mjs` 接入为内层 `InkSkyTintShell`；未替换 panorama，未改 token。另在 Ardot 新建视觉规范源 `super-individual-homepage-ui`（fileId 711923303866277）。
- **Verification**: `node --test` → 79/79 pass；`validate-content` pass；headless 冒烟 13/13 无错误。
- **Branch**: 提交 `72529ff`，push 到 `origin`（72529ff）。`main` 未触碰。

## Cycle 03 (2026-08-06) — 衍射星芒纹理（Level 3）
- **Change**: 新增 `src/universe/ink-star-sprite.mjs`（`drawDiffractionSprite` 软射线+收尖、峰值 ≤0.6；`makeStarSpriteTexture` 可注入 canvasTexture；`createStarSprite` Additive、默认隐藏）。`content-beacons.mjs` 共享一份星芒纹理，仅 `core`/`key` 挂 Sprite（core 1.4×、key 1.8× glowSize），`applyHover` 切 `visible`，`update` 仅在 hover 时呼吸（reduced-motion 停止），`dispose` 释放纹理。复用 `goldGlint`/`riverSilver` 上色，无新依赖、未改管线/token。
- **Verification**: `node --test` → 83/83 pass（+4 新单测）；`validate-content` pass；headless 冒烟 **13/13 无 console/page 错误**。
- **Branch**: 提交 `0c950a3`，push 到 `origin`（72529ff..0c950a3）。`main` 未触碰。
- **Next hypothesis**: cycle 04 = Level 4 雾层重做（多层叠加 + 墨核 + Z 轴浮动）。
- **注意**: 本 memory 文件此前只记到 cycle 01，cycle 02/03 已实际执行并提交；`state.json` 在 `auto/design-loop` 上为 tracked，cycle 编号以 `state.json` 为准（当前已推进到 cycle 4）。
