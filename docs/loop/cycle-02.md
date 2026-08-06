# cycle-02 · 背景天穹色温分层

**周期**：2026-08-06 (NOW — 响应“今天就开始”)  
**假设**：在现有全景天穹（PNG panorama）之上叠加一层低透明、多中心的径向渐变（靛蓝 / 紫灰气韵 + 右上暖色星云 patch），强化深空“色彩呼吸”，不替换全景天穹、不新增依赖、不改动 ice-blue/gold token 语义。

---

## 三智能体审议

### 视觉智能体
- 当前深空几乎是纯黑到深蓝的线性渐变，层次扁平；粒子分层（cycle-01）完成后，星星有景深了，但天空本身仍像“平铺的布”。
- Level 1 只改“色温层”，是最小改动中视觉收益最大的方向；使用极低的 alpha（0.08–0.16）叠加，不会压过冰蓝主色，也不会让页面变脏。
- 右上暖金 patch 与冰蓝主色形成冷暖对比，符合“气韵”的国风深空表达。

### 交互智能体
- 本改动只影响 3D 背景渲染，不涉及任何 UI 交互；风险全部集中在“页面是否能正常初始化”。
- 必须坚持真实浏览器冒烟：如果新的背景壳在加载时抛出 GL/Canvas 异常，三界切换会一起挂。

### 技术智能体
- 不替换 `InkSkyShell`（panorama shell），而是在其内侧加一个 `InkSkyTintShell`（radius × 0.985），使用 `AdditiveBlending` + `transparent` + `depthWrite:false` + `BackSide`。
- 将色温生成拆成独立可测模块 `ink-sky-tint.mjs`：纯函数 `getSkyTemperatureLayers(seed)` + `drawSkyTemperature(ctx,w,h,seed)` + `createSkyTemperatureShell(...)`。便于未来按 seed 做世界差异，也方便 node 单测。
- 资源回收由现有 `group.traverse` 自动处理，无需额外 dispose 逻辑。

**决议**：执行 Level 1 背景色温分层，作为本循环唯一改动。

---

## 采纳的改动

| 文件 | 说明 |
|------|------|
| `src/universe/ink-sky-tint.mjs` | 新增：4 层确定性色温渐变（靛蓝 #0d1b2a、紫灰 #1a1c2e、暖金 #d8b86a、极暗冷场 #01030a），叠加方式为 additive，绘制到 CanvasTexture。 |
| `src/universe/ink-world.mjs` | 接入色温壳：全景天穹半径 0.985 处插入 `InkSkyTintShell`，保留原有 panorama shell 为主背景。 |
| `tests/universe-ink-sky-tint.test.mjs` | 新增 4 个单测：色板结构、seed 确定性、additive 径向渐变绘制、shell 渲染参数。 |
| `tests/universe-ink-world.test.mjs` | 新增 source 断言：确认 panorama 未被替换，且色温壳已接入 group。 |

---

## 验证结果

### 1. 单元测试
```
node --test
# 79/79 pass (前一轮 74，本轮 +5)
```

### 2. 真实浏览器交互冒烟
```
node scripts/smoke-interaction.mjs --url http://localhost:8788 \
  --shots-dir docs/loop/shots --out docs/loop/last-smoke.json
```
结果：**13/13 passed，无控制台/页面错误。**  关键项：
- 默认 realm = road ✅
- 切换 inner / interactive 正常 ✅
- 星思卡片可展开 ✅
- 星屑提交新增 chip ✅
- 无 uncaught page errors / 非 GPU 控制台错误 ✅

### 3. 视觉规范源
在 Ardot 新建设计稿 `super-individual-homepage-ui`（fileId `711923303866277`）作为三界 UI 视觉规范源：
- 包含深空背景、站点标题、三界 nav pills（星路/内心/互动）
- 内心“心核”面板：星思卡片（占位文案 + tag）
- 互动“星屑”面板：输入框 + 心境 chips（好奇/勇气/松弛）
- 星路“公开历程”面板：起点/此刻/远方 三个里程碑节点
- 截图：`docs/loop/ardot-shots/screenshot(2_2)-20260806_163738.png`

---

## 可视化结论

- 背景天穹现在有一层可感知的“色彩呼吸”；在真实浏览器加载无异常。
- 色温壳位于 panorama 内侧，未遮挡星路节点与交互层。
- Ardot 规范源已建立，后续循环可直接引用其颜色与组件规格同步到 HTML/CSS。

---

## 下一轮假设

**cycle-03 聚焦星芒纹理（DESIGN-ENHANCE-PLAN Level 3）**：给重要星路节点加一个 Canvas 绘制的衍射星芒 Sprite，仅在 hover/active 时显现，透明度随呼吸律动。让“发光点”升级为“恒星”，继续不新增依赖、不改渲染管线。

---

## 备注

- 自动化调度器的 `nextRunAt` 仍无法可靠计算 30 分钟粒度（实测卡在 2026-09-04），因此本轮改为手动立即执行，满足“今天就开始”的诉求。
- 后续仍需解决持续触发问题：候选方案包括改为每小时一次 + 手动补跑、或一个外部脚本轮询 `workbuddy.db`。
