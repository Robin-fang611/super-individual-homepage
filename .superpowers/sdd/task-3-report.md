# Task 3 实现报告

## 状态

DONE_WITH_CONCERNS

## 结果

- 新增 `src/universe/flight-model.mjs`，实现创建飞行状态、指数加速/停止、斜向输入归一、最大 `1/60s` 内部固定子步和球形软边界。
- 边界仅衰减朝外径向速度，保留切向和向内分量；任何越界预测都投影回 `radius - epsilon`。
- 新增 `tests/universe-flight.test.mjs`，覆盖 10,000 个越界位置、2,000 组确定性随机全方向/大速度样本、切向/向内保留、斜向归一、停止吸附、极端速度和 30/60/120Hz 轨迹、释放、撞边一致性。
- 按主代理确认，将现有 `rotateVector` 最小改为具名导出，实现保持不变，以满足 Task 3 依赖契约；飞行模型实际导入该接口，未复制四元数逻辑。
- `stepFlight` 拒绝非有限或负 `dt`，防止无限循环与 NaN 状态污染；边界入口拒绝非有限值、`radius <= softStart`、`epsilon >= radius` 等无效配置。

## TDD 证据

### RED 1

Command: `node --test tests/universe-flight.test.mjs`

Result: exit 1，预期的 `ERR_MODULE_NOT_FOUND`，因 `src/universe/flight-model.mjs` 尚不存在。

### GREEN 1

Command: `node --test tests/universe-flight.test.mjs`

Result: 首轮 7 项中 6 pass、1 fail。失败原因是频率测试只把 `radius` 放大到 100，却沿用 `softStart=8.5`，意外让轨迹进入软边界。将夹具的 `softStart` 同步后移到 90 后 7/7 通过。

### RED 2 / GREEN 2

- 代码审查补充无效 `dt` 测试；首次运行在 11 项中 10 pass、1 fail，预期失败为未抛出 `RangeError`。
- 加入最小入口校验后，目标测试 11/11 通过。

### RED 3 / GREEN 3

- 上层要求补充无效边界配置测试；首次运行在 12 项中 11 pass、1 fail，预期失败为 `radius <= softStart` 未抛出 `RangeError`。
- 加入边界配置校验后，目标测试 12/12 通过。

## 最终验证

- `node --test tests/universe-flight.test.mjs`: exit 0，12 tests，12 pass，0 fail。
- `node --test tests/*.test.mjs`: exit 0，59 tests，59 pass，0 fail。
- `git diff --check`: exit 0，无输出。

## 提交

- SHA：`2224589`
- Message：`feat: add bounded first-person flight model`

## 顾虑

- brief 示例说由调用方拆分大 `dt`，但设计不变量要求大步长与 30/60/120Hz 结果也安全。实现因此在 `stepFlight` 内自主拆分为不超过 `1/60s` 的子步，这比示例更强，但极端大的有限 `dt` 会按比例增加计算量。
- 30/60/120Hz 测试的位置容差为 0.12 世界单位；速度衰减采用指数响应，但位置积分仍是固定子步下的半隐式积分，不追求不同步长下位置的逐位相等。

## 正式审查修复

### 状态

DONE_WITH_CONCERNS

### 改动

- `stepFlight` 对所有有限 `dt` 先截断到 `0.25s`，并把内部子步数硬限为 15；`Number.MAX_VALUE` 不再触发线性循环。
- 新增按最大绝对分量缩放的安全向量模长/归一，避免三轴 `Number.MAX_VALUE` 在 `hypot`、dot 和径向分解中溢出。
- `stepFlight` 在速度响应前后都限到 `config.maxSpeed`；`applySphericalBoundary` 使用基于 `radius / Number.EPSILON` 且带浮点硬上限的确定性安全速度，再进行 dot 和分解。

### TDD 证据

1. RED：`node --test --test-name-pattern="Number.MAX_VALUE velocity" tests/universe-flight.test.mjs`
   - exit 1；位置已回到球内，但速度含非有限值。
2. GREEN：加入安全模长与限速后，该用例 1/1 通过。
3. RED：对 `Number.MAX_VALUE dt` 用例加 1 秒外部闹钟保护运行，旧实现被超时终止（exit 142）。
4. GREEN：加入 `0.25s`/15 子步硬上限后，`Number.MAX_VALUE` 与 `0.25s` 返回结果一致，快速返回。

### 最终验证

- `node --test tests/universe-flight.test.mjs`: exit 0，14 tests，14 pass，0 fail。
- `node --test tests/*.test.mjs`: exit 0，61 tests，61 pass，0 fail。
- `git diff --check`: exit 0，无输出。

### 提交

- SHA：`2b54286`
- Message：`fix: bound extreme flight inputs`

### 顾虑更新

- 原报告中“极端大有限 `dt` 会按比例增加计算量”的顾虑已由 `0.25s`/15 子步硬上限消除。
- 仍保留原有 30/60/120Hz 位置积分容差顾虑：容差内一致，不承诺逐位相等。

## 正式审查第二轮修复

### 状态

DONE_WITH_CONCERNS

### 改动

- 移除 `applySphericalBoundary` 对整个 velocity 的预先限速，恢复“只削弱朝外速度”不变量。
- 通过 `maxAbs = max(|vx|, |vy|, |vz|, 1)` 将速度缩放到安全空间，再计算径向符号、切向与软边界增益。
- 软边界外、向内或径向量低于浮点容差时，原样返回 velocity；只有明确朝外时才在缩放空间衰减径向分量。
- 恢复到原尺度时逐分量做有限饱和；等于最大绝对分量的轴直接缩放为 `±1`，避免 `Number.MAX_VALUE` 切向轴往返换算丢失 1 ULP。
- 保留上轮 `stepFlight` 的 `0.25s`/15 子步硬上限和 `config.maxSpeed` 限速。

### TDD 证据

1. RED：`node --test --test-name-pattern="over-limit" tests/universe-flight.test.mjs`
   - 3 项全部失败；旧实现对超限纯切向、向内、朝外速度都做了整体限速。
2. GREEN 1：改为缩放空间分解后，纯切向与向内用例通过；朝外用例只剩切向轴恢复少 1 ULP。
3. GREEN 2：最大分量轴直接映射为 `±1` 后，3/3 直接回归通过。

### 最终验证

- `node --test tests/universe-flight.test.mjs`: exit 0，17 tests，17 pass，0 fail。
- `node --test tests/*.test.mjs`: exit 0，64 tests，64 pass，0 fail。
- `git diff --check`: exit 0，无输出。

### 提交

- SHA：`59d9bcd`
- Message：`fix: preserve extreme boundary velocity components`

### 顾虑更新

- 超限切向与向内速度现已严格原样返回；超限朝外速度返回全有限，且只衰减朝外分量。
- 仍保留 30/60/120Hz 位置积分容差顾虑：容差内一致，不承诺逐位相等。

---

# 水墨全景宇宙重做 Task 3 实现报告

## 状态

DONE

## 结果

- 将随机散布的精灵云改为 22 个确定位置的大尺度薄雾：前方、左上、远右三组均覆盖；性能档位的前 8 个也横跨三组。
- 保留 13 条墨河路径，其中第 2、6、10 条改用半透明 `TubeGeometry` 墨带，另 10 条仍是命名为 `FlyWhiteRiverEdge-*` 的克制细线。
- 墨旋仍维持 7 圈，移动到左后远处，避开初始入场主视线。
- 所有质量档位仍保留至少 8 个墨团、13 条河流路径及 7 圈墨旋；未改变背景、控制或部署代码。

## TDD 证据

### RED

Command: `node --test tests/universe-ink-world.test.mjs`

Result: exit 1；新增契约断言因源码没有 `TubeGeometry` 和 `InkRiverRibbon` 失败。

### GREEN

Command: `node --test tests/universe-ink-world.test.mjs`

Result: exit 0，5 tests，5 pass。

## 最终验证

- `node --test tests/*.test.mjs`: exit 0，90 tests，90 pass，0 fail。
- `git diff --check`: exit 0，无输出。

## 提交

- SHA：`af74455`
- Message：`feat: strengthen ink river and spatial masses`

## 顾虑

- 三维前景的最终构图和半透明层次仍需在浏览器中与全景穹顶一起做视觉验收；本任务只完成了可验证的前景结构与回归。

## 正式审查最终修复

### 状态

DONE_WITH_CONCERNS

### 改动

- 删除对正 `scaledRadialSpeed` 的 `RADIAL_TOLERANCE` 逻辑阈值。
- 现在只有 `scaledRadialSpeed <= 0` 才视为切向/向内；任何可表示的正径向量都会在软边界衰减，并在硬边界清除。
- 新增巨大切向 `Number.MAX_VALUE` 叠加 `1e292` 朝外速度的回归，同时验证软区衰减、硬边界清零、结果有限和切向相对保持。

### TDD 证据

1. RED：`node --test --test-name-pattern="tiny positive scaled outward" tests/universe-flight.test.mjs`
   - exit 1；软区中的正朝外分量被逻辑阈值忽略，未发生衰减。
2. GREEN：删除阈值、改为严格 `<= 0` 符号判断后，新回归与所有旧回归通过。

### 最终验证

- `node --test tests/universe-flight.test.mjs`: exit 0，18 tests，18 pass，0 fail。
- `node --test tests/*.test.mjs`: exit 0，65 tests，65 pass，0 fail。
- `git diff --check`: exit 0，无输出。

### 提交

- SHA：`eb467ad`
- Message：`fix: retain tiny outward boundary motion`

### 顾虑更新

- 任何可表示的正朝外分量现都不再被逻辑容差吞掉。
- 仍保留 30/60/120Hz 位置积分容差顾虑：容差内一致，不承诺逐位相等。
