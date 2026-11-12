# 参考资料与外部依赖

> 目的：把“写这个评测需要读什么、依赖什么、还缺什么”一次说清。
> 原则：优先使用一手资料（官方设计文档、源码、规范），二手解读只用于背景，不用于断言。

---

## 1. 一手资料（本地已有）

| 资料 | 本地路径 | 用途 |
|---|---|---|
| DeepSeek 官方 super-agent 原型 | `../dsh-superagent-prototype` | 领域模型、Trigger/Eval/Ticket/Assignment 语义、测试基线 |
| 官方设计文档 000–008 | `../dsh-superagent-prototype/docs/` | 场景定义的语义来源；尤其 000 哲学、001 领域模型、003 执行、007 架构 |
| 官方测试与 fixture | `../dsh-superagent-prototype/tests/` | 了解可用的注入点、fake DSH host、可观察行为 |
| LofiSu 独立实现 | `../deepseek-super-agent` | 被测对象 #2；Runtime 接口、SQLite outbox、Bakeoff 文档 |
| LofiSu `docs/BAKEOFF.md` | `../deepseek-super-agent/docs/BAKEOFF.md` | 证明“现有工作不是 benchmark”的关键证据 |
| opensuperagent | `../opensuperagent` | 被测对象 #1；HTTP webhook、API、webhook adapter |
| opensuperagent API | `../opensuperagent/src/api/server.ts` | 事件注入、状态快照、出站回调的具体接口 |
| 三个仓库的 commit/版本 | 各自 `.git` | 在报告中钉住被测版本，保证可复现 |

**使用方式**：只读取，不复制业务代码；适配器通过公开接口或固定版本的驱动脚本接入；报告中注明来源和 commit。

---

## 2. 外部一手资料（需要获取/阅读）

### 2.1 DeepSeek 生态

| 资料 | 链接 | 用途 | 状态 |
|---|---|---|---|
| DeepSeek Harness（DSH） | https://github.com/deepseek-ai/deepseek-harness | 官方适配器所需的宿主/会话/工具接口 | 待读关键源码 |
| DSH 官网 | https://www.deepseek.com/en/harness/ | 平台能力与公开预览状态 | 已浏览 |
| 官方 super-agent 原型 | https://github.com/deepseek-ai/dsh-superagent-prototype | 设计语义、版本对照 | 本地已有 |
| 设计文章《Super-agent 设计探索》 | https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg | 设计意图与术语来源 | 建议你提供保存版/PDF（链接可能失效） |
| 《从 DeepSeek Super-agent 看主动服务的设计模式》 | https://my.feishu.cn/docx/YtDVdzfxdobjAkxKZiIcl5Emnth | 中文社区解读，用于背景，不作为断言依据 | 可选 |
| LofiSu 实现 | https://github.com/LofiSu/deepseek-super-agent | 被测对象 #2 | 本地已有 |
| OpenSuperAgent | https://github.com/thefullgc/opensuperagent | 被测对象 #1 | 本地已有 |

### 2.2 协议与平台规范

| 资料 | 链接 | 用途 |
|---|---|---|
| OpenAI Chat Completions / tool calling | https://platform.openai.com/docs/api-reference/chat | mock 模型的请求/响应格式 |
| GitHub REST API | https://docs.github.com/en/rest | mock GitHub source |
| GitHub Webhooks | https://docs.github.com/en/webhooks | 事件格式与签名 |
| 飞书开放平台（v0.2） | https://open.feishu.cn/document/ | 飞书渠道 mock（暂不用于 v0.1） |
| JSON Schema | https://json-schema.org/ | 场景规范校验 |
| YAML 1.2 | https://yaml.org/spec/1.2.2/ | 场景文件格式 |
| Node.js 22 文档（含 `node:sqlite`） | https://nodejs.org/docs/latest-v22.x/api/ | 运行时与持久化 |
| OpenTelemetry GenAI 语义约定 | https://opentelemetry.io/docs/specs/semconv/gen-ai/ | trace/span 命名的参考（可选） |

### 2.3 基准设计与一致性测试（方法论参考）

这些不是“照抄对象”，而是帮助我们避免常见坑：任务可复现、评测器与模型解耦、版本钉住、原始证据可审计。

| 资料 | 链接 | 借鉴点 |
|---|---|---|
| SWE-bench | https://www.swebench.com/ · https://github.com/princeton-nlp/SWE-bench | 任务集 + 可复现 harness + 提交结果 |
| Web Platform Tests | https://github.com/web-platform-tests/wpt | 跨实现一致性测试的组织方式与适配层 |
| AgentBench | https://github.com/THUDM/AgentBench | 多环境 agent 评测的维度设计 |
| τ-bench（tau-bench） | https://github.com/sierra-research/tau-bench | 以“行为是否满足规则”为中心的评测 |
| GAIA | https://huggingface.co/spaces/gaia-benchmark/leaderboard | 真实任务与可验证答案的划分 |
| OSWorld | https://github.com/xlang-ai/OSWorld | 可复现环境与轨迹记录 |

**我们的差异**：不测“模型有多聪明”，而测“同一套设计语义下，实现的系统行为是否可靠”；因此默认用脚本化模型，避免模型能力干扰系统行为。

---

## 3. 安全、伦理与披露

| 资料 | 链接 | 用途 |
|---|---|---|
| OWASP Top 10 for LLM Applications | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | 场景中的安全边界（越权、敏感信息、供应链） |
| OWASP Agentic AI 指南（如有更新版） | https://genai.owasp.org/ | Agent 特有风险：工具滥用、权限蔓延 |
| GitHub Security Advisory / 协调披露惯例 | https://docs.github.com/en/code-security/security-advisories | 发现真实问题时的私下报告渠道 |

**原则**：
- 只做良性的、非破坏性的行为断言；不做渗透、DoS、数据外泄。
- 场景若暴露真实安全问题，先私下联系维护者，给修复窗口；报告中只写“已协调/待修复”，不写利用细节。
- 被测方有 7 天回应/更正窗口，再发布结果。

---

## 4. 许可与命名

| 事项 | 说明 |
|---|---|
| 官方原型 / DSH | MIT；若适配器复用少量代码，保留版权声明与许可文本 |
| LofiSu | MIT |
| opensuperagent | Apache-2.0；注意 NOTICE 与专利条款 |
| 本项目 | MIT（代码/文档/场景）；报告中的第三方引用按原许可 |
| 命名 | 不使用 “DeepSeek” 作为项目名；README 明确 “unofficial, not affiliated”；发布前做一次 GitHub/npm/商标检索 |
| 署名 | 你为项目 owner/第一作者；被测仓库、官方设计文章在 Credits 中注明 |

---

## 5. 需要你提供的东西

### 必需（影响发布，不阻塞 Week 1）

- [ ] GitHub 账号/组织名（仓库最终地址）
- [ ] npm scope（没有就用个人 scope，如 `@yourname/superagent-bench`）
- [ ] 项目最终名称确认（默认 `superagent-bench`）
- [ ] 每周 review 的时间窗（建议周五 30 分钟）

### 可选（只影响 v0.2 / live 模式）

- [ ] DeepSeek（或其他 OpenAI-compatible）API key：仅用于 `--live` 模式，不进入 CI
- [ ] 一个可写的测试 GitHub 仓库：v0.2 黑盒 GitHub 渠道验证
- [ ] 一个飞书测试应用/测试群：v0.2 飞书渠道 mock 校准
- [ ] 保存版的官方设计文章（WeChat 链接易失效），便于引用与存档
- [ ] 如果你认识被测仓库的维护者，可以提供介绍/预览渠道；没有也不影响

### 不需要

- 付费数据集、私有数据、真实用户数据
- 特殊硬件、GPU
- 真实模型配额（v0.1 默认全 mock）
- 对被测仓库的管理权限

---

## 6. 报告引用规范（提前定好）

1. 每个被测对象记录：仓库 URL、commit SHA、版本号、适配器模式、运行日期。
2. 每个场景记录：场景文件版本、mock 脚本版本、环境（OS/Node）、原始 trace 路径。
3. 区分 **measured**（直接观测）与 **interpreted**（作者解读）。
4. 引用官方设计文档时给章节号，不复述其结论当自己的发现。
5. 不公开被测方的敏感日志、prompt 原文或凭据；必要时脱敏。
6. 结果页保留“更正/回应”区。

---

## 7. 资料获取顺序（Week 1 前）

1. 读官方 `docs/001-domain.md`、`003-execution.md`、`007-architecture.md`，提炼场景语义（已读）。
2. 读 DSH 的 session/tool/host 接口，确认官方适配器的 fake host 成本。
3. 读 OpenAI tool calling 与 GitHub webhook 规范，冻结 mock 模型/source 的 v0.1 子集。
4. 快速扫一遍 SWE-bench / WPT 的 harness 设计，确定 trace 与断言的存储格式。
5. 写 `docs/SPEC.md`，冻结 7 个场景；此后新增场景一律进 v0.2 候选。

---

*资料清单会随实现进展更新；新增外部依赖必须在 PR 中说明用途和许可。*
