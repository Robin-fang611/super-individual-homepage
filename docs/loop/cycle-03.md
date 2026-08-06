# cycle-03 · 星芒纹理（Level 3 衍射星芒）

**周期**：2026-08-06  
**假设**：重要星路节点（core / key）目前是"圆形光晕 + 标签"的发光点，缺少"恒星感"。给它们加一个 Canvas 绘制的衍射星芒 Sprite，仅在 hover/active 时显现，透明度随星体呼吸律动，把"发光点"升级为"恒星"——不新增依赖、不改渲染管线、不改 ice-blue/gold token 语义。

---

## 三智能体审议

### 视觉智能体
- 方向正确，但射线**过硬**会变成"廉价闪光贴纸"，与水墨柔质冲突；必须软渐变收尖、峰值不透明度 ≤0.6、复用既有 `goldGlint`/`riverSilver` 上色（无新色）。
- 核心（core/当前）节点已有 glow+ring+常驻 label，hover 再叠星芒易过曝 → 核心星芒需更淡、更小（≤1.4× glowSize）。
- 需尊重 `prefers-reduced-motion`：开启时停止呼吸。

### 交互智能体
- 改动完全封闭在 3D `beaconGroup` 内，不触 HTML 三界切换/导航/a11y；`hitTest`/`applyHover` 仅做增量切换，安全。
- "hover-only" 在触屏无 hover 态时星芒永不显示——属预期降级（节点仍有 base glow），需在说明里标注为 desktop enhancement。
- `dispose()` 必须加入新 sprite 释放纹理，否则显存泄漏。

### 技术智能体
- 零新依赖：仓库无 package.json，three 来自 `/assets`；新模块仅用 canvas 2D + 既有的 `THREE.Sprite`/`AdditiveBlending`。
- `drawDiffractionSprite` 纯函数、只调标准 canvas API，可在 node 用 mock ctx 单测（仿 `ink-sky-tint`）。
- 纹理**全节点共享一次**（仿 glow/ring），由 `dispose()` 统一释放；每帧仅在 hover 时改 `material.opacity`，无逐帧分配，开销可忽略。

**决议**：三智能体一致 **AGREE**，采纳上述执行级修正（软射线、核心降档、reduced-motion、共享纹理、dispose 释放）。

---

## 采纳的改动

| 文件 | 说明 |
|------|------|
| `src/universe/ink-star-sprite.mjs` | 新增：纯函数 `drawDiffractionSprite`（中央柔光 + 锥形收尖射线，沿轴渐变、边缘透明、峰值 0.6）、`makeStarSpriteTexture`（`canvasTexture` 可注入、白底靠 material.color 上色）、`createStarSprite`（AdditiveBlending、默认 opacity 0 / visible false）。 |
| `src/universe/content-beacons.mjs` | 接入星芒：全节点共享一份星芒纹理；仅 `core`/`key` 挂 Sprite（core 比例 1.4×、key 1.8× glowSize）；`applyHover` 切 `visible` 并给初始不透明度；`update` 仅在 hover 时做呼吸（reduced-motion 下停止）；`dispose` 释放星芒纹理/material。 |
| `tests/universe-ink-star-sprite.test.mjs` | 新增 4 个单测：软射线+additive+边缘透明、arms 参数、共享纹理单次构建、隐藏的 additive Sprite 材质断言。 |

---

## 验证结果

### 1. 单元测试
```
node --test tests/*.test.mjs
# 83/83 pass（前一轮 79，本轮 +4）
```

### 2. 内容校验
```
node scripts/validate-content.mjs
# Validated 3 public records.
```

### 3. 真实浏览器交互冒烟
```
node scripts/smoke-interaction.mjs --url http://localhost:8788 \
  --shots-dir docs/loop/shots --out docs/loop/last-smoke.json
```
结果：**13/13 passed，无控制台/页面错误。**
- 默认 realm = road ✅ · 切换 inner/interactive ✅ · 星思卡片展开 ✅
- 星屑提交新增 chip ✅ · 切回 road ✅ · 无 uncaught page errors / 非 GPU 控制台错误 ✅

---

## 可视化结论

- 星芒为 hover-only 的桌面增强：鼠标悬停 core/key 节点时，节点从"光点"升级为带 4 射线的"恒星"，透明度随呼吸律动；移开即隐。触屏无 hover 态时星芒不可见（节点保留 base glow），属预期降级。
- 核心节点星芒更淡更小，避免与 glow+ring+label 叠加过曝；全程复用既有 ice-blue/gold 上色，未引入新色。
- **冒烟截图（`docs/loop/shots/realm-*.png`）为 DOM 层三界切换画面，不含 hover 态的 3D 星芒本身**；星芒的视觉确认需在桌面浏览器手动悬停星路节点（headless 无法稳定触发 3D hover）。

---

## 截图路径
- `docs/loop/shots/realm-road.png`
- `docs/loop/shots/realm-inner.png`
- `docs/loop/shots/realm-interactive.png`
- 冒烟报告：`docs/loop/last-smoke.json`

---

## 下一轮假设

**cycle-04 聚焦雾层重做（DESIGN-ENHANCE-PLAN Level 4）**：现有水墨雾是均匀半透明 Sprite，像薄纱。改为多层叠加工艺——每层不同大小/透明度/色温，并增 2-3 个"墨核"（更浓核心区）让雾气有聚散感，雾气漂移动画增加 Z 轴浮动。继续不新增依赖、不改渲染管线、不改 ice-blue/gold token。
