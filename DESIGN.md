# DESIGN.md

> 以现有星路素材为母体，做“星光 + 水墨”的展开式深空星路；只扩展原有气流，不重画一个割裂的新世界。

## 1. Visual Theme & Atmosphere

**Style**: 深空水墨星路  
**Keywords**: 原图强融合、星光颗粒、水墨晕染、能量流、纵深星路、暗场留白、低塑料感、克制玄幻  
**Tone**: 沉静、幽深、可探索，有国漫玄幻的气息，但不做游戏 UI、不做建筑奇观、不做赛博科技硬线框。  
**Feel**: 像一条在深空云海中自然发光的河，不像一条被 UI 画出来的路线。

**Interaction Tier**: L3 沉浸体验  
**Dependencies**: 现有 Three.js/WebGL + 原生 CSS/JS；不默认新增 GSAP、Lenis 或新渲染库。

核心判断：
- 现有 `assets/images/star-road-hero-composed.png` 是视觉母版，后续扩展必须顺着它的云层、星尘和光流方向生长。
- 展开后的星路是第一主角，节点只是被星路照亮的“星标”，不能变成独立建筑、浮岛、硬质模型或仪表盘。
- 左侧暗场构图必须保留，用于 `Robin` 和简短信息；右侧星云漩涡和星路主流线必须保留，不被新增元素打断。

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds */
  --bg: #02040b;
  --bg-deep: #01030a;
  --surface: rgba(3, 8, 18, 0.62);
  --surface-alt: rgba(6, 18, 32, 0.46);
  --surface-hover: rgba(8, 24, 40, 0.68);

  /* Borders */
  --border: rgba(165, 222, 234, 0.18);
  --border-hover: rgba(185, 241, 255, 0.36);

  /* Text */
  --text: #f3f7ff;
  --text-secondary: rgba(226, 237, 255, 0.68);
  --text-tertiary: rgba(226, 237, 255, 0.42);

  /* Accent */
  --accent: #82dfff;
  --accent-strong: #b9f1ff;
  --accent-warm: #d8b86a;
  --accent-hover: #d8f7ff;

  /* RGB variants for rgba() */
  --bg-rgb: 2, 4, 11;
  --accent-rgb: 130, 223, 255;
  --accent-strong-rgb: 185, 241, 255;
  --accent-warm-rgb: 216, 184, 106;

  /* Semantic */
  --success: #79e6b8;
  --error: #ff8a9a;
  --warning: #d8b86a;
}
```

**Color Rules:**
- 所有界面颜色必须通过 CSS 变量或 JS 读取 CSS 变量，不在组件内硬编码新色系。
- 冰蓝是主光，暖金只做少量历史节点或星尘高光，不能成为大面积主色。
- 禁止高饱和紫、荧光青、纯白大光斑和大面积渐变色块；这些都会制造塑料感。
- 新增星光要有透明度层次，最大亮度只用于极少数当前节点或星尘爆点。

## 3. Typography Rules

**Font Stack:**
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
```

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Hero H1 | Inter, Microsoft YaHei UI | clamp(56px, 7.4vw, 104px) | 500 | 0.92 | 0 |
| Section H2 | Microsoft YaHei UI, Inter | clamp(28px, 4vw, 52px) | 500 | 1.16 | 0 |
| H3 | Microsoft YaHei UI, Inter | 22px | 500 | 1.28 | 0 |
| Body | Microsoft YaHei UI, Inter | 15px | 400 | 1.75 | 0.02em |
| Label | Inter, Microsoft YaHei UI | 12px | 500 | 1 | 0.18em |
| Mono/Code | Consolas, SFMono-Regular | 13px | 400 | 1.6 | 0 |

**Typography Rules:**
- 中文字体在前，英文字体作为 fallback；正文行高不低于 1.7。
- Hero 保持当前克制的大字，不做描边、不做渐变字、不做强投影。
- Label 可以使用宽字距，但正文和按钮不使用夸张字距。
- **NEVER use**: 书法字体大面积排版、赛博像素字体、粗黑标题堆叠、发光描边字。

**Text Decoration:**
- Hero h1: 无渐变；仅允许极弱 `text-shadow: 0 0 42px rgba(var(--accent-rgb), 0.16)`。
- Section h2: 无渐变；可使用低透明星尘蒙版或背景微光，但不能破坏可读性。
- Body: 不加渐变、不加阴影、不加装饰下划线。
- Links: hover 使用颜色和 1px 下划线滑入，不使用 glow。

## 4. Component Stylings

### Buttons
```css
.button {
  min-height: 42px;
  padding: 0 14px;
  color: var(--text);
  background: rgba(var(--bg-rgb), 0.42);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 180ms var(--ease-out), border-color 180ms var(--ease-out), transform 180ms var(--ease-out);
}
.button:hover {
  background: rgba(var(--bg-rgb), 0.62);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}
.button:active { transform: translateY(0) scale(0.98); }
.button:focus-visible { outline: 2px solid rgba(var(--accent-rgb), 0.7); outline-offset: 2px; }
.button:disabled { opacity: 0.42; cursor: not-allowed; transform: none; }
```

### Cards / Panels
```css
.panel {
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(14px);
}
.panel:hover { border-color: var(--border-hover); }
.panel:focus-within { outline: 2px solid rgba(var(--accent-rgb), 0.42); outline-offset: 2px; }
```

### Navigation
```css
.star-nav {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: rgba(var(--bg-rgb), 0.42);
  border: 1px solid rgba(var(--accent-strong-rgb), 0.14);
  border-radius: 8px;
  backdrop-filter: blur(12px);
}
.star-nav.is-open { opacity: 1; transform: translateY(0); pointer-events: auto; }
.star-nav a {
  color: rgba(239, 249, 255, 0.76);
  text-decoration: none;
  border-radius: 6px;
}
.star-nav a:hover,
.star-nav a:focus-visible { color: var(--text); background: rgba(var(--accent-rgb), 0.08); }
```

### Links
```css
.text-link {
  position: relative;
  color: var(--accent-strong);
  text-decoration: none;
}
.text-link::after {
  position: absolute;
  right: 0;
  bottom: -3px;
  left: 0;
  height: 1px;
  content: "";
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 180ms var(--ease-out);
}
.text-link:hover::after,
.text-link:focus-visible::after { transform: scaleX(1); }
```

### Tags / Badges
```css
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 9px;
  color: rgba(226, 237, 255, 0.72);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: rgba(var(--accent-rgb), 0.06);
  border: 1px solid rgba(var(--accent-rgb), 0.14);
  border-radius: 999px;
}
```

### Star Road Nodes
```css
.star-node-label {
  color: rgba(226, 237, 255, 0.56);
  font-size: 12px;
  text-shadow: none;
  opacity: 0;
  transition: opacity 180ms var(--ease-out);
}
.star-node.is-hovered .star-node-label,
.star-node.is-active .star-node-label { opacity: 1; }
```

## 5. Layout Principles

**Container:**
- Full-bleed canvas: `100vw x 100svh`，不加外框、不放卡片容器。
- Hero text safe zone: desktop 左侧 `clamp(30px, 8vw, 126px)`，宽度不超过 `430px`。
- Detail panel: desktop 右侧 `min(352px, calc(100vw - 40px))`；mobile 使用底部抽屉。

**Spacing Scale:**
- Section padding: 第一屏无传统 section padding，以画面构图为主。
- Component gap: 8px / 12px / 20px。
- Panel internal padding: 20px-24px。

**Grid:**
```css
.stage {
  position: relative;
  width: 100vw;
  height: 100svh;
  overflow: hidden;
}
.hero-safe-zone {
  position: absolute;
  top: clamp(132px, 24vh, 210px);
  left: clamp(30px, 8vw, 126px);
  z-index: 3;
  max-width: min(430px, calc(100vw - 60px));
}
```

构图硬约束：
- 不改变原图“左暗右亮、右上漩涡、右侧星路流动”的结构。
- 展开后的星路从原星路延展，不新开一条与原流线冲突的路径。
- 当前节点在星路下游或近景处增强，但不遮挡右上漩涡和主体光河。

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Atmosphere | 原图星云 + 低透明水墨雾层 | 背景和远景 |
| Star Dust | 0.5-1.8px 星点，screen/additive 混合 | 星路颗粒 |
| Flow | 半透明曲线、宽光带、粒子拖尾 | 展开后的星路 |
| Node | 微光核心 + 椭圆轨道 + 极少标签 | 可点击节点 |
| HUD | 深色玻璃面板，8px radius | 信息展开 |

Depth Rules:
- 景深靠透明度、粒子密度、大小和雾化，不靠硬阴影。
- 禁止厚重 drop shadow、塑料高光、金属质感大物体。
- WebGL 中优先用 Sprite/Points/Line/Ribbon 表达，不急着引入复杂 Mesh。

## 7. Animation & Interaction

**Motion Philosophy**: 像星尘和墨迹在慢慢流动，不像 UI 组件在表演。  
**Tier**: L3

### Dependencies
```html
<!-- No new dependency by default. Reuse local /assets/three.module.js. -->
```

### Entrance Animation
```css
@keyframes starFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.hero-title {
  animation: starFadeIn 820ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

### Scroll / Explore Behavior
```js
// Principle only: real implementation stays in src/star-field.mjs.
// Camera auto-orbits slowly until the user interacts.
// Wheel controls distance; pointer drag controls orbit; click focuses node.
```

### Hover & Focus States
```css
.interactive-node {
  cursor: pointer;
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out);
}
.interactive-node:hover { opacity: 1; }
.interactive-node:focus-visible { outline: 2px solid rgba(var(--accent-rgb), 0.7); outline-offset: 4px; }
```

### Special Effects
- 星路展开：用多个低透明 ribbon + particles 叠加，颗粒顺着曲线流动。
- 水墨感：使用噪声纹理、雾层和 alpha 边缘，不使用硬边 blob。
- 当前节点：只做星光密度增强，不做建筑、不做实体平台。
- 年份节点：默认弱显示，聚焦或 hover 时轻微显现。

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Runtime rule:
- WebGL scene 不可见时必须暂停 requestAnimationFrame。
- Mobile 端减少粒子数、减少透明叠层、降低像素比上限。

## 8. Do's and Don'ts

### Do
- 以原星路图片为构图母版，新增视觉只做填充和延展。
- 强化右侧星路的星光颗粒、流动曲线、雾化边缘和水墨云层。
- 用冰蓝做能量主光，用暖金做少量历史高光。
- 保持左侧暗场干净，服务 `Robin` 文案。
- 让节点像被星河照亮，而不是像按钮贴在画面上。
- 先做展开后的星路状态，再决定是否需要更复杂 3D。
- 用透明度和层次制造高级感，而不是用强对比硬轮廓。

### Don't
- 禁止做建筑、观测台、浮岛、塔、平台、城堡、宗门山门。
- 禁止在原图上硬贴几何体或 UI 标记。
- 禁止新增一条与原星路方向冲突的斜线、光束或路径。
- 禁止使用塑料感发光：高饱和、硬边、纯白大块、强 bloom。
- 禁止把右上漩涡遮住或改成背景陪衬。
- 禁止把节点做成大圆球、大卡片、大标签。
- 禁止使用紫蓝渐变球、bokeh blob、赛博网格线。
- 禁止使用大面积金色，不做土豪玄幻感。
- 禁止让文字压到星路主体上。
- 禁止新增依赖来解决纯美术问题。

## 9. Responsive Behavior

**Breakpoints:**
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | > 1024px | 左侧文案 + 全屏星路；3D/Canvas 完整粒子 |
| Tablet | 761px-1024px | 文案缩小，星路中心略右移，节点标签减少 |
| Mobile | < 760px | 保留 3D/Canvas 但限制自由度；底部抽屉；粒子数降级 |

**Touch Targets:** minimum 44px  
**Collapsing Strategy:** mobile 不变成普通列表，仍显示星路，只减少标签和粒子复杂度。

```css
@media (max-width: 760px) {
  .hero-safe-zone {
    top: 132px;
    right: 20px;
    left: 20px;
    max-width: 92vw;
  }

  .detail-panel {
    display: none;
  }

  .bottom-sheet {
    right: 12px;
    bottom: 12px;
    left: 12px;
    max-height: min(42svh, 360px);
  }
}
```
