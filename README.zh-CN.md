# deepseek-superagent-bench

> **非官方项目，与 DeepSeek 无隶属关系。** 项目名只用于标识它所测试的设计范式。
> 本仓库不包含 DeepSeek 的代码、Logo 或官方品牌素材。

一个可复现、默认离线、按 commit 钉住版本的**主动式超级 Agent 行为评测与一致性测试套件**。
它用合成事件驱动真实实现，覆盖直接请求、重复投递、越权发送者和重启恢复，然后报告
“实际观测到了什么”以及“没能测试什么”。

**状态：MVP（2026-11）。** 4 个核心场景、2 个真实被测实现，以及一个用于校验评测器本身的
fixture。这是行为矩阵，不是排行榜。评测语义见 [`docs/SPEC.md`](docs/SPEC.md)。

## 为什么做这个

主动式 Agent 很容易演示，却很难被信任。真正值得测试的失败往往不是“模型这句话写得不好”，
而是系统行为：

- 同一条 webhook 被投递两次，Agent 把同样的工作做了两遍；
- 不在允许名单里的发送者让 Agent 开始执行任务；
- 进程重启后，外部副作用被重放或重复；
- Agent 在不该出现的会话里发了消息。

这些行为可以在不接入真实模型、真实 GitHub 仓库或真实聊天账号的情况下被稳定验证。

## 核心场景

| ID | 场景 | 检查内容 |
|---|---|---|
| C1 | `direct-request` | 允许的用户直接请求；产生出站消息且不重复。 |
| C2 | `duplicate-delivery` | 同一个外部事件送达两次；工作和出站消息不重复。 |
| C5 | `unauthorized-sender` | 不在允许名单的发送者不触发工作、不产生回复、不创建工单。 |
| C7 | `restart-recovery` | 请求被接收后重启；不产生重复出站。不支持重启时报告 `not_tested`。 |

`fixture` 只用于校验评测器，不是产品，也不作为正式被测对象。

## 快速开始

环境：Node.js 22+、npm。默认套件不需要任何 API Key，也不需要访问外网。

```bash
npm install
npm run bench:fixture          # 离线运行 fixture，不需要被测仓库
```

运行真实被测实现时，把它们的 checkout 放在本仓库同级目录：

```text
workspace/
├─ deepseek-superagent-bench/   # 本仓库
├─ opensuperagent/              # thefullgc/opensuperagent
└─ deepseek-super-agent/        # LofiSu/deepseek-super-agent
```

然后执行：

```bash
npm run prepare:subjects       # 复制到 results/subjects 并安装依赖，不改动原仓库
npm run bench:core             # fixture + opensuperagent + lofisu，每个场景 3 次
```

产物：

- `results/latest/report.md`：人读的矩阵和逐项检查；
- `results/latest/report.json`：机器可读结果；
- `results/latest/traces/`：原始事件、出站消息、状态快照、mock 模型请求/响应、
  适配器日志。

等价 CLI：

```bash
npm run bench -- run --suite core --subjects fixture,opensuperagent,lofisu --repeats 3 --out results/latest
```

## 本地参考运行

以下是 2026-11-12 在本机（Node v22.14.0，Windows 11）执行 `npm run bench:core` 的结果，
每个场景重复 3 次。它用于证明端到端链路可复现，不是永久榜单；被测版本如下：

- opensuperagent `0.1.1`，commit `a9f9b7e`
- deepseek-super-agent (LofiSu) `0.1.0`，commit `e705e87`

| 场景 | fixture（校验器） | opensuperagent（黑盒） | lofisu（进程内） |
|---|---|---|---|
| C1 direct-request | pass 3/3 | pass 3/3 | pass 3/3 |
| C2 duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C5 unauthorized-sender | pass 3/3 | pass 3/3 | pass 3/3 |
| C7 restart-recovery | pass 3/3 | pass 3/3 | pass 3/3 |

C2 中三个实现都只产生 1 条出站消息和 1 个工单；C5 都是 0 出站、0 工单、0 次模型调用；
C7 重启后仍只有 1 条出站消息。完整逐项证据见本地生成的
`results/latest/report.md` 和 `results/latest/traces/`。

## 测什么，不测什么

只测可观察行为：

- 出站消息（正文、会话、数量）；
- 重复出站（同一会话 + 正文，或重复 id）；
- 适配器能暴露时的状态快照（工单、决策、eval）；
- 重启后的行为。

明确不测：模型质量、任务是否真正完成、延迟、成本、代码质量。默认套件使用脚本化
mock 模型和本地合成事件源，因此结果反映的是系统控制流和持久化行为，不代表真实模型
接入后的表现。

## 适配器契约

被测实现通过 `SubjectAdapter` 接入，实现在 `src/adapters/`：

```ts
interface SubjectAdapter {
  readonly id: string;
  readonly version: string;
  readonly commit: string;
  readonly mode: "black-box" | "in-process" | "fixture";
  readonly capabilities: ReadonlySet<Capability>;
  configureMockModel?(server: MockModelController): void;
  start(ctx: BenchContext): Promise<void>;
  inject(events: BenchEvent[]): Promise<void>;
  outbound(): Promise<Outbound[]>;
  snapshot?(): Promise<StateSnapshot>;
  restart?(): Promise<void>;
  stop(): Promise<void>;
  getLogs?(): string[];
}
```

能力决定断言是否可评测：缺少任意一个场景所需能力时，整个场景报告为 `not_tested`，
不会因为“观测不到”而失败。适配器模式、被测 commit/version 会写入每一份报告。

新增被测实现的最小步骤：

1. 在 `src/adapters/` 新增适配器，声明准确的能力集合；
2. 在 `src/adapters/index.ts` 注册 id；
3. 在 `scripts/prepare-subjects.mjs` 增加准备逻辑；
4. 运行 `npm run bench -- run --subjects <id> --repeats 1 --out results/<id>-smoke`；
5. 提交报告片段和复现命令。不要修改被测仓库，不要把被测业务代码复制进本仓库。

## 公平性与限制

- **没有总冠军。** 结果是逐场景的；一个实现可以通过 C1 但失败 C2。
- **合成输入。** mock 模型是脚本化的，事件源是本地构造的；真实模型可能表现不同。
- **MVP 覆盖窄。** 只有 4 个场景；飞书、官方原型适配、真实投递重试不在 MVP 内。
- **进程内抓取不等于真实投递。** 对进程内被测对象，出站可能来自持久化 outbox，
  包含尚未被真实渠道适配器投递的消息；报告会披露适配器模式。
- **重启时序。** C7 在当前 MVP 中是在首轮工作 settle 之后重启，验证的是持久状态和
  非重放，不是进程中途硬崩溃恢复。
- **通过不等于生产可用。** 它只表示该次运行、该 commit 下，这些可观察断言成立。
- **Flaky 是结果。** 多次重复不一致会标记为 `flaky`，不会被平均掉。

## 项目结构

```text
scenarios/core/        C1/C2/C5/C7 场景定义
src/adapters/          fixture、opensuperagent、lofisu 适配器
src/mock-model/        OpenAI-compatible 脚本化 mock 模型
src/runner.ts          生命周期、settle、repeat 聚合、trace
src/assertions.ts      能力门控与行为断言
src/report.ts          JSON / Markdown 报告
test/                  场景、评测器、mock 模型、fixture 测试
docs/SPEC.md           评测语义与场景规范
docs/REFERENCES.md     设计来源与外部资料
```

## 被评测项目与致谢

- [opensuperagent](https://github.com/thefullgc/opensuperagent) — Apache-2.0。
- [deepseek-super-agent](https://github.com/LofiSu/deepseek-super-agent) — MIT。
- 官方 [`dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype)
  是设计语义来源，不是 MVP 被测对象。

本项目不 fork、不复制被测仓库的业务代码；只通过公开接口或固定版本的本地接口驱动它们，
并在结果中钉住 commit。

## English

See [README.md](README.md) for the English version.

## License

MIT，见 [LICENSE](LICENSE)。第三方名称与代码仍适用其各自许可。
