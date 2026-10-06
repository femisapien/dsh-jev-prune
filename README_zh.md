# dsh-jev-prune

![dsh-jev-prune —— 用 Jev 判断驱动 DeepSeek Harness 的上下文压缩](assets/banner.png)

**Jev-judged context compaction for DeepSeek Harness.**
用 [TypeSafe Jev](https://typesafe.ai) 的结构化判断驱动 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的两层上下文压缩。压缩算法不改动，判断后端可插拔（Jev / 规则 / 自托管模型）。

[English](README.md) · **简体中文**

![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node%20%3E%3D22.19-339933) ![dsh](https://img.shields.io/badge/DSH-0.1.x--rc-orange) [![CI](https://github.com/yangyu666/dsh-jev-prune/actions/workflows/ci.yml/badge.svg)](https://github.com/yangyu666/dsh-jev-prune/actions/workflows/ci.yml) ![smoke checks](https://img.shields.io/badge/smoke%20checks-127%20passing-success) [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yangyu666/dsh-jev-prune)

## 它解决什么问题

DSH 自带的上下文回收是**纯体积**的：工具结果超过阈值就掐中间留头尾；区域压缩则让模型**写一段摘要**顶替旧历史。前者不认识"这条很大但后面还要用"，后者会引入摘要幻觉。

本插件把这两处的判断都换成 Jev 的结构化输出（noul / choice，返回校准概率），并定了一条设计底线：

> **不该由模型生成的内容，就不让模型生成。** 裁剪只做留/删判断，原文逐字保留；区域压缩注入由代码生成的**确定性回执**，不含任何模型推断。

## 两层机制

![两层机制：结果裁剪与回执压缩](assets/two-layers.png)

| 层 | 接管点 | DSH 默认行为 | 本插件 |
|---|---|---|---|
| **1 · 结果裁剪** | `ctx.toolResultPruner.pruneSession` | 超过 `thresholdChars` 掐中间 | Jev 判定每个工具结果「接下来还要不要」，要的**再大也不裁**，过期的**再小也裁**（短于 `minCharsToPrune` 的除外）；无判定时退回 DSH 原生行为 |
| **2 · 回执压缩** | `ctx.compaction.summarize` + `compactRegion`；混合批次则做单结果 surface 替换 | 模型读原历史、写摘要 | 全部合格的只读步骤整段移出；并行批次只有部分结果合格时，保留全部调用/结果外壳，只把合格结果正文换成**确定性回执**。工具名、命令、路径、字符数、seq 全由代码算出 |

第二层的回执长这样：

```
[已压缩 · 确定性回执] 原历史 s25–s27 是 1 次工具调用（共约 16489 字符输出），
为释放上下文已移出。以下为事实清单（工具名/入参/字符数/seq 由代码算出；模型原话逐字引用，不含任何推断）：
· s25 模型原话（逐字引用）：identifiers：把版本字符串拆成标识符。Next inc.js.
· s27 read：C:\Users\you\project\src\state.js → 16489 字符输出
原始事件仍完整保存在会话日志中（seqs 25–27）。需要内容时重跑相同命令/读取相同文件即可；本回执不含对内容的解释。
```

并行工具批次按每一对 call/result 独立判定。DSH 0.1.5 只能原子替换一个 surface 节点，或替换一个配对平衡的连续区间，不能从同一条 6-call assistant 消息里一次抽走其中 5 对。因此遇到混合批次时，插件使用 DSH 原生的单节点 `replace` 协议，把每个合格 `tool/result` 的正文换成短回执；不合格及最近区结果逐字保留，assistant 头不改，每次替换前后工具配对都完整。call 与 result 按 `callId` 匹配，允许并行结果以不同顺序完成。整批全部合格时仍走 `compactRegion`，移出整个平衡步骤。

## 实测数据

以下数字来自一次三臂对照测量，任务是在 `semver@6e05b76` 上执行一个 **37 步"逐个读取目录下每个文件"** 的长任务：**A** = 原样 DSH（基线），**B** = 插件 + `compactReceipts: false`（仅第一层），**C** = 插件默认（两层全开）。每个数字都取自 DSH 会话日志里 **API 实际返回的 `usage`** —— 评分不使用任何估算器。

**第一层在每次长任务运行里都动作；基线从不动作。** 插件两臂的每一次长任务运行都有第一层裁剪发生（每次 4–7 个节点；A 臂按定义为 0），短/中/长三类任务上三臂的答案全部正确。

**长任务：全价输入只剩零头。** 每次完成的 37 步运行中，未命中（全价）输入 token：基线 75,781–87,872，完整插件 25,516–45,071 —— 同等任务量下约为基线的三分之一。必须分项报告 token：输入的缓存命中占比很高（78–94%），且命中/未命中单价相差约 50 倍，**用总 token 数比较会系统性误导**。

**破坏性压缩更少 —— 其中一部分由回执替代。** 每次完成的长任务运行里，DSH 自身发起的**模型摘要**压缩从基线的 31–40 次降到完整插件下的 15–23 次，其中 **6–8 次被代码渲染的确定性回执替代**。第二层在短/中任务上**有意保持静默** —— 它的门控要求一段连续合格的只读步骤 —— 所以那些负载上的收益来自第一层。即便第二层触发，DSH 自行发起的压缩仍然存在并回退为模型摘要：**插件减少它们，而不是消灭它们**。

**一个我们主动发现并修复的失效模式。** 回执替换的是整段「调用 + 结果」，其中包含承载它的 assistant 消息；一次长任务运行中，模型自己的中间记录被逐步抹掉（13 条只剩 1 条），随后它停止发起工具调用。现在回执会**逐字带上该步 assistant 的可见文本**（只取 `text` 块、排除 `reasoning` 草稿、零模型生成；长度由 `receiptTextChars` 约束，默认 400，设 `0` 关闭）。修复后，同一长任务在每次运行中都完成且答案正确。

[测量说明与适用边界](docs/measurements.md)

## 门控（第二层）

整对移出是破坏性动作，默认非常保守，需同时满足：

- **两轴判定取交集**：`result`（内容是否还需要）与 `effect`（调用是否改变了会话外状态）各自落在本次会话的尾部 `compactQuantile` 分位内
- 工具不在 `neverCompactTools`（改写类调用按硬规则永不移出）
- **证据守卫**：结果命中 `error` / `assert` / `fail` / `todo` 等词不移出；若第一层已经截断结果，守卫会沿 `sourceEventSeqs` 继续扫描原始事件
- assistant 消息的**可见文本**超过 `maxStepTextChars`、或**思考草稿**（`reasoning`）超过 `maxStepReasoningChars` 的步骤不移出。两者**分开统计**：text 长说明这一步在交代结论（该守），reasoning 长只是模型草稿写得多（不代表有承重信息）。合并成一个预算时，光靠 reasoning 长度就能把第二层静默关掉
- 第二层不移出最近 `compactPreserveRecent` 个节点（第一层仍使用 `preserveRecent`）
- 区间两端满足 DSH 的工具配对平衡；整段至少能省 `compactMinChars` 字符；回执 token 低于原内容的 `receiptMaxRatio`

概率的使用方式是**相对分位**而不是固定阈值：判断型小模型的输出分布很窄，只有同一会话内的相对排序携带稳定信息。

**小总体降级。** 只读工具在写/执行密集的会话里常常只占少数（实测只读 1/6），此时分位总体可能只有两三条——排序没有意义。这种情况**不是直接放弃**，而是降级为绝对下限模式：要求两轴**同时**低于 `floorThreshold`（默认 `0.2`，比 `compactThreshold` 明显更严，用来补偿"没有相对信息"这个缺口）。若样本连 `minCandidatesForFloor`（默认 2）都不到，则仍然不做——单条谈不上分布。该默认值由 3 降为 2，是为了让批量读会话实际产生的"两条候选"不再被整体跳过；单条仍然永不动作。降级发生时会在报告与心跳里给出说明，不会静默发生。

## 安装与快速开始

**版本说明：** DSH 0.2.0-rc.2 请使用 0.1.1，它支持根级和 preset 内服务，已通过真实 CLI 安装与激活；旧的 0.1.0 会被该宿主拒绝。[兼容性证据与滚动验证](docs/compatibility.md)。

要求 Node `^22.19.0 || >=24.0.0`；针对 **DSH 0.1.5-rc.2** 验证。profile 需要基础裁剪、压缩与 tokenMeter 服务。启动 DSH 前在环境中设置 `TYPESAFE_API_KEY`。

固定版本安装：

```bash
dsh plugin --profile web add dsh-jev-prune@0.1.1
# GitHub 安装方式：
dsh plugin --profile web add github:yangyu666/dsh-jev-prune#v0.1.1
```

本地开发：

```bash
git clone https://github.com/yangyu666/dsh-jev-prune.git
cd dsh-jev-prune
git checkout v0.1.1
npm ci
npm run check
npm run smoke
dsh plugin --profile web add link:/absolute/path/to/dsh-jev-prune
```

无 pnpm 的手动接线：`node scripts/wire_profile.mjs <DSH_HOME> <profile名>`。升级宿主后执行 `jev_probe_shapes` 核对事件结构。

## 配置

先在 profile 的插件条目中开启 dry-run：

```yaml
- id: jev-prune
  config:
    dryRun: true
    judgeOn: pressure
    softLimit: "55%"
    compactReceipts: true
    compactOn: pressure
    compactSoftLimit: "70%"
```

检查 `/jev` 的判定和排除原因后，设为 `dryRun: false` 执行压缩。

| 配置 | 默认 | 用途 |
|---|---|---|
| `keepMode` | `budget` | 候选按概率排序，预算随上下文压力变化。 |
| `preserveRecent` / `compactPreserveRecent` | `4` / `1` | 两层独立的最近节点保护。 |
| `headChars` / `tailChars` | `600` / `200` | 第一层逐字保留的头尾长度。 |
| `compactQuantile` | `0.34` | 两轴尾部分位取交集。 |
| `compactTools` | 只读白名单 | 限制可压缩的工具配对。 |
| `receiptTextChars` | `400` | 限制回执里的助手可见原话长度。 |
| `dryRun` | `false` | 只判定、报告，不执行压缩。 |

[完整配置与压力门说明](docs/implementation.md#configuration) · [配置示例](examples/minimal.yml)

## 会话内使用

| 入口 | 用途 |
|---|---|
| `/jev` 命令、`jev_prune_status` 工具 | 两层账本：判定缓存、累计节省、接管状态、工具名索引 |
| `jev_prune_now` | 手动触发一次第一层裁剪 |
| `jev_compact_now`（支持 `dryRun`） | 手动触发一次第二层回执压缩，逐条列出每个门控的排除计数与回执全文 |
| `jev_restore` | 安全阀：取回某个 checkpoint 移出 surface 的原始文本（只读） |
| `jev_probe_shapes` | 打印真实事件形状与工具名解析结果，用于适配不同 DSH 版本 |

正常情况下两层都由上下文压力自动驱动，无需手动介入。

## Demo

![确定性演示录制](assets/demo.gif)

录制运行真实插件的 `apply()`、注册工具与替换路径，使用模拟 DSH 宿主和固定判定概率。依次展示裁剪、保留高分结果、生成回执和读取区域检查点原文。它不代表真实 Jev 判断质量，也不能证明真实宿主端到端兼容。

[回放、断言与重新生成](demo/README.md) · [原始演示记录](assets/demo.json)

## 限制与数据处理

- 在线判定会将历史、路径、代码片段和命令输出发送至 TypeSafe，并增加判定成本与延迟。
- CI 验证纯函数、模拟宿主行为和锁定宿主依赖树的模块加载；尚不覆盖真实 DSH 会话端到端执行。
- 当前源码将回执绑定到异步事务，并核对所选区间的实际消息；外部、取消或输入不匹配的摘要回退宿主。已发布的 0.1.0 仍使用旧机制。[架构说明](docs/ARCHITECTURE.md)
- 当前源码在最近三条用户指令变化时使结果判断失效，保留副作用判断，并丢弃旧目标的在途响应。第一层小样本降级仍可能在压力比例为零时裁剪。
- `jev_restore` 只查区域摘要检查点，每个事件最多返回 4,000 个 UTF-16 单元，尚不能直接解析第一层或逐结果替换的 ID。原始事件仍保存在日志中。

## 目录与开发

```text
index.js              插件入口（保持原安装契约）
src/                  判定、裁剪、回执与事件转换
test/                 自检与模拟宿主测试
scripts/              安装接线及离线会话检查工具
docs/                 架构、配置、移植和发布说明
demo/                 可复现演示与渲染脚本
assets/               图解及演示录制
examples/             profile 配置示例
```

```bash
npm run check
npm run smoke
npm run coverage
npm run demo
```

[贡献指南](docs/CONTRIBUTING.md) · [架构](docs/ARCHITECTURE.md) · [移植契约](docs/PORTING.md) · [发布说明](docs/RELEASING.md) · [变更记录](CHANGELOG.md)

[MIT](LICENSE)
