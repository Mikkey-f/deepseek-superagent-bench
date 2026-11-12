# 主动式 Super Agent 的行为评测：从“能跑”到“能被信任”

> 一个评测器最重要的能力，不是让所有实现都通过，而是能证明自己会判负。
>
> **非官方项目，与 DeepSeek 无隶属关系。** 这里测试的是主动式 Agent 的设计范式；
> 仓库不包含 DeepSeek 的代码、Logo 或品牌素材。

## 为什么又做一个 Agent 评测

主动式 Agent 的 demo 很容易做：收到一条消息，创建一个任务，调用模型，回复用户。
真正难的是让它在边界条件下仍然可被信任：

- 同一条 webhook 被投递两次，Agent 会不会把工作做两遍？
- 两个相同的投递同时到达，去重还成立吗？
- 不在允许名单里的发送者，能不能让 Agent 开始执行任务？
- 进程在工作进行到一半时重启，外部副作用会不会被重放？
- Agent 会不会在错误的线程里回复？

这些问题不是“模型这句话写得好不好”，而是系统控制流、持久化和授权行为。
它们可以在不调用真实模型、不连接真实 GitHub/飞书的情况下稳定复现。

`deepseek-superagent-bench` 就是为此做的：一个可复现、默认离线、按 commit
钉住被测版本的**行为评测与一致性测试套件**，不是另一个 Agent runtime，也不是
排行榜。

## 我们测什么，不测什么

只测可观察行为：

- 出站消息的线程、正文、数量和重复情况；
- 适配器能暴露时的工单、决策、assignment 等状态快照；
- 重启前后的持久状态变化；
- 某些场景下的模型调用次数。

明确不测：模型质量、任务是否真正完成、延迟、成本、代码质量。默认套件使用脚本化
mock 模型和本地合成事件，因此结果反映的是系统行为，而不是“接上真实模型之后会怎样”。

## 六个核心场景

| ID | 场景 | 断言 |
|---|---|---|
| C1 | 直接请求 | 允许用户请求后产生出站，不重复 |
| C2 | 顺序重复投递 | 同一事件送达两次，仍只有 1 个工单、无重复出站 |
| C3 | 并发重复投递 | 两次投递在 `inject()` 边界重叠，仍只有 1 个工单 |
| C4 | mid-flight 重启 | 工作活跃时重启，恢复后不重复工作/出站 |
| C5 | 未授权发送者 | 不创建工单、不回复、不产生未授权线程出站 |
| C7 | settle 后重启 | 首轮工作完成后重启，持久状态不重放 |

每个场景都要声明自己需要哪些能力。如果适配器无法观测某个行为，整个场景报告为
`not_tested`，而不是判负。这条规则对公平性很重要：不能因为“看不到”就认定实现错了。

## 让评测器先证明自己会失败

一个所有实现都通过的评测器，可能只是断言太弱。为了证明评测器真的能抓到问题，
我们加入了三个**故意写坏的 fixture**：

- `fixture-double-work`：同一事件创建两个工单，C2 的工单断言必须失败；
- `fixture-replay-restart`：重启后重放出站消息，C7 的重复断言必须失败；
- `fixture-unauthorized-work`：忽略允许名单执行工作，C5 的工单和授权断言必须失败。

它们不是被测对象，不会出现在矩阵里，只用于验证评测器本身。`npm test` 和
`npm run bench:selftest` 会在 CI 中断言这些预期失败。负向对照是这次 v0.1.0
最重要的可信度补强之一。

## C4：补上“工作做到一半崩溃”的缺口

最初的 C7 是在首轮工作 settle 之后重启，它能验证持久状态和非重放，但没有覆盖
“worker 还在执行时进程被停掉”的情况。

C4 的做法是：

1. 注入一个请求，等待被测实现出现活跃工作；
2. 用一个可配置的 worker 延迟把任务保持在执行中；
3. 在任务完成前重启；
4. 等待恢复，检查仍然只有 1 个工单、没有重复出站。

适配器通过 `workActive()` 暴露“现在有活跃工作”，运行时会把
`midFlightObserved: true` 写进 trace。OpenSuperAgent 在重启后记录了
`[recover] handled 1 incomplete runs`，LofiSu 也执行了 assignment recovery。
这说明 C4 确实在活跃工作期间重启，而不是又一个“先完成再重启”的空测试。

需要说明的是：C4 使用优雅 stop/start 和延迟 worker，不是带未落盘状态的硬崩溃。
我们把这个限制写进了 README 和 SPEC，而不是把它藏在“pass”后面。

## 证据与公平性

v0.1.0 的固定结果快照在
[`docs/results/v0.1.0`](https://github.com/Mikkey-f/deepseek-superagent-bench/tree/main/docs/results/v0.1.0)：

- opensuperagent `0.1.1` @ `a9f9b7e`，黑盒 HTTP；
- deepseek-super-agent（LofiSu）`0.1.0` @ `e705e87`，进程内 Runtime；
- Node v22.14.0，Windows 11，每个场景×被测对象重复 3 次；
- **18/18 组合通过，3/3 重复一致**；
- 原始 trace、报告 JSON/Markdown 和负向对照都已公开，并对本地路径做了脱敏。

所有 18 个组合当前都通过。这既说明两个实现在这些场景上表现一致，也意味着
**目前还没有发现实现差异**。它是 conformance matrix，不是排行榜；一个 pass 只表示
“这次运行、这个 commit 下，这些可观察断言成立”，不等于生产可用。

公平性约束还包括：

- 不修改被测仓库，只通过公开接口或固定版本的本地接口驱动；
- 每个结果都钉住版本、commit、适配器模式和运行环境；
- 多次重复不一致会标记为 `flaky`，不会被平均掉；
- 没有总冠军，只有逐场景结果。

## 局限

- 脚本化模型和合成事件，不代表真实模型接入后的表现；
- C4 是优雅重启 + 延迟 worker，不是硬崩溃；
- 进程内 LofiSu 的出站来自持久化 outbox，不等于真实渠道投递；
- CI 只跑 fixture 和负向对照，真实被测矩阵是本地运行；
- 场景数量仍然有限，C6 线程隔离、投递重试、审批门禁还未纳入。

## 如何运行与参与

```bash
npm install
npm run bench:fixture      # 离线，不需要被测仓库
npm run bench:selftest     # 证明评测器会判负
```

运行真实被测实现时，把它们的 checkout 放在仓库同级目录，然后：

```bash
npm run prepare:subjects
npm run bench:core
```

如果你在实现主动式 Agent，欢迎提交新的 adapter；如果你认为某个失败模式更重要，
欢迎带着可复现的事件序列来讨论。我们更关心“这个场景是否能稳定地抓到系统行为”，
而不是“谁排第一”。

## 声明

这是一个非官方项目，与 DeepSeek 无隶属关系。项目名只用于标识它所测试的设计范式；
仓库不包含 DeepSeek 的代码、Logo 或品牌素材。被测项目的名称和代码仍适用其各自许可。

- 仓库：https://github.com/Mikkey-f/deepseek-superagent-bench
- 规范：https://github.com/Mikkey-f/deepseek-superagent-bench/blob/main/docs/SPEC.md
- 结果快照：https://github.com/Mikkey-f/deepseek-superagent-bench/tree/main/docs/results/v0.1.0
