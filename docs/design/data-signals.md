# Mission Control 数据信号矩阵（Client 可达性 / 刷新方式 / 代价）

> 调研目标：为一个「任务指挥台」整页（各对话的产出与进度 + subagent 创建/处理/关系）确定**每个信号到底从哪拿、Client 插件能不能拿到、怎么实时更新、代价多少**。
> 版本：DSH 0.2.1-rc.3（Desktop，profile=desktop）。仅调研，未安装/未改 profile。
>
> **证据分级**：`[inspect]` = `cordis_inspect_query` 实测返回；`[pkg]` = 读 app.asar 内已安装包源码/README；`[usage]` = 读已装 Client/第三方插件源码中的真实调用；`[推断]` = 由前两者推导、未直接运行验证。
>
> 说明：本轮 Client Inspect provider 连续超时（页面未响应 `Service.listService`），所以 Client 侧契约改由**读内置契约目录**得到——`@deepseek-ai/dsh-cordis-client-runner/lib/client.js` 里内置了与 Client Inspect 同源的 Service/Slot 契约目录（含 signature、description、declaration），权威性等同；落地前建议页面在线时再跑一次 Client `Service`/`Slots` 复核（见第 5 节风险 #1）。

---

## 0. 结论速览

1. **「各对话的进度」基本是现成的**：`ctx.sessions.list`（Client service，`ObservableSnapshot<SessionListState>`）已经带 `running`、`updatedAt`、`displayTitle/title`、`cwd`、`parentId`、`origin`、`blank`、以及 `projectionsBySession`（每个会话全部 wire 投影值）。加上 `ctx.workspaces.list` 就有 workspace 分组/置顶/归档。
2. **subagent 树可以 100% 纯 Client 侧拼出来**：每个会话的 `subagentCatalog`（直接子级：`id/createdAt/mode/label`）+ 子会话的 `subagent` 身份投影 + 列表里的 `parentId/origin` + `ctx.sessions.refreshProjections(childId)` 懒加载，足够画多层树；`dsh-client-ui-subagent` 就是这么做（可直接抄它的取数逻辑）。
3. **Agent Teams / Goal / Schedule / Jobs 都有现成 Client 通道**：`agentTeam` 投影、`goal` 投影 + `ctx.remote.goals.*`、`ctx.remote.schedule.*`、`ctx.jobs`（按 session 的 roster 流）。
4. **真正的缺口只有三个**：workflow run 汇总、跨会话「产出摘要」（最后回复文本/最后产物）、子 agent 的**结束原因**。它们都只是 Host 侧事件/日志里的东西，Client 拿不到现成投影。
5. **补缺口有三条路**（第 4 节详述）：① 自己写一个 Host projection unit（推荐，零新传输）；② 自定义 Remote stream（第三方插件 `dsh-plugin-whale-pet` 已证明可行，但要手写两份 Typert descriptor）；③ Host HTTP 路由 + 同源 fetch（`/api/changes.summary` 已是先例）。
6. **最大技术风险**：`ctx.remote.$on` 的 Host 事件是**固定 allowlist，插件无法扩展**（`subagent/start|end`、`workflow/*`、`agent/status`、`tools/result` 都不在其中）；以及新增 wire 投影会进入**所有 Client 的 control 基线**，payload 越大越贵。

---

## 1. 六条 Client↔Host 数据通道（选型的地基）

| # | 通道 | 方向/实时性 | 插件可用性 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| 1 | Client service 读模型：`ctx.sessions`、`ctx.workspaces`、`ctx.jobs`、`ctx.uiWorkspace` | 读 + 订阅；Host 推送驱动 | ✅ 直接 `inject` | 无额外传输；依赖宿主已有 | `[pkg]` runner 契约目录；`[usage]` whale-pet / ui-schedule / ui-subagent |
| 2 | **Session projections 的 `wire.view`** | Host 折算 → 随 control 流推送（每 key 变化一帧）+ 列表 cached hints | ✅ 插件可 `register` 新 key | 每个新 key 广播给所有 Client；基线含全部 live session × 全部 wire key | `[pkg]` `dsh-session-projection`、`dsh-api-session-controller` |
| 3 | `ctx.remote.$on(<event>)` 转发事件 | Host emit → Client 回调 | ⚠️ **只能用固定 allowlist，不能新增** | 只能拿到 `api-session/*`、`goal/activation-changed`、`schedule/changed` 等 | `[pkg]` `dsh-api-remotes` allowlist |
| 4 | 现成 generated Remote 命名空间（`remote.session.*`、`remote.subagents.*`、`remote.goals.*`、`remote.schedule.*`、`remote.job.*`、`remote.workspace*` …） | 方法调用 / `mode:'stream'` 流 | ⚠️ 只能调宿主已生成的；**插件自己加不了**（除非走 5） | 受 access 控制（`useAccess`） | `[pkg]` client 包内 `ctx.remote.*` 调用；`[inspect]` host service 的 `@Remote` 标记 |
| 5 | **自定义 Remote stream**（插件自建 service + 手写 Typert descriptor，Client `remote.$mount` 后 `ctx.inject(['remote.<ns>'])`） | Host push stream（可长连） | ✅ 有第三方先例 | 两份 descriptor 与 DSH 版本耦合；mount/namespace 生命周期有坑 | `[usage]` `dsh-plugin-whale-pet/lib/{index,typert.host,remote,client}.js` |
| 6 | Host HTTP 路由：`ctx.connection.fetch.register({path,methods,requestBody,fetch})` + 同源 `fetch('/api/...')` | 拉取 / 轮询 | ✅ 有内置先例 | 需自己处理鉴权围栏（`connection.fetch` 在围栏内）、缓存、错误码 | `[pkg]` `dsh-client-ui-deliverables/lib/index.js`；client `lib/client.js` `/api/changes.summary` |

---

## 2. 逐信号矩阵

### 2.1 会话列表 / running-idle / 最近活动 / 标题 / 所属 workspace

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| 所有 session 列表 | `ctx.sessions.list`：`ObservableSnapshot<SessionListState>`，`{ ids, byId, phase, projectionsBySession }` | **可用** | Host `api-session/added|removed` → Client 自动 `refreshList()` | 无 | `[pkg]` `dsh-api-session-controller/lib/client.js` ClientSessions |
| 每 session running/idle | `list.byId[id].running`；更细用 `useSessionStatus(map => map.get(id)?.running)` | **可用** | `api-session/status`（宿主转发）+ list 增量 | 无 | `[pkg]` 同上 + `dsh-client-ui-session` 状态源 |
| 最近活动时间 | `list.byId[id].updatedAt`；`api-session/activity(sessionId, updatedAt)` 只对**用户消息**推进 | **可用（口径是"最后用户消息"）** | 事件推送 | 口径限制：模型活动不推进它，要"最后事件时间"得自己 fold | `[inspect]` event `api-session/activity` 描述 |
| 标题 | `list.byId[id].displayTitle` / `.title`；权威值来自 `title` 投影；重命名走 `ctx.remote.session.rename` | **可用** | control 帧 + list hint | 无 | `[pkg]` projectList / `apply("title",…)` |
| 所属 workspace | `ctx.workspaces.list`：`ObservableSnapshot<{ items: WorkspaceView[]; pinnedSessionIds; archivedSessionIds; … }>`，`WorkspaceView={workspaceId,path,title,sessionIds,createdAt,updatedAt}` | **可用** | `remote.workspace.follow`（`@Remote({mode:'stream'})`）驱动 | 归档会话不在默认 union 里，需按 `archivedSessionIds` 处理 | `[pkg]` runner 契约 `useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>`；`[usage]` ui-workspace |
| 会话行 UI 聚合（可直接抄） | `running`、`runningSubagentCount`（父的 `subagentCatalog` × 子 `running`）、`pendingInteraction.kind`（approval / plan-review / question）、`completionUnread`、`blank`、`pinned/archived` | **可用** | 同上 | 无 | `[usage]` `dsh-client-ui-workspace/lib/client.js` `sessionNode()` |
| Host 侧权威 summary | `SessionSummary = { agentAvailable, formatStatus?, sessionId, updatedAt, running, blank, parentSessionId?, origin?, cwd?, projections?: SessionProjectionHints }` | Client 拿到的是**派生行**（字段名 `id`，多 `displayTitle/projectionValues/retainedBy`） | — | 别把 Host 版字段名直接当 Client 版用 | `[pkg]` `dsh-api-session-controller/lib/typert.host.js` |
| 最近活动排序 / 分页 | `remote.session.list({})` 全量（无分页参数）；Host `sessionQuery.listSessions` 是 Host-only | **可用（全量）** | 事件驱动重拉 | 会话极多时全量 list 是唯一口径 | `[pkg]` refreshList 调用 |

### 2.2 单 session 内 turn/step 进度、当前在跑的 tool call、token/上下文

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| token 用量（输入/输出/缓存） | 投影 `useProjection("tokenUsage")`（root 页：`useSessions(s=>s.projectionsBySession[id].values.tokenUsage)`）→ `TokenUsageProjection = { uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }` | **可用** | control 推送 | 无 | `[pkg]` SessionProjectionMap 声明 |
| 上下文占用 / 压力 | 投影 `contextPressure`（`{ pressureTokens?, projectedTokens?, contextWindow? }`）与 `contextBreakdown`（`{ systemTokens, toolsTokens, messageTokens }`） | **可用** | control 推送 | 无 | `[pkg]` 同上；`[usage]` ui-conversation `ContextMeter` |
| turn 编号 / 当前 step | 仅在会话事件流里：`turn/start{ turn }`、`step/start{ turn, step }`、`turn/end{ turn, reason }`；Client 可用 `ctx.sessions.retain(id,{source})` 拿 `SessionFace` 快照与事件源 | **部分可用**（要 retain 才有事件流） | history tail + live append | 每 retain 一条会话 = 一份历史窗口 + 一条流；见下 | `[pkg]` `SessionEventMap`；`[usage]` whale-pet `sessions.retain` |
| "当前在跑哪个 tool" | 事件 `tool/call{ turn, step, callId, name, arguments }` / `tool/result`；UI 侧由 Chat/Conversation 组装渲染 | **部分可用**：Client 无「当前 tool」聚合计；只有会话 Chat 内呈现，或自己 retain 后 fold | 事件流 | 自己 fold 需保留每个会话的流（N 条） | `[pkg]` SessionEventMap；`[inspect]` `tools/result`（Host emit，不转发） |
| turn 结束原因 | `turn/end.reason.kind`: `completed/aborted/blocked/error/max-tokens/interrupted/forked` | **可用（需会话事件）** | 同上 | 同上 | `[pkg]` `TurnEndReasonMap` |
| todo 清单 | 投影 `todos` → `TodoItem[] = { content, status }` | **可用** | control 推送 | 无 | `[pkg]` SessionProjectionMap |
| plan / 用户提问 | 投影 `plan`（`PlanProjection`）、`userQuestions` | **可用** | control 推送 | 无 | `[pkg]` SessionProjectionMap |
| inbox / 排队消息 | 投影 `inbox = InboxWireState { 'next-turn': JsonValue[], 'next-step': JsonValue[] }` | **可用** | control 推送 | 无 | `[pkg]` 同上 |
| 模型选择 / 权限 / cwd / preset | 投影 `modelSelection`、`permissions`、`workingDirectory`、`agentPreset`、`imageLimits` | **可用** | control 推送 | 无 | `[pkg]` 同上 |
| **产出：最后回复文本** | 会话事件 `assistant/message` 的 content（或 `assistant/attempt` 流文本） | **不可用（现成）** → 必须自己写 Host projection 或 retain 后 fold | control 推送（自建 key） | 自建投影 1 个 key；文本要限长 | `[pkg]` SessionEventMap；见 §4 |
| 上下文窗口大小 | `request/context.contextWindow` 事件 + `contextPressure.contextWindow` | 可用（投影已带） | control 推送 | 无 | `[pkg]` |

### 2.3 subagent 树：parent/child、状态、标题/描述、是否 live、结束原因、消息往来

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| 直接子级目录 | 父会话投影 `subagentCatalog`：`SubagentCatalogEntry = { id: SessionId, createdAt, mode: 'one-shot'|'external'|'continuable'|'unknown', label? }` | **可用** | control 推送；列表 cached hints | `external` 无本地会话可分 | `[pkg]` `dsh-subagent/lib/index.js` 投影定义（stateVersion 6） |
| 多层后代 | 对每个 child 用 `ctx.sessions.refreshProjections(childId)` 拉它的 `subagentCatalog`，递归 | **可用（懒加载）** | 按需 pull（`remote.session.projections`）；不 retain | 每层展开一次请求；不改变子会话 running 口径 | `[pkg]` ClientSessions.refreshProjections；`[usage]` ui-subagent `toggleBranch` |
| 子会话身份（mode/label/seq） | 子会话投影 `subagent`：`{ mode:'one-shot', label?, seq } \| { mode:'continuable', label, seq } \| null` | **可用** | control 推送 | `null` = 无有效描述符 | `[pkg]` `subagentIdentityProjectionDefinition` |
| 是否 live / 运行中 | `subagentCatalog[].id` → `useSessionStatus().get(id)?.running ?? list.byId[id].running` | **可用** | `api-session/status` 推送 | 子会话可能不在 Host list（external 永远不会），要 fallback | `[usage]` ui-subagent / ui-workspace `runningChildCount` |
| 已运行时长 | 子会话投影 `subagentTiming`：`{ settledMs, active?: {since,through}, lastTurnCompleted? }` | **可用** | control 推送 | 是"活跃区间累计"，不是精确 wall-clock 计时 | `[pkg]` `subagentTimingProjectionDefinition` |
| parent/child 关系（全局） | `list.byId[child].parentId`（Client 已从 `subagentCatalog` 或 `ctx.sessions.subagentAddress(id)` 派生并注入列表，`origin:'subagent'`） | **可用** | 随 list 更新 | Client 列表会把不在 Host list 的 child 也补进来 | `[pkg]` ClientSessions.projectList |
| 结束原因（completed/aborted/error/refusal/max-tokens） | **Host 事件** `subagent/end` payload `{ runId, provider, id, local, stopReason, lastAssistantMessage? }`；`subagent/start` 为 `{ runId, provider, id, local }` | **不可用（不转发）** | — | 只能自写投影（fold 父会话 `tool/result` 里的委派结果）或自定义 Remote 订阅 Host 事件 | `[pkg]` `createActivationObserver`；`[inspect]` 事件目录（不在转发 allowlist） |
| 子 agent 产出文本 | 同上 `subagent/end.lastAssistantMessage`（Host 事件） | **不可用（现成）** | — | 同缺口，自建投影 | `[pkg]` 同上 |
| 消息往来（team/子 agent 消息） | 会话事件 `team/message/*`、`agent/inbox/*`；`subagents.sendMessage` 是 Host API | **部分可用**（会话事件可 retain 后读；无聚合读模型） | 事件流 | 需要 retain | `[pkg]` `subagent.js`；`[inspect]` subagents service |
| Host 侧目录 API | `ctx.subagents.listChildren(parentId)` → `SubagentCatalogEntry[]`；`listDescendants(rootId)` → `SubagentDescendantListEntry[]`（带 parentId/depth） | **Host-only（非 @Remote）** | — | Client 只能拿到等价投影+catalog，拿不到 depth | `[inspect]` host Service `subagents`；`[pkg]` listChildren 内部就是读 `subagentCatalog` |

### 2.4 Agent Teams（teammates / shared tasks / blocked_by / owner / status）

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| members + tasks 全量 | Lead 会话投影 `agentTeam`：`TeamProjection = { members: TeamMemberProjection[], tasks: TeamTaskView[], failure? }` | **可用** | control 推送 | 只对 **Lead 会话**有值；teammate 会话没有 | `[pkg]` SessionProjectionMap；`[usage]` `dsh-experimental-client-ui-agent-team` `useSessions(s=>…values.agentTeam)` |
| member 字段 | `TeamMemberProjection = { id: SessionId, name, role:'lead'\|'teammate', phase:'provisioning'\|'active'\|'failed', error? }` | **可用** | control 推送 | 没有"inactive"枚举，inactive 只能由 Client 用 `useSessionStatus` 推 | `[pkg]` 声明 |
| task 字段 | `TeamTaskView = { id, revision, subject, description, status:'pending'\|'in_progress'\|'completed'\|'deleted', blockedBy, writeScopes, ownerName?, ready, writeScopeWarnings }` | **可用** | control 推送 | 无 | `[pkg]` 声明 |
| Host 侧 API | `ctx.agentTeams.listMembers(agent)` / `listTasks(agent)` / `getTask` / `waitForChange` | **Host-only（非 @Remote）** | — | 插件 Host half 可用它做二次折算 | `[inspect]` host Service `agentTeams` |
| 成员 live 状态 | 组合：`agentTeam.members[].id` → `useSessionStatus`/`list.byId.running` | **可用** | 推送 | 同 2.3 live 口径 | `[usage]` list_agents / 团队面板 |

### 2.5 workflow run：阶段/日志/子 agent/能否复用到面板

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| 运行/阶段/日志/子 agent 汇总（进程级） | **Host 事件** `workflow/start`、`workflow/phase(info,title)`、`workflow/log(info,msg)`、`workflow/agent-start(info,agent)`、`workflow/agent-end(info,agent)`、`workflow/end(info,result)`；`WorkflowRunInfo` 是"身份快照" | **不可用（不转发）** | — | 只能在 Host half `ctx.on(...)` 收；`workflow/*` 是 observe-only，不能取消 | `[inspect]` host Event 目录；`[pkg]` `dsh-workflow/README.md` |
| 单会话内的持久 run 记录（可复用） | **会话事件**：`tool-workflow/run-start{runId,name}`、`tool-workflow/agent-start{runId,seq,label?,phase?,childId}`、`tool-workflow/agent-end{runId,seq,outcome}`、`tool-workflow/run-end{runId,stopReason}` | **部分可用**：现成渲染只给"当前打开的会话"的 chat node `workflow-run`（`conversation.chat.node` slot） | 会话事件追加 | 要跨会话汇总 = 自己写投影或 retain | `[pkg]` `dsh-tool-workflow/lib/index.js` recorder；`[pkg]` ui-workflow-run README |
| 复用现成 workflow-run UI | `conversation.chat.node` slot 由 `dsh-client-ui-workflow-run` 占用；插件不能 require 宿主 Client 包 | **不可直接复用** | — | 规范禁止 require 宿主 Client 包；只能看源码仿写 | `[pkg]` practices.md §UI；whale-pet 只 require primitives 的图标（不推荐） |
| 跑在后台的 run | 走 `job` 体系（`run_in_background`）→ 见 2.6 jobs | 部分可用 | job 流 | workflow 结果在 job 完成通知里 | `[pkg]` tool-workflow jobOutcomeOf；README |

### 2.6 Goal / Schedule / Job / Workspace 文件改动

| 信号 | 精确数据源 | Client 可达性 | 刷新方式 | 代价 / 风险 | 证据 |
|---|---|---|---|---|---|
| Goal | 投影 `goal`：`GoalProjection = { goal: GoalSnapshot, roundsStarted, createdAt, updatedAt }`；`GoalSnapshot extends GoalRef(objective, phase:'active'\|'paused'\|'blocked'\|'complete', blockedReason?, maxGoalRounds)`；动作 `ctx.remote.goals.{get,edit,pause,resume,clear}` | **可用** | control 推送 + `goal/activation-changed`（转发） | Host `goal/changed` **不**转发；跨会话汇总走投影 | `[pkg]` 声明；`[usage]` ui-goal `useProjection("goal")` + `ctx.remote.goals.*` |
| Schedule（自动化任务） | Client `ctx.remote.schedule.{list({sessionId}), catalog(), update, delete, history}`；Host 事件 `schedule/changed`（payload-free，转发，客户端重新拉取） | **可用** | 事件失效 + 重拉；`ctx.remote.schedule.catalog()` 给进程级全量 | 只在需要时拉，不是长连推送（拉取式） | `[pkg]` ui-schedule `ctx.remote.schedule.list/catalog/update/history`；`[inspect]` `schedule/changed` |
| 后台 Job（全局） | Host `ctx.jobs`（服务）+ `jobController`；Host-only，无 @Remote 全局 list | **不可用（全局）** | — | — | `[inspect]` host Service `jobs` / `jobController` |
| 后台 Job（按会话） | Client `ctx.jobs`：`watchRows(sessionId)` → `remote.job.list({sessionId})` 流（`JobView[]`）；`observe(sessionId,id)`；`kill(sessionId,id)` | **部分可用**：每会话一条 roster 流，可遍历所有会话拼全局 | 流（重连整体重发） | N 个会话 = N 条流；`JobView` 有 `status/progress/detail/startedAt/finishedAt/output` | `[pkg]` `dsh-api-job-controller/lib/client.js` ClientJobs；`[pkg]` ui-jobs README |
| Workspace 文件改动（每 turn 摘要） | 会话事件 `workspace/changes{ turn }`（只有 turn 号）+ Host `ctx.workspaceChanges.summary(sessionId, seq)` / `.diff(...)`（Host-only） | **部分可用**：Client 可读 `workspace/changes` 事件拿 seq，再 fetch 内置路由 `/api/changes.summary?sessionId&seq`、`/api/changes.diff?…` | 事件 + 同源 fetch | 路由由 `dsh-client-ui-deliverables` 注册；无该插件则 404；summary 仅在 Session 存活期可读 | `[pkg]` `dsh-workspace-changes/README.md`；`[pkg]` deliverables host/client |
| 工作目录观察（文件系统级） | `ctx.remote.workspaceFiles.changes(scope, path, signal)`（`@Remote({mode:'stream'})`，目录 watch） | **可用** | 流 | 这是"目录监视"，不是"本 turn 改了什么" | `[inspect]` host Service `workspaceFiles` |
| 会话归档/置顶 | `ctx.workspaces.list` 快照 `pinnedSessionIds/archivedSessionIds` + `uiWorkspace.{archiveSession,unarchiveSession,…}` | **可用** | workspace follow 流 | 无 | `[pkg]` ui-workspace；`[inspect]` `workspaceController` |

### 2.7 事件面：哪些 Host 事件能到 Client，哪些不能

`ctx.remote.$on` 的合法 key = `@deepseek-ai/dsh-api-remotes` 里的固定 allowlist（**插件不能扩展**，除非改宿主包）：

```
api-session/added | api-session/removed | api-session/status | api-session/activity | api-session/error
agent-preset/selected | approval/request | commands/change | credentials/record-updated | credentials/reference-updated
deepseek-account/model-sign-in-required | deepseek-account/session-expired | goal/activation-changed
llm/adapters-updated | permission-presets/catalog-changed
plugin-manager/changed | plugin-manager/install-log | plugin-manager/install-state | plugin-market/changed
schedule/changed | settings/document-updated | user-questions/request | cordis/*
```

| Host 事件 | 到 Client？ | 直接影响的面板信号 |
|---|---|---|
| `agent/status` (`{agent, status:'idle'\|'running'}`) | ❌（Client 等价物：`api-session/status` + `useSessionStatus`） | 全局 running 计数 |
| `tools/result` / `tools/execute`（观察/瀑布） | ❌ | 工具调用成败、产出 |
| `subagent/start` / `subagent/end` | ❌ | 子 agent 创建、结束原因、产出文本 |
| `workflow/*`（6 个） | ❌ | workflow 阶段/日志/子 agent |
| `goal/changed` | ❌（有 `goal/activation-changed`） | goal 正文（用 `goal` 投影即可） |
| `schedule/changed` | ✅（无 payload，触发重拉） | 定时任务列表 |
| `api-session/*`（5 个） | ✅（带 session 资源鉴权） | 会话列表/状态/活动 |
| `session/event`（含 `subagent/catalog`、`tool-workflow/*`、`workspace/changes`、`turn/*`…） | ❌ 不转发；Client 通过 retain/history 或投影间接拿到 | 一切会话级细节 |

> 结论：**任何"会话事件里的事实"想进面板，要么走现有投影、要么自己写投影、要么自己 retain 会话**；**任何"进程级 Host 事件"想进面板，只能自建 Remote stream 或 HTTP 路由**。

---

## 3. 关键机制：`wire.view` 的确切声明方式与实时链路

### 3.1 Host 半：在 projection unit 上声明 `wire`

`ctx.sessionProjections.register(definition)` 的 `ProjectionDefinition`（`[inspect]` + `[pkg]`）：

```ts
ctx.sessionProjections.register({
  key: 'myKey',                 // 运行时不校验是否在 SessionProjectionMap 中（类型表仅编译期）
  stateSchema: z.object({...}), // 宿主现存实现用 zod 4.4.3；snapshot/checkpoint 时才 parse
  stateVersion: 1,              // 非负整数；同 key 不同 version 会 throw
  init: (header, inheritedEventCount) => ({...}),   // 纯、同步
  apply: (state, event) => /* 关心则返回新引用，不关心必须返回同一引用 */,
  wire: {                       // ← 只有带 wire 的 unit 才会进 Client 快照
    viewSchema: z.object({...}),
    view: state => ({...}),     // 必须同步；返回 Promise 会 parse 失败
  },
})
```

- `apply` 返回同一引用 = 零下游开销；`view` 结果按 `Object.is` 比较决定是否发布。
- 注册是调用方 fiber 的 effect：插件卸载 → key 从快照消失（Client 读作 "capability absent"）。
- 已在 Client 侧可见的完整 key 表（`SessionProjectionMap`，宿主内建）：
  `inbox`、`workingDirectory`、`agentPreset`、`title`、`todos`、`sessionListMetadata{blank,lastPromptAt}`、`imageLimits`、`modelSelection`、`permissions`、`subagentCatalog`、`subagentTiming`、`subagent`、`tokenUsage`、`contextPressure`、`contextBreakdown`、`agentTeam`、`userQuestions`、`goal`、`plan`。
  → **面板要的进度类信号 90% 已在这张表里，不用自己写。**

### 3.2 实时链路（已验证端到端）

```
Host: session/event
  → SessionProjectionRegistry.drive()：每个 committed event 过每个 unit.apply
  → wire.view 结果 Object.is 变化 → onChanged(session,key,value,seq)
  → SessionControlController.broadcast({type:'projection', sessionId, key, value, seq})
  → Client: remote.session.control(signal)  // @Remote({mode:'stream'})，一条进程级长连
  → ProjectionValueStore.apply(key,value,seq)  // 高 seq 胜、cached 让位 sequenced
  → faceOf(key) / useProjection(key, selector) / useSessions(s=>s.projectionsBySession)
```
连接时首帧是 `{type:'baseline', value:{projections:{[sessionId]:{asOfSeq,values}}}}`，baseline 覆盖 **`ctx.sessions.list()` 的全部 live 会话 × 全部 wire key**。断线重连由 `RemoteSnapshotStream` 重放 baseline。

### 3.3 Client 半：三种读法（按场景选）

| 场景 | 写法 | 说明 |
|---|---|---|
| 根页面（`main` slot，无 session 绑定） | `useSessions(s => s.projectionsBySession[id]?.values.tokenUsage)` | `main` 的 standard props 里**没有** `useProjection`；但有 `useSessions/useSessionStatus/useWorkspaces/usePanelInfo` |
| 会话绑定 slot（`conversation.*` 等） | `useProjection('goal')` / `useProjection('plan', sel)` | standard props 里有 `useProjection` |
| 不在 React 里（client service / 命令式） | `ctx.sessions.scope(id)?.…`；或 `ctx.sessions.retain()` 拿 `SessionFace.projections.faceOf(key)` | `ObservableSnapshot<T>{getSnapshot,subscribe}` |

`SessionProjectionSnapshot` 形态：`{ values: Partial<SessionProjectionMap>, state: 'idle'|'loading'|'ready'|'migration-required'|'error', error }`。

### 3.4 冷会话 vs 热会话（重要口径）

| 会话状态 | 投影值从哪来 | 新鲜度 |
|---|---|---|
| live 会话 | control 流逐 key 推送 + `onChanged` | 实时 |
| 非 live 但会话被 Client retain/打开过 | `refreshProjections(id)` → `remote.session.projections({sessionId})` | 拉取时 |
| 非 live、从未打开 | `remote.session.list` 返回的 `projections: SessionProjectionHints{kind:'cached'|'sequenced', asOfSeq, values}`（来自 `session-projection-cache` 持久化 checkpoint） | **可能过期**（上次 checkpoint 时） |
| 极端 | `ctx.sessions.refreshProjections(id)` 主动补 | 一次往返 |

→ 面板若要在"不打开会话"的情况下显示准确进度，需要**对 live 会话靠推送、对冷会话靠 cached + 按需 refresh**；并区分 `state` 显示"缓存值/加载中"。

### 3.5 如果必须新加 Host 计算值：三种落地方式

| 方式 | 适用 | 具体做法 | 代价/风险 |
|---|---|---|---|
| **A. 新 projection key（推荐）** | per-session 维度的一切（产出摘要、workflow run 汇总、子 agent 结束原因…） | Host half 里 `ctx.sessionProjections.register({key:'missionControl', stateSchema, init, apply(fold 想要的 session events), stateVersion, wire:{viewSchema, view}})`；Client 用 `useSessions(s=>s.projectionsBySession[id]?.values.missionControl)` | ① 每个 key 进所有 Client 的 control 基线 → 只放小 JSON（截断文本、计数、状态枚举）；② `stateVersion` 一改，所有旧 checkpoint 失效重折；③ 需要 zod 形状的 schema（可把 zod 打进插件包，或提供等价 `{parse}` 对象——宿主 register 只校验 stateVersion，parse 只在 snapshot/checkpoint 路径调用）；④ 会话越老 fold 越久（冷读靠 checkpoint） |
| **B. 自定义 Remote stream** | 进程级、非会话维度（如"全体 workflow run 实时面板"、"Host 级任务队列"） | Host：`ctx.provide(name, service)`，`service.typertRemote={service,serviceKey,namespace}`，并发布 `./typert`（TYPERT 反射：`invocations:[descriptor]`，`mode:'stream'`）+ `./remote` descriptor；Client：`remote.$mount(TYPERT_REMOTE)` → `ctx.inject(['remote.<ns>'], scope => scope.remote.<ns>.watch(signal))` | 两份 descriptor 手写、与 DSH 版本耦合；mount 是"本地描述符安装"，不保证 Host ready；namespace 是独立 capability，必须在 mount 之后用 `ctx.inject` 拿（whale-pet 有完整踩坑注释）；访问控制/序列化需自己保证 |
| **C. Host HTTP 路由** | 低频轮询 / 大块数据 / 文件下载 | Host：`ctx.connection.fetch.register({path:'/api/mc.state', methods:['GET'], requestBody:'buffered', fetch: req => Response.json(...)})`；Client：同源 `fetch('/api/mc.state')` | 在 `connection.fetch` 鉴权围栏内（不要用裸 `webServer.register` 绕过）；需自己定缓存头/错误码；无推送，只能轮询或长轮询 |

**不推荐**：为了"产出文本"对每个会话都 `sessions.retain()` + 读 history —— N 个会话 = N 份历史窗口/流，内存与 RPC 开销随会话数线性增长。

---

## 4. 最小可行架构建议

### 阶段 1（首选，0 行 Host 代码）：纯 Client 聚合页

```
client.js
  inject: ['slots','sessions','workspaces','jobs','locale','remote']
  apply(ctx):
    ctx.slots.inject('main', () => ctx.slots.register(
      { name:'main', key:'mission-control', locale:'mission-control' }, MissionControlPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name:'sidebar.panellist', id:'mission-control', order: 10, label: () => t('panel') }, MissionControlIcon))
```
（`main` + `sidebar.panellist` 的 id/key 配对方式 = `dsh-client-ui-schedule` 的 `TaskManagerPage` 先例；`main` 是 root keyed slot，"sidebar entry id → main cell key"。）

页面内取数（全部现成）：

| 区块 | 取数 |
|---|---|
| 会话卡列表 | `useSessions(s=>s)`（`ids/byId/projectionsBySession`）+ `useSessionStatus(m=>m)` |
| workspace 分组 | `useWorkspaces(s=>s)`（`items/pinnedSessionIds/archivedSessionIds/phase`） |
| 每会话进度条 | `projectionsBySession[id].values`：`tokenUsage`、`contextPressure`、`contextBreakdown`、`todos`、`plan`、`goal`、`sessionListMetadata` |
| subagent 树 | 父 `subagentCatalog` + 子 `subagent`/`subagentTiming` + `byId[child].parentId/origin`；展开时 `ctx.sessions.refreshProjections(childId)` |
| Agent Teams | Lead 会话的 `agentTeam`（members+tasks+blockedBy+owner） |
| 打开会话 | `ctx.uiWorkspace.openSession(id)` |
| 后台 job | 仅对用户可见/运行中的会话 `ctx.jobs.watchRows(sessionId)`（按需，勿对全集开流） |

**降级策略（阶段 1 明确不做）**：workflow run 面板、跨会话"最后回复/产物"、子 agent 结束原因 —— 这三项等阶段 2。

### 阶段 2（补缺口）：一个 Host projection key `missionControl`

在同一个包里加 Host half（`index.js`），只注册 **1 个** wire 投影（每会话一个小 JSON），fold 这些会话事件：

| 目标字段 | fold 来源 |
|---|---|
| `lastAssistantText`（截断，如 ≤200 字符） | `assistant/message` |
| `lastToolName` / `lastToolError` | `tool/call`、`tool/result` |
| `turn` / `lastTurnEndReason` | `turn/start`、`turn/end` |
| `workflowRuns: [{runId,name,phases:[],members:[],stopReason}]` | `tool-workflow/run-start|agent-start|agent-end|run-end` |
| `changedFiles`（count + 最近 3 个 path） | `workspace/changes`（细节 diff 仍走 `/api/changes.diff`） |
| `subagentOutcomes: [{childId,stopReason?}]` | 父会话的委派 `tool/result`（能 fold 到多少取决于工具结果是否带 childId —— **待验证**，否则此字段留空，回到用 `subagentTiming.settledMs` 表示"已结束"） |

约束：
- `stateVersion: 1` 起步；字段语义变化必须 bump（旧 checkpoint 会重折）。
- 只折叠**小数据**；大文本/大对象不要进 wire（control baseline 是全 Client 共享的）。
- Client 侧不需要新代码路径：同一个 `useSessions(...values.missionControl)`。
- 若阶段 2 仍不够（需要进程级实时、"所有 workflow run" 这种非会话维度），再评估阶段 3 的自定义 Remote stream（先例 whale-pet）或 `/api` 轮询路由。

### 不建议的架构

- 用 iframe / 独立 HTML 页面（丢 theme token、`ctx.locale`、slot 生命周期）。
- `require('@deepseek-ai/dsh-client-ui-primitives')` 或任何宿主 Client 包（规范明确禁止；会随版本消失）。
- Client 侧轮询所有会话 history 来算进度（N 条流 + 全量日志）。
- 试图往 `api-remotes` 的转发 allowlist 里加事件（那是宿主包编译产物，插件改不了）。

---

## 5. 风险与待验证清单

| # | 风险/未知 | 影响 | 处置 |
|---|---|---|---|
| 1 | Client Inspect 本轮超时，Client 侧 Service/Slot/Props 契约来自内置契约目录而非在线 inspect | 极小的字段名偏差 | 页面在线时补跑 Client `Service`/`Slots` |
| 2 | 插件新增 wire key 未在真实插件中跑通（本调研未安装任何东西） | 阶段 2 返工 | 落地第一阶段先做一个空 key 的 smoke test，再填 fold |
| 3 | `register` 不校验 key 白名单属**运行时观察**；`SessionProjectionMap` 是编译期封闭表，未来版本可能收紧 | 阶段 2 兼容性 | 在插件 README 标注依赖的 DSH 版本；失败时 feature-detect（`register` 抛错则降级到阶段 1） |
| 4 | 子 agent 结束原因不在父会话日志的稳定位置（是否经 `tool/result` 能可靠映射到 childId 未验证） | 该字段可能只能显示"已结束" | 先不承诺 stopReason；以 `subagentTiming` + 状态收口 |
| 5 | control baseline 体积随 wire key 增加而增长（所有 Client、每次重连） | 大文本投影会拖慢打开页面 | 严格限制新投影大小（<1–2 KB/session） |
| 6 | 冷会话 projections 只到上次 checkpoint | 面板显示过期进度 | UI 上标注 `state`（cached/loading），运行中会话必有实时推送 |
| 7 | `ctx.jobs` 无全局 roster，只能按 session 开流 | 会话多时流数量 | 只对"近期活跃/运行中"会话开流；或阶段 3 用 Host 路由汇总 |
| 8 | `/api/changes.summary` 由 `dsh-client-ui-deliverables` 提供，非核心 API | 可能被禁用/改名 | 用 try/catch + 特性探测；不要把核心面板绑死在它上面 |
| 9 | 自定义 Remote（阶段 3）需要 Typert descriptor 与 DSH 版本对齐 | 升级易碎 | 仅在阶段 2 无法满足时采用，并以 whale-pet 的 `$mount`+`ctx.inject(['remote.<ns>'])` 模式照抄 |

---

## 6. 证据附录

**inspect（Host，本轮实测）**
- `Service.listService`（全量目录）+ 逐服务：`sessionProjections`、`sessions`、`sessionQuery`、`subagents`、`agentTeams`、`workspaceChanges`、`workspaceController`、`workspaceFiles`、`workflowEngine`、`jobs`、`jobController`、`goals`、`schedule`
- `Event.listEvents`（全量目录）：`api-session/*`、`subagent/start|end`、`workflow/*`、`agent/status`、`tools/result`、`goal/changed`、`schedule/changed`、`session/event`
- 限制：Client `Service.listService` / `Slots` 超时（页面未响应）。

**已安装包源码（app.asar，read 工具）**
- `@deepseek-ai/dsh-api-session-controller/lib/{index.js,client.js,typert.host.js}`：`SessionSummary`、`SessionProjectionMap`、`SessionProjectionHints`、`ClientSessions.projectList`、`refreshProjections`、`api-session/*` 订阅、`remote.session.control` 流
- `@deepseek-ai/dsh-session-projection/lib/index.js` + `README.md`：unit 契约、register 校验、onChanged
- `@deepseek-ai/dsh-api-remotes/README.md`：**转发事件 allowlist** 与资源鉴权
- `@deepseek-ai/dsh-subagent/lib/index.js`：`subagentCatalog`/`subagent`/`subagentTiming` 投影定义、`subagent/start|end` payload、`listChildren` 读投影
- `@deepseek-ai/dsh-tool-workflow/lib/index.js`：`tool-workflow/*` 事件与 recorder
- `@deepseek-ai/dsh-api-job-controller/lib/client.js`：`ctx.jobs` / `job.list|follow|kill`
- `@deepseek-ai/dsh-workspace-changes/README.md`：`workspace/changes` + `summary/diff`（Host-only）
- `@deepseek-ai/dsh-client-ui-deliverables/lib/{index.js,client.js}`：`ctx.connection.fetch.register` 路由 + `/api/changes.summary|diff`
- `@deepseek-ai/dsh-cordis-client-runner/lib/client.js`：Client Service/Slot 契约目录（含 `SessionListState`、`SessionSnapshot`、`useSessions`、`useSessionStatus`、`useProjection`、`main`/`sidebar.panellist` 的注册选项与 standard props）
- `@deepseek-ai/dsh-client-ui-subagent/lib/client.js`：子 agent 树取数/懒加载的参考实现
- `@deepseek-ai/dsh-client-ui-workspace/lib/client.js`：`sessionNode()`（running/子代理数/待交互/未读完成）
- `@deepseek-ai/dsh-client-ui-schedule/lib/client.js`：`main` + `sidebar.panellist` 整页注册先例
- `@deepseek-ai/dsh-web-app/cordis.patch.yml`、`@deepseek-ai/dsh-base/cordis.patch.yml`：确认 `ui-deliverables`/`ui-workflow-run`/`ui-subagent`/`ui-jobs`/`ui-schedule`/`ui-goal`、`session-projection(-cache)`、`dsh-subagent`、`dsh-jobs-local` 均已挂载
- `dsh-plugin-whale-pet/lib/*`（profile 已安装的第三方插件）：**自定义 Remote stream 的完整可行先例**（`ctx.provide` + `typertRemote` + TYPERT 反射 + client `$mount` + `ctx.inject(['remote.<ns>'])`），以及 `useSessions/useSessionStatus` 在 slot 内的真实用法

**文档**
- skill `cordis-plugin-development` → `references/practices.md`（wire.view / sessionProjections / slot / 不要 require 宿主 Client 包）、`references/host-plugin.md`
