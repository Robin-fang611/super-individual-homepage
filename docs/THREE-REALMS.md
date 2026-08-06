# 三界交互系统 · 设计规格

## 世界观（保留）
深空水墨星路。冰蓝主光、暖金点缀、暗场留白、克制玄幻。零新增依赖，不重写渲染管线。

## 三界模型
- **星路（road）**：对外公开历程，沿星河分布的星标（`content/stars`）。默认境界。
- **内心（inner）**：向内「潜入心核」的私人反思空间，`content/inner` 的星思，不出现在公开星路。
- **互动（interactive）**：访客留下的「星屑」，本地演示存 `localStorage`（`content/interactive` 仅放说明文案）。

## 交互
- 底部三枚胶囊导航切换境界（`realm-nav`）。
- 非星路境界：3D 星场降透明度 + 模糊，hero / 罗盘隐藏，叠加该境界的玻璃面板。
- 内心：点击星思卡片就地展开正文。
- 互动：`textarea` 写一句话 → 存入 `localStorage` → 渲染为星屑 chip。

## 约束（循环必须遵守）
- 不引入新依赖；不破坏 `node --test` 与 `scripts/validate-content.mjs`。
- 颜色只走 CSS 变量；新增 UI 复用 `--panel` / `--ice` / `--gold` 等既有 token。
- 移动端保持可用，触摸目标 ≥ 44px。

## 内容占位约定
`content/{stars,records,inner,interactive}/index.json` 列出 md；md 含 frontmatter（`title` / `date` / `visibility` / `summary`）+ 正文。替换为真实内容只改文件，不改结构。
