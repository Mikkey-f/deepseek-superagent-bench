# SuperAgent Bench — v0.1 实施计划

> **工作名**：`superagent-bench`
> **定位**：面向主动式 Super Agent 的可复现行为评测与一致性测试套件
> **状态**：2026-11-12 起实施；bench 先行，v0.1-lite 时间盒至 2026-12-07
> **目标版本**：v0.1.0-lite — 5–7 个核心场景 × 2 个稳定被测对象 + 可复现报告
> **许可**：MIT（代码、文档、场景）
> **项目负责人**：你（owner / 第一作者）
> **实现方式**：Claude Code 辅助开发，按里程碑 review
>
> **跨会话接手**：新会话先读 [`STATUS.md`](STATUS.md) 和 [`CLAUDE.md`](CLAUDE.md)，再按本计划继续。每次实质性会话结束前更新 `STATUS.md`。

> **2026-11-12 MVP fast track**：owner 决定 bench 改名
> `deepseek-superagent-bench`，先做 **2–3 天 MVP** 抢开源流量；runtime 项目暂停。
> MVP 范围：**2 个被测对象 × 4 个场景**（opensuperagent、LofiSu；C1 直接请求、
> C2 重复投递、C5 未授权、C7 重启恢复）+ fixture；端到端 report、CI、PR 工作流。
> 5 周计划保留为 MVP 之后的 roadmap；官方原型适配器、HTML 报告、Docker 镜像、
> 90 秒视频推迟到 v0.2。MVP 的验收标准和每日门禁见 [`STATUS.md`](STATUS.md)。

---

## 0. 完成定义（Definition of Done）

v0.1.0 只有同时满足以下条件才算完成：

- [ ] `npx superagent-bench run --suite core` 在干净机器上可运行，**无需 API key、无需真实 GitHub/Feishu、无需外网**。
- [ ] 7 个核心场景 × 2 个被测对象（opensuperagent、LofiSu），同一版本连续 3 次运行结果一致。
- [ ] 官方原型作为实验性适配器接入；成功则进入报告，失败则明确记录 blocker，**不阻塞发布**。
- [ ] 输出 JSON + Markdown + 原始 trace；报告包含被测版本/commit、adapter 模式、指标、未测能力和局限。
- [ ] 中英 README、场景规范、适配器指南、结果报告、CI 全绿。
- [ ] npm 包 + GitHub Release v0.1.0 + 90 秒演示 + 首篇中文对比文章。
- [ ] 不 fork、不复制被测仓库的业务代码；不发布未经协调的安全问题。

---

## 1. 范围

### 1.1 In scope（v0.1）

- 场景规范 v0.1（YAML + JSON Schema）
- 确定性 mock 模型（OpenAI-compatible，脚本化，不调用真实 LLM）
- 事件注入 + 出站捕获 + 故障注入（重复、超时、重启）
- Runner、断言、指标、JSON/Markdown/HTML 报告
- Adapter：opensuperagent（黑盒 HTTP）、LofiSu（进程内 Runtime）、官方原型（实验性）
- CI、npm 包、Docker 镜像（Docker 为 P1）
- 中英双语文档与首份对比报告

### 1.2 Out of scope（v0.1 不做）

- 不实现新的 Agent runtime / Web UI / 渠道
- 不在 CI 中调用真实模型或真实 GitHub/Feishu
- 不做“综合排行榜”或单一总冠军
- 不做渗透测试、DoS、越权攻击；安全场景只做良性的行为断言
- 不修改被测仓库；适配器只通过其公开接口或固定版本的驱动脚本接入
- 不做飞书渠道（v0.2）、不做审批/上下文外溢等高级场景（v0.2）

---

## 2. 架构与接口

### 2.1 数据流

```text
Scenario (YAML)
        │
        ▼
   Runner ─────────────────────────────┐
        │                              │
        ▼                              ▼
 Subject Adapter ──► 被测实现 ──► Mock Model / Mock Source
        │                              │
        ▼                              ▼
 Outbound capture ◄────────────── 真实出站
        │
        ▼
 Assertions + Metrics ──► JSON / Markdown / HTML 报告 + raw trace
```

### 2.2 仓库结构

```text
superagent-bench/
├─ docs/
│  ├─ why.md                 # 为什么做这个评测
│  ├─ SPEC.md                # 场景规范 v0.1
│  ├─ adapters/              # 各被测对象接入说明
│  ├─ RESULTS.md             # 结果与局限
│  ├─ FAIRNESS.md            # 公平性、披露与署名政策
│  └─ REFERENCES.md          # 资料与依赖
├─ schemas/
│  └─ scenario.schema.json
├─ scenarios/
│  └─ core/                  # C1–C7
├─ src/
│  ├─ cli/
│  ├─ runner/
│  ├─ mock-model/
│  ├─ mock-source/
│  ├─ adapters/
│  │  ├─ opensuperagent/
│  │  ├─ lofisu/
│  │  ├─ official/
│  │  └─ fixture/            # 仅用于验证评测器本身
│  ├─ score/
│  ├─ report/
│  └─ types.ts
├─ test/
├─ results/
├─ .github/workflows/ci.yml
├─ Dockerfile
├─ LICENSE
├─ README.md
└─ README.zh-CN.md
```

### 2.3 核心接口（草案）

```ts
export type AdapterMode = "black-box" | "in-process";

export type Capability =
  | "state-snapshot"
  | "restart"
  | "ticket-count"
  | "eval-count"
  | "token-metrics"
  | "tool-calls"
  | "approval"
  | "watchdog";

export interface SubjectAdapter {
  readonly id: string;
  readonly version: string;
  readonly commit: string;
  readonly mode: AdapterMode;
  readonly capabilities: ReadonlySet<Capability>;
  start(ctx: BenchContext): Promise<void>;
  inject(events: BenchEvent[]): Promise<void>;
  outbound(): Promise<Outbound[]>;
  snapshot?(): Promise<StateSnapshot>;
  restart?(): Promise<void>;
  stop(): Promise<void>;
}
```

### 2.4 确定性规则

- 默认使用脚本化 mock 模型，不依赖真实模型；真实模型仅作为可选 `--live` 模式。
- 断言只针对可观察行为与稳定的计数/时序，不断言模型原文。
- 固定临时目录、端口从环境注入；支持并行运行时的端口隔离。
- 超时、批量窗口、Watchdog 间隔通过环境变量缩短，但保持语义。
- 每个场景默认跑 3 次，要求结果一致；不稳定场景标记 `flaky` 并降级为 `not_tested`。
- 不访问真实网络；任何外联都被 mock source / adapter 拦截并记录。

---

## 3. 工作分解（WBS）

> 状态图例：`[ ]` 未开始 · `[x]` 完成 · `[!]` 时间盒/风险项
> 估算单位：人日（AI 辅助下的实现时间，含测试）

### M0 项目基础（Week 1，约 3 人日）

- [ ] **P001** 新建仓库 `superagent-bench`，MIT LICENSE、`.gitignore`、README 骨架（中英）
- [ ] **P002** TypeScript + Node 22 + pnpm + tsx + Vitest + ESLint/Biome；`typecheck/test/build`
- [ ] **P003** GitHub Actions：Linux 上 typecheck/test/build；Windows 本地 smoke 脚本
- [ ] **P004** `docs/SPEC.md` + `schemas/scenario.schema.json`：事件、断言、limits、capability gating
- [ ] **P005** `docs/REFERENCES.md`：资料、依赖、需要用户提供的内容
- [ ] **P006** `src/types.ts`：`BenchEvent`、`Outbound`、`SubjectAdapter`、`Capability`
- [ ] **P007** trace 与 result JSON 模型：版本、subject、scenario、metrics、status、notes

**验收**：`pnpm typecheck && pnpm test` 绿；SPEC 可被 Zod 校验；接口评审通过。

### M1 Mock 环境 + Runner（Week 1，约 5 人日）

- [ ] **P010** Mock OpenAI-compatible 模型：脚本化响应、tool calls、延迟/挂起、记录 calls/tokens
- [ ] **P011** Event injector + outbound capture：GitHub/Webhook 两种驱动；重复投递
- [ ] **P012** Runner：YAML 加载、步骤调度、超时、清理、3 次重复运行
- [ ] **P013** 断言与指标：work items、outbound、首次回复、模型调用、重复项、恢复耗时
- [ ] **P014** CLI：`run` / `list` / `validate`；`--subject`、`--scenario`、`--json`
- [ ] **P015** Fixture adapter：只验证评测器，不是产品；提供一个最小可测对象
- [ ] **P016** C1 `direct-request` + C2 `duplicate-delivery`
- [ ] **P017** 报告生成器：JSON + Markdown；原始 trace 落盘

**验收**：fixture 对象连续 3 次通过 C1/C2；无网络；报告可读。

### M2 opensuperagent 适配（Week 2，约 5 人日）

- [ ] **P020** 版本钉住；临时 data root/端口；provider baseUrl 指向 mock 模型
- [ ] **P021** 签名 webhook 注入（`/hooks/webhook`）；重复投递支持
- [ ] **P022** 回调 URL 捕获出站；`/api/tasks`、`/api/tasks/:id`、`/api/overview` 快照
- [ ] **P023** C3 `thread-burst-batching`、C4 `noise-suppression`、C5 `unauthorized-sender`
- [ ] **P024** 报告增加 subject 元数据与 adapter 模式
- [ ] **P025** 适配器文档 + 故障排查

**验收**：5 个场景通过；3/3 一致；不访问真实网络。

### M3 LofiSu 适配（Week 3，约 5 人日）

- [ ] **P030** 进程内适配：`Runtime.create({ home, model, now, batchWindowMs, admission })` + `ingest`
- [ ] **P031** 从 SQLite outbox/store 观测结果；scripted model 注入
- [ ] **P032** 重启模拟：销毁并重建 Runtime（同一 home），验证不重放/不重复
- [ ] **P033** C6 `concurrent-threads`、C7 `restart-recovery`
- [ ] **P034** 跨实现报告 + adapter 模式/公平性说明
- [ ] **P035** 适配器文档

**验收**：7 个场景 × 2 个对象；3/3 一致；原始 trace 可复查。

### M4 官方原型适配（Week 4，时间盒 3 人日）[!]

- [ ] **P040** Spike：用官方 `Runtime` + fake DSH host 跑通一个触发（1 天）
- [ ] **P041** Spike 成功则接 C1–C3；失败则记录 blocker + v0.2 roadmap
- [ ] **P042** Capability gating：未暴露的能力输出 `not_tested`，不判负
- [ ] **P043** 适配说明：版本固定、内部 API 风险、升级策略

**验收**：成功则作为 beta 进入报告；失败则文档化，不阻塞 v0.1。

### M5 报告与发布（Week 4–5，约 5 人日）

- [ ] **P050** 静态 HTML 报告（P1）
- [ ] **P051** `results/v0.1/`：summary、raw traces、复现命令、环境说明
- [ ] **P052** 中英 README：why、quickstart、matrix、limitations、non-goals、non-official 声明
- [ ] **P053** npm 包（P0）+ Docker 镜像（P1）
- [ ] **P054** 90 秒演示视频/GIF：一条命令跑出矩阵 + 一个失败场景
- [ ] **P055** 首篇中文对比文章 + 英文 post
- [ ] **P056** GitHub Release v0.1.0
- [ ] **P057** `FAIRNESS.md`：公平性、被测方回应窗口、负责任披露、署名

**验收**：干净机器一条命令跑通；发布完成；报告与复现命令可访问。

### M6 v0.2 候选（不承诺，按反馈排序）

- [ ] 高级场景：approval、worker isolation、context spill、speculative gate
- [ ] 飞书渠道 mock 与同一套场景
- [ ] delivery retry（出站失败重试且不重复）
- [ ] Adapter SDK 与第三方接入指南
- [ ] Conformance 徽章（SAB-Core / SAB-Safe）与历史趋势
- [ ] `--live` 模式：真实模型 + 方差/成本统计
- [ ] 由公测反馈决定的其他场景

---

## 4. 里程碑与排期

| 周 | 里程碑 | 主要交付 | 风险 |
|---|---|---|---|
| Week 1 | M0 + M1 | 仓库、SPEC、mock 环境、runner、fixture、C1/C2 | 低 |
| Week 2 | M2 | opensuperagent 适配、C3–C5、第一份真实矩阵 | 中 |
| Week 3 | M3 | LofiSu 适配、C6/C7、跨实现报告 | 中 |
| Week 4 | M4 + 发布准备 | 官方适配 spike、README、npm、结果页 | 官方适配为高风险 |
| Week 5 | 缓冲 + 发布 | v0.1.0、演示、文章、修复 | 低 |

**估算**：约 20–24 人日（含测试与文档）。全职 4–5 周，业余 8 周左右。官方适配器是唯一可能拖期的部分，已用时间盒隔离。

**每周节奏**：周一确认目标 → 周三中期检查 → 周五交付 + 你来 review。每个里程碑都产出可运行的东西，不做“最后一次性集成”。

---

## 5. 参考资料与外部依赖

详见 [`docs/REFERENCES.md`](docs/REFERENCES.md)。摘要：

### 我已拥有的

- 官方原型源码与 `docs/000–008`（本地）
- LofiSu 源码、README、`docs/BAKEOFF.md`、Runtime 接口（本地）
- opensuperagent 源码、HTTP API、webhook adapter（本地）
- 三个仓库的 commit、版本、测试结构（已核对）

### 需要补充获取的

- DeepSeek Harness（DSH）公开源码/文档：用于官方适配器
- OpenAI Chat Completions / function calling 规范：mock 模型
- GitHub REST API / webhook 事件格式：mock source
- 基准设计参考：SWE-bench、Web Platform Tests、AgentBench、τ-bench 等
- 安全与披露：OWASP LLM Top 10 / agentic AI 安全指南

### 需要你提供的（不阻塞 Week 1）

- [ ] GitHub 账号或组织名（发布仓库用）
- [ ] npm scope（如果没有，先用个人 scope）
- [ ] 可选的 DeepSeek API key（仅 `--live` 模式验证，不用于 CI）
- [ ] 可选的测试 GitHub 仓库 / 飞书测试应用（v0.2 黑盒渠道验证）
- [ ] 每周 review 的时间窗

**不需要**：付费数据集、私有模型、真实用户数据、特殊硬件。v0.1 全部使用合成场景。

---

## 6. 难点与风险

| ID | 难点/风险 | 影响 | 对策 | 信心 |
|---|---|---|---|---|
| D1 | 三个实现的概念/接口不同（Ticket vs task vs Run） | 断言不公平、适配器特判过多 | 统一事件/结果模型；只断言可观察行为；capability gating | 高 |
| D2 | Agent 循环不确定，mock 模型难驱动 | 结果不稳定、报告不可信 | 脚本化模型；注入 clock/batch 窗口；3 次一致性；失败标 flaky | 高 |
| D3 | 官方原型依赖 DSH alpha 内部 API | 适配器可能做不完 | 3 天时间盒；实验性标记；不阻塞 v0.1；v0.2 再做黑盒 | 中 |
| D4 | Bench 的公平性/权威性 | 被实现方质疑、无人引用 | 公开场景与 raw trace；被测方 7 天回应窗；不做单一总冠军；署名与披露政策 | 中 |
| D5 | Windows/Linux 差异 | 计时、路径、端口、SQLite 行为不一致 | Linux CI + Windows 本地 smoke；Docker；固定端口注入 | 高 |
| D6 | 范围蔓延（50+ 可能场景） | 永远发不出 v0.1 | 冻结 7 个核心场景；其余进 v0.2 候选 | 高 |
| D7 | 被测仓库 API 漂移 | 适配器失效 | 版本/commit 钉住；adapter 自检；升级单独 PR | 中 |
| D8 | 场景可能暴露真实安全问题 | 社区关系/法律风险 | 先私下协调，修复后再公开；报告中标注状态 | 高 |

**总体判断**：写代码不是主要难点；**难在让评测结果可信、可复现、公平**。这也是这个作品的价值所在——它要求的是判断力、规范设计和工程纪律，而不是堆功能。

**信心估计**：
- 2 个被测对象 + 7 个场景 + 报告，4–5 周内完成：**85%**
- 官方原型在时间盒内接入：**50–60%**（失败不影响发布）
- 第 5 周末发布 v0.1.0：**90%**

---

## 7. 第一周 Day 1–3 交付物

- **Day 1**：P001–P003（仓库、工具链、CI）+ P004 的 SPEC 骨架
- **Day 2**：P010 mock 模型 + P011 事件/出站捕获 + P015 fixture adapter
- **Day 3**：P012–P014（runner、断言、CLI）+ C1 场景；给你一个可运行的演示
- **周末**：P016/P017（C2、报告）+ 中期 review

---

## 8. 已确认的决策

| 决策 | 结论 |
|---|---|
| 工作名 | `superagent-bench`（发布前做一次名称/商标冲突检查） |
| v0.1 范围 | 7 个核心场景 + 2 个稳定对象 + 官方实验性适配 |
| CI 网络/模型 | 默认完全离线，mock 模型；`--live` 仅本地可选 |
| 排名方式 | v0.1 输出矩阵与维度分，不做单一总冠军 |
| 许可 | MIT（代码/文档/场景） |
| 文档语言 | 中英双语，中文优先 |
| 与官方关系 | 非官方项目；只引用设计思想；不使用 DeepSeek 商标命名 |
| 被测仓库关系 | 不 fork、不修改；适配器独立；版本钉住 |

---

*本计划是执行清单，不是宣传文案。任何范围变更先改本文件，再改代码。*
