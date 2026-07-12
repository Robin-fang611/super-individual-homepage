# Task 1 实现报告：全景资产契约与加载器

## 状态

已完成。Task 1 新增了项目内水墨宇宙全景资产、质量档位资产契约与 Three.js 加载器；后续审查发现档位仅改变元数据而未改变实际下载资源，已在本任务中修正。

## 改动

- 新增 `src/universe/ink-panorama.mjs`：
  - `getInkPanoramaAsset(profile)` 按 quality profile 返回 URL、分辨率与 `worldSeed`。
  - `loadInkPanorama(THREE, profile)` 加载选定资源，配置 sRGB、mipmap、线性放大与横向重复；加载错误会以 Promise rejection 传递给调用方。
- 新增 `assets/images/ink-universe-panorama-v1.png`：3840×2160 的水墨宇宙原始全景图。
- 新增实际运行时资源：1024、1536、2048、3072 宽度的 performance、balanced、high、cinematic PNG。四档分别请求不同文件，因此下载、解码和纹理显存都会随档位降低；4K 原图保留在项目内作为源资产。
- 新增并扩展 `tests/universe-ink-panorama.test.mjs`：覆盖档位资源选择、纹理配置和加载失败传播。

## TDD 与验证

1. 初始 RED：`node --test tests/universe-ink-panorama.test.mjs` 报 `ERR_MODULE_NOT_FOUND`，因为加载器模块尚未创建。
2. 初始 GREEN：新增最小资产契约与加载器后，原始契约测试通过。
3. 审查 RED：质量档位测试断言不同档位必须选择不同 URL；旧实现失败，因为全部返回 `/assets/images/ink-universe-panorama-v1.png`。
4. 修复 GREEN：生成四档 PNG 并按 profile 映射后，`node --test tests/universe-ink-panorama.test.mjs` 通过 3 项测试、0 失败。

## 提交

- 初始 Task 1：`c0d2663`（`feat: add ink universe panorama asset`）。
- 质量档位修复将在当前审查修复提交中记录。

## 残余验证项

- 未进行浏览器内球壳无缝与真实运行时显存的视觉/性能验收；该验收属于计划的 Task 4。
