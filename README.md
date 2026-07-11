# Robin Personal Star Road

Robin 的个人星路首页原型：`星辰，进化之路`。

第一版是纯静态项目，不需要构建步骤，也不需要安装依赖。内容节点放在 `content/stars/`，每颗星是一份带 frontmatter 的 Markdown 文件。

## 本地预览

由于页面会通过 `fetch` 读取 Markdown 节点，不建议直接双击 `index.html` 打开。使用本地静态服务器：

```powershell
python -m http.server 8788
```

打开：

```text
http://localhost:8788
```

## 验证命令

```powershell
node --test tests/star-content.test.mjs tests/star-layout.test.mjs
node scripts/validate-content.mjs
```

预期结果：

- 解析和布局测试全部通过。
- 内容验证输出 `Validated 3 public star nodes.`

## 内容维护

新增星星时：

1. 在 `content/stars/` 新增一份 Markdown 文件。
2. 在 `content/stars/index.json` 里加入文件名。
3. 运行 `node scripts/validate-content.mjs`。

最小字段：

```markdown
---
title: "节点标题"
date: "2026-06-09"
year: 2026
type: "milestone"
summary: "一句话摘要。"
visibility: "public"
current: false
---
```

同一时间只保留一颗 `current: true` 的当前星。

## Cloudflare Pages

Cloudflare Pages 设置：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `/`
- Root directory: 仓库根目录

部署前确认：

```powershell
node --test tests/star-content.test.mjs tests/star-layout.test.mjs
node scripts/validate-content.mjs
```
