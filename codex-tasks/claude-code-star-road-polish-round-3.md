# Claude Code Task: 星路最终克制打磨与资产管理

## 当前结论

上一轮修复已基本达标：

- 原始三张星路图片已从 `9cce001` 恢复，当前 `assets/images` 无 git diff。
- 缓存版本已统一到 `3d-scene-14`。
- `Math.random()` 已从 `src/star-field.mjs` 的水墨雾生成中移除，改为确定性 LCG。
- 桌面和移动端都能渲染，点击节点能打开对应面板。
- 自动化测试通过。

本轮不要再重做 3D 架构，但必须先修正背景贴图策略：当前背景是镜像复制出来的 360，视觉上会暴露重复和翻转痕迹。先回到原始非镜像构图，再做自然延展。

## 本轮目标

让当前星路更像“原图展开”，少一点 3D 球体存在感，多一点星光/水墨路径融合感。

## 必做项

### 0. 取消镜像背景，改为自然 360 延展

当前 `src/star-field.mjs` 里存在镜像拼贴逻辑：

- `getMirroredBackdropSize`
- `drawMirroredImage`
- `makeMirroredBackdropTexture`
- `drawMirroredImage(context, image, ..., true/false)` 这类翻转绘制

这会把原图上下左右翻过去填充球体，导致 360 旋转时出现明显镜像感。这个方向必须修正。

要求：

- 第一步：先回撤到原始非镜像视觉。也就是正面主视角必须直接使用 `assets/images/star-road-hero-composed.png` 的原始构图，不允许翻转、镜像或四宫格复制。
- 第二步：再做自然 360 延展。延展区域可以用程序化暗场、水墨云、稀疏星点、柔性星尘补足，但不能复制镜像原图。
- 原图的右侧星路/漩涡必须保持原方向，左侧暗场也必须保持原方向。
- 允许新建类似 `makeNaturalPanoramaBackdropTexture` 的函数，但不要继续使用 `makeMirroredBackdropTexture` 这个语义。
- 如果一轮内无法自然延展得很好，宁可先保留非镜像原图 + 暗场过渡，也不要继续使用镜像填充。
- 更新相关测试：如果测试还在断言 `getMirroredBackdropSize`，要改成验证“自然延展贴图尺寸/非镜像函数存在”，不能继续保留镜像概念。

自然延展建议：

- 画布可以仍然大于原图，例如 `image.width * 2`，但原图只能作为一个不翻转的主视角区域绘制。
- 侧面和背面用边缘取样色、深空渐变、低透明星尘、水墨雾和少量弧形光流补足。
- 正反交界处用低透明雾化层遮接缝，不要用左右翻转解决接缝。
- 360 拖拽检查时，背面可以更暗、更空，但不能出现“同一星路反着再来一遍”。

### 1. 当前星体再克制一点

桌面聚焦 2025 后，2026 当前星体仍然略大，视觉上有一点抢主角。

要求：

- 当前星体可保持更亮，但半径、halo 或材质亮度再降 10%-20%。
- 当前星体不要像一个独立发光球，更像星路中的近景聚光点。
- 不要影响点击命中区域，`hitArea` 可以保持原尺寸。

### 2. 聚焦态进一步降低非活跃标签干扰

当前聚焦后非活跃标签已淡出，但 2026 标签在某些角度仍可见。

要求：

- 聚焦非当前节点时，非活跃 label 可降到 `0.04-0.06`。
- 非活跃 halo 保持可感知即可，不要变成另一处视觉中心。

### 3. 资产管理决策落地为注释，不删除

不要删除任何文件。

要求：

- 在 `scripts/generate-bg-images.py` 文件顶部加明确注释：该脚本为废弃/实验生成器，不能直接覆盖正式 `assets/images/*`，除非 Robin 明确确认。
- `assets/images/star-road-vortex.png` 保留，不删除。它是原始风格参考/备用素材，即使当前未被引用，也不要为了 2.5MB 做清理。

### 4. 可验收性

保持：

- 桌面可点击节点打开右侧详情面板。
- 移动端可点击节点打开底部面板。
- 控制台无 error。
- 不新增依赖。

## 验证命令

```powershell
node --test tests/star-field-controls.test.mjs tests/star-layout.test.mjs tests/star-content.test.mjs
node scripts/validate-content.mjs
```

## 浏览器检查

使用当前项目预览：

```text
http://127.0.0.1:8791/
```

检查：

- Desktop `1440 x 900` 首屏。
- Desktop 点击 2025 后详情面板。
- Mobile `390 x 844` 首屏。
- Mobile 点击 2026 后底部面板。

## 交付说明

完成后说明：

- 当前星体缩小/降亮了哪些参数。
- 是否只给 `generate-bg-images.py` 加了保护注释，没有删除。
- `star-road-vortex.png` 是否保持不动。
- 测试和浏览器检查结果。
