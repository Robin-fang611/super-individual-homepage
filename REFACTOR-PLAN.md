# 星路视觉镀铬 — 重构计划

## 当前状态分析

上轮做了大量"克制化"改动（雾层确定性、节点降亮、圆柱背景、水墨笔触替代丝带），但整体亮度降太多，导致多处细节"糊成一团"。

## 问题清单与修复方案

### 1. 场景太暗，缺乏层次

**症状**：AmbientLight 从 1.05→0.64，KeyLight 从 3.2→1.2，雾层/星尘/光晕全部改用 NormalBlending。整体像蒙了一层灰纱，没有深空应有的明暗层次。

**修复**：
- AmbientLight 回到 0.85（不回到 1.05，但别 0.64）
- KeyLight 回到 2.0
- scene.fog 密度从 0.034 调回 0.045
- 核心发光元素（星体 halo、ink trail）改回 AdditiveBlending，背景类（雾层、dust）保留 NormalBlending

### 2. 星体从 Mesh 改成 Sprite 后"纸片感"

**症状**：`createStarMesh` 从 SphereGeometry Mesh 改成了 Sprite（`makeInkStarTexture` 纹理）。Sprite 始终面向相机，没有 3D 体积感，像纸片贴在上面。

**修复**：改回 SphereGeometry Mesh，保留 `starTexture` 作为 halo 或装饰层。Mesh 带 emissive 材质，保持体积感。

### 3. 星路断裂感（ink strands 太碎）

**症状**：broadRibbonLayers=0，pathLine 删除，只有 `createInkRoadStrands`（7 条 lane × 8 段 = 56 条短线）。星路变成零散碎片，不像一条连贯路径。

**修复**：
- 加一条极低透明度的连续 ribbon（opacity 0.02-0.03），提供路径"骨架感"
- ink strands 的 lane 数从 7 减到 5，但让每一段更长（end - start 从 0.045 扩到 0.08）
- 把 ink strands 的 NormalBlending 改成 AdditiveBlending

### 4. 圆柱背景接缝问题

**症状**：`makeNaturalBackdropTexture` 把原图放在圆柱左侧，右侧 2/3 是程序化扩展。`drawNaturalBackdropDetail` 做了大量渐变色块和 ink band 来掩盖接缝，但可能仍有可见拼缝或颜色断层。

**修复**：
- 确认 cylinder 分段数 96 是否足够（够，但要在 animate 里把 backdrop rotation 和 roadGroup 同步）
- 简化接缝过渡逻辑：不要多层 gradient 叠接缝，直接用一个宽过渡带（1500px）从原图 fade 到扩展

### 5. 标签与节点视觉干扰

**症状**：聚焦时非活跃 label opacity 从 0.025 到 0.48 的切换太突兀。label 字号（34px 年份）在 sprite 缩放 0.52 后可能显示模糊（256x96 canvas）。

**修复**：
- Canvas 字体从 34px 降到 28px，减少缩小时锯齿
- 聚焦切换时加一个缓动过渡（用 lerp 而不是直接跳 opacity）
- 非活跃 label 最低 opacity 从 0.025 提到 0.08（不至于完全消失）

### 6. DepthBeacons 过于微弱

**症状**：环线 opacity 0.12/0.05（之前 0.2/0.11），竖线 0.014/0.006（之前 0.08/0.045），光晕 0.028/0.014（之前 0.1/0.045）。这些在 NormalBlending 下几乎不可见。

**修复**：
- 环线 opacity 提到 0.18/0.08
- 光晕改回 AdditiveBlending
- 竖线 opacity 提到 0.03/0.015

### 7. StarParticleTexture 过暗

**症状**：辐射渐变从 center 的 "rgba(255,255,255,1)" 降到边缘迅速变暗，粒子在场景中几乎看不到。

**修复**：粒子纹理保持亮核，核心半径扩大（0→0.3 保持全白，再开始衰减）

## 实施顺序

1. **光照恢复**（AmbientLight + KeyLight + fog）— 立刻改善整体可读性
2. **星体改回 Mesh** + AdditiveBlending halo — 恢复体积感
3. **星路修复**（一条连续 ribbon + 改进 ink strands）— 恢复路径连贯性
4. **背景接缝简化** — 减少视觉噪声
5. **标签、beacons、粒子**逐项调优
6. 验证：跑测试 + 截图对比
