# Claude Code Task: 星路视觉纠偏与第二轮 3D 打磨

## 背景

上一轮已经把页面改成 Three.js 场景，并加入星路 ribbon、水墨雾层、星尘和节点交互。自动化测试通过，桌面和移动端也能渲染、点击节点。

但当前结果偏离了 Robin 的核心要求：必须围绕原有美术素材做填充和扩展，不能替换视觉母体。现在 `assets/images/star-road-hero-composed.png` 被脚本改成几乎纯黑星空，原来的星路、水墨、右侧构图主体丢失，这是第一优先级问题。

## 本轮目标

把当前 Three.js 实现纠偏到“强融合原始星路素材”的方向：

- 恢复或重新接回原有星路构图，不允许用随机生成的纯星空替代。
- 保留现有 3D 交互能力，但降低节点过大、裁切、重叠和塑料感。
- 让右侧星路/漩涡重新成为视觉主角，左侧继续保持暗场文字区。
- 让桌面和移动端都稳定、可重复、无随机刷新差异。

## 当前已验证结果

已运行：

```powershell
node --test tests/star-field-controls.test.mjs tests/star-layout.test.mjs tests/star-content.test.mjs
node scripts/validate-content.mjs
```

结果：

- 16 个测试通过。
- 内容校验通过，`Validated 3 public star nodes.`。
- 浏览器桌面 `1440 x 900`：页面可渲染，点击 2025 节点可打开右侧详情面板。
- 浏览器移动端 `390 x 844`：页面可渲染，点击 2026 节点可打开底部面板。

## 当前问题

### P0：原始美术素材被覆盖

`assets/images/star-road-hero-composed.png` 当前变成几乎纯黑星空，文件体积约 25KB。它已经不是原有星路母图。

同时这些图也被替换成脚本生成图：

- `assets/images/star-road-hero-composed.png`
- `assets/images/star-road-open.png`
- `assets/images/star-road-river.png`

上一轮新增的 `scripts/generate-bg-images.py` 使用随机数生成背景，这不符合“围绕原有素材扩展”的方向。

要求：

- 不要继续用 `scripts/generate-bg-images.py` 生成或覆盖正式素材。
- 不要删除该脚本，除非 Robin 明确确认。
- 恢复素材时不要使用 `git reset --hard`、`git checkout --`、`git clean`。
- 如需从 git 或备份恢复二进制素材，先确认恢复范围只包含上述图片。
- 可以参考 `output/playwright/star-road-backdrop-final.png` 的视觉状态，但不要把截图直接当正式资产，除非确认尺寸和清晰度满足页面需求。

### P1：桌面当前节点过大并被左侧裁切

桌面首屏中，2026 当前节点和年份标签被推到屏幕左侧，部分裁切。它抢走了 `Robin` 文案区域，也破坏了左暗右亮构图。

要求：

- 调整 `src/star-layout.mjs` 的 `homeFocus.desktop` 或星点空间布局，让当前节点不要被裁到屏幕外。
- 当前节点可以更亮，但不应远大于其他节点。
- 首屏应保留左侧文案呼吸区，星路主体向中右侧展开。

### P1：节点聚焦后标签和星体重叠

点击 2025 后，画面里 2026 大标签和当前星体会与 2025 节点附近视觉重叠。

要求：

- 聚焦非当前节点时，当前节点和当前年份标签要降低存在感。
- `createYearLabel` 的大小、透明度、偏移要随深度和 active/hover 状态控制。
- 避免巨大年份数字压住星路主体。

### P1：缓存版本不一致

当前：

- `index.html` 使用 `3d-scene-13`
- `src/app.mjs` 内部动态导入仍使用 `3d-scene-12`
- `src/star-field.mjs` 内部导入 `star-layout.mjs?v=3d-scene-12`

要求：

- 统一缓存版本，例如全部改成 `3d-scene-14`。
- 或者抽掉内部模块的硬编码查询参数，只保留入口 HTML 的版本控制。
- 不能出现 HTML 和动态 import 版本不一致。

### P2：水墨雾层使用随机数，刷新不可复现

`makeInkWashTexture` 和 `createInkWashMist` 使用 `Math.random()`，每次刷新都可能变化。

要求：

- 改成确定性伪随机函数，例如基于 index 的 seeded noise。
- 同一代码版本每次刷新视觉应一致。
- 仍保留柔雾和墨迹扩散感。

### P2：调试目标状态缺失

浏览器里 `window.__starRoadDebug?.targets` 读到 `null` 或空，这会降低后续自动验收能力。

要求：

- 确保 `window.__starRoadDebug = { targets }` 在动画启动后稳定存在。
- targets 至少包含当前可见星点的 `id/title/x/y`。
- 不要把调试对象用于产品 UI，只用于验收。

## 实现范围

优先修改：

- `assets/images/*`，仅限恢复被覆盖的原始素材或接回正确素材。
- `src/star-layout.mjs`
- `src/star-field.mjs`
- `src/app.mjs`
- `index.html`
- `styles.css`

谨慎处理：

- `scripts/generate-bg-images.py`：不要删除。可以改成不默认覆盖正式素材，或在文档里标注废弃，但删除前要问 Robin。

不要改：

- 内容 Markdown。
- 无关文档。
- 依赖配置。项目没有 `package.json`，不要新增依赖。

## 视觉验收标准

桌面 `1440 x 900`：

- 第一眼必须还能看到原有星路/水墨构图，不是纯黑星空。
- `Robin` 文案清晰，左侧不被巨大星体或年份压住。
- 当前节点不裁切，不像贴在屏幕边缘。
- 右侧星路和水墨雾有展开感，但不是硬光束。
- 点击 2025 后详情面板打开，2026 不应压住 2025。

移动端 `390 x 844`：

- 首屏仍是星路场景，不变成普通列表。
- 节点不要挤压文案；可以略微下移或缩小。
- 点击 2026 后底部面板打开，星路主体不被底部面板完全遮掉。

## 功能验收标准

- 控制台无 error。
- `window.__starRoadBoot.step === "ready"`。
- `window.__starRoadDebug.targets.length >= 1`。
- 桌面可点击节点打开 `detail-panel`。
- 移动端可点击节点打开 `bottom-sheet`。
- 拖拽、滚轮、键盘导航仍可用。

## 验证命令

```powershell
node --test tests/star-field-controls.test.mjs tests/star-layout.test.mjs tests/star-content.test.mjs
node scripts/validate-content.mjs
```

本地预览：

```powershell
python -m http.server 8791
```

如果 `8791` 被占用，换一个端口。不要结束已有进程，除非 Robin 明确确认。

## 交付说明

完成后输出：

- 改了哪些文件。
- 是否恢复了原始素材，恢复来源是什么。
- 桌面和移动端截图检查结论。
- 自动化测试结果。
- 是否还有需要 Robin 选择的视觉方向问题。
