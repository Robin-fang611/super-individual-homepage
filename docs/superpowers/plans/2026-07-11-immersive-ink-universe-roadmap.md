# 沉浸式东方水墨宇宙实施路线图

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap plan-by-plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按可独立验收的顺序，把现有 Three.js 星路首页升级为第一人称、自动适配画质的三维东方水墨宇宙。

**Architecture:** 三个子项目依次交付：先建立第一人称飞行和不可穿越球形边界，再建立五秒首屏与画质闭环，最后接入空间化水墨世界。每个子项目均保持静态部署、无新增第三方依赖，并在进入下一阶段前通过自动测试和真实设备检查。

**Tech Stack:** 原生 ES Modules、Three.js 本地模块、Node.js 内置 test runner、HTML/CSS、WebGL、Cloudflare Pages 静态部署。

## Global Constraints

- 设计规格：`docs/superpowers/specs/2026-07-11-immersive-ink-universe-design.md`。
- 不新增或升级第三方依赖；若实施中确认必须新增，先停止并请求 Robin 批准。
- 主要输入为 Mac/Windows 触控板；鼠标、手机和平板不属于本阶段验收范围。
- 五秒内可控制；高清资源可以在五秒后渐进补齐。
- 完整球面观察不设置 pitch 硬限制；不提供主动 roll。
- 所有画质档共享同一世界种子、地标坐标、构图和青蓝黑银色彩语义。
- 粒子不是画面主体；空间化水墨体积、墨带和墨雾承担主要视觉体量。
- 继续保持纯静态部署，服务器不参与实时渲染。

---

## 执行顺序

### Plan 1：第一人称飞行基础

文件：`docs/superpowers/plans/2026-07-11-universe-flight-foundation.md`

交付物：

- 单一 `PlayerRig` 姿态真源。
- 完整球面观察和舒适 roll 稳定。
- 触控板、捏合和键盘输入归一化。
- 固定步长运动、短惯性、球形软边界。
- 自动入场与 300–500 ms 平滑交权。
- Mac/Windows 真实触控板验收清单。

进入下一计划的门槛：所有纯逻辑测试通过；本地页面可自由飞行、不可穿墙；阅读浮层仍能暂停和恢复。

### Plan 2：自适应画质与五秒首屏

文件：`docs/superpowers/plans/2026-07-11-adaptive-quality-loading.md`

交付物：

- Performance、Balanced、High、Cinematic 四档不可变配置。
- 帧时间监测、快速降档、缓慢升档和防抖。
- `core → balanced → high → cinematic` 渐进资源加载。
- 静态首屏、WebGL 失败回退和 context lost 恢复。
- 五秒启动时间点和资源预算测量。

进入下一计划的门槛：模拟慢网时五秒内可控制；自动档不频繁跳变；资源失败不白屏、不阻塞飞行。

### Plan 3：空间化东方水墨世界

文件：`docs/superpowers/plans/2026-07-11-spatial-ink-universe-visuals.md`

交付物：

- 固定世界蓝图与方向性青黑墨底。
- 三维主墨河、偏轴墨旋、有限水墨星云域。
- 近景墨丝和极少量银色星芒。
- 四档同构 LOD 与克制光学统一。
- 十二观察点、三条航线和四档固定机位视觉验收。

完成门槛：完整球面观察和飞行看不到接缝、球壳、卡片侧面或重复图案；四档保持同一构图与风格。

## 总体验收

- [ ] 运行全部 Node 测试：`node --test tests/*.test.mjs`，预期全部通过。
- [ ] 运行内容验证：`node scripts/validate-content.mjs`，预期输出 `Validated 3 public star nodes.`。
- [ ] 运行本地静态服务器：`python -m http.server 8788`。
- [ ] Mac Safari、Mac Chrome、Windows Chrome、Windows Edge 完成真实触控板矩阵。
- [ ] 冷缓存、4 Mbps、80 ms RTT 下记录静态首屏、WebGL 首帧和可控制时间。
- [ ] Performance、Balanced、High、Cinematic 在相同机位导出截图并比对构图。
- [ ] 持续飞行至少十分钟，检查 context lost、内存增长、漂移、穿墙和频繁跳档。

