# Atoms Demo — 笔试说明文档

> 一个智能体驱动的应用生成平台:用户描述一个想法,多智能体团队自动完成
> **研究 → 人工审批 → 构建 → 部署 → 审查**,并把生成的应用以可运行网页实时展示。

- **在线体验:** http://43.249.174.82:8082
- **源码:** https://github.com/yuchengzhang966/agentic_workflow

---

## 1. 实现思路与关键取舍

### 整体思路

目标是复刻 Atoms 的核心体验 —— 不是"一次 LLM 调用生成一段代码",而是把
**"vibe coding" 产品化成一条可观测、可介入的多智能体流水线**:

```
Researcher → Human Gate → Engineer → Runner → Reviewer
  写 PRD      人工审批      生成代码    沙箱部署    质量审查
```

每个节点的产物都通过 SSE 实时流式推送到前端,用户能"边对话边看产物长出来"。

### 关键取舍

| 决策 | 选择 | 取舍理由 |
|------|------|----------|
| **编排框架** | LangGraph,而非手写循环 | LangGraph 原生支持 checkpoint 和 `interrupt()`,后者让"人工审批 gate"几乎零成本实现 —— 图执行可暂停、等前端 resume。代价是多一层抽象。 |
| **人在环 (HITL)** | 在 Researcher 和 Engineer 之间插入人工审批节点 | 牺牲全自动的"丝滑感",换取**可控性与可演示性** —— 评估者能先看 PRD 再决定是否构建,也体现了对"可控生成"的产品思考。 |
| **前后端通信** | SSE,而非 WebSocket | 流水线是单向推送 (agent → UI),SSE 足够且更简单(浏览器原生重连、无握手)。审批走单独的 `POST /resume`。 |
| **LLM** | GLM-4.5-flash(z.ai 免费模型),关闭 thinking | 用免费模型控制成本;关掉推理让 token 预算全给真实输出。模型可一行替换。 |
| **生成应用的运行** | e2b 沙箱 + 本地兜底 | 生成的代码在隔离沙箱里跑,拿到真实可访问 URL 嵌进预览 iframe;本地兜底保证无 e2b key 也能演示。 |
| **持久化** | SQLite (`SqliteSaver`),而非 Postgres | 单实例 demo 用 SQLite 是更对的取舍 —— 零运维、文件即数据库,已满足"持久化"要求。Postgres 适合多实例/高并发写,会为这个规模引入不必要的服务与故障点;`SqliteSaver` 与 `PostgresSaver` 接口一致,真要扩展是一行替换。 |
| **UI 布局** | 双栏 Replit 式工作台 | 左栏对话流 + 流水线进度,右栏实时预览 / 代码。复用 Replit Agent 已验证的"边聊边看"心智模型;antd + 自定义暗色 token,省去从零搭组件库。 |

### 技术栈

- **后端:** FastAPI · LangGraph · langchain-openai · SSE (sse-starlette)
- **前端:** Vite · React 18 · TypeScript · antd(自定义暗色主题)
- **模型:** GLM-4.5-flash,经 z.ai OpenAI 兼容接口调用
- **持久化:** SQLite —— LangGraph `SqliteSaver` checkpointer,流水线状态落地本地文件
- **部署:** HK 服务器,pm2(后端)+ nginx(前端静态 + SSE 反代,`proxy_buffering off`)

---

## 2. 当前完成程度

### ✅ 已完成

- **多智能体流水线全链路打通** —— Researcher → 人工 Gate → Engineer → Runner → Reviewer
- **真实交互** —— 输入想法 → 实时流式看到 PRD 逐字生成 → 人工审批 → 继续构建,非静态展示
- **SSE 流式** —— agent 输出逐字、生成文件逐个出现、部署状态、审查分数,全部实时推送
- **双栏工作台 UI** —— 对话流、5 段流水线进度指示、预览/代码切换、faux 浏览器 chrome,覆盖 8 种状态(idle / researching / awaiting approval / building / deploying / live / done / error)
- **生成应用的可视化运行** —— 部署后嵌 iframe 实时预览,可看到真实运行的网页
- **数据持久化** —— 流水线状态(每个 thread 的 PRD、生成代码、审查结果)经 LangGraph `SqliteSaver` 落地到本地 SQLite 文件;进程重启后,被审批阻塞的运行可从断点恢复(已实测:启动到人工 gate → 重启后端 → 同一 thread 恢复并继续构建)
- **在线可访问 + GitHub 源码**

### ⚠️ 部分完成 / 未完成(诚实说明)

- **e2b 真实沙箱** —— 部署服务器的 venv 是 Python 3.9,而 e2b SDK 需要 3.10+,当前运行在本地兜底模式,生成的应用以 `http://` 本地端口运行(演示可用,但不是隔离沙箱)。
- **注册 / 初始化流程** —— 没有用户账户体系,直接进入工作台。
- **多项目 / 历史** —— 以单 thread 演示为主,没有项目列表与历史回看。
- **Reviewer 自动修复循环** —— score<8 自动重构的循环在 v1 按范围裁剪掉了,目前 Reviewer 只产出一次性审查报告。

---

## 3. 后续扩展与优先级

### P0 — 达标线(提交前应补齐)

1. **服务器升级到 Python 3.10+ venv 并启用 e2b** —— 生成的应用走真实 HTTPS 隔离沙箱,而非本地兜底。

### P1 — 从"能跑"到"可用、可信"

2. **项目列表 + 历史** —— 每次生成入库,可回看、可继续(SQLite 已就位,缺一个列表/检索 API 与界面)。
3. **错误恢复** —— agent 失败时的重试与友好报错(目前部分错误偏静默)。

### P2 — 产品纵深

4. **多轮迭代** —— 对已生成的应用继续提需求、改代码,形成真正的 vibe coding 闭环。
5. **注册 / 登录** —— 生成产物归属到用户。
6. **重新接上 Reviewer 自动修复循环** —— 用质量分驱动 Engineer 迭代。

### 优先级判断依据

P0 是**达标线** —— 作业明确要求"实际可用",必须先满足;
P1 让 demo 从"能跑通"升级到"可用、可信",补齐错误处理与状态留存这类工程基本功;
P2 才是产品想象空间。**先保证可交付,再谈惊喜** —— 这也是面对有限时间的核心取舍。
