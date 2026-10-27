# 任务指挥台（Mission Control）— V1a

DSH Web UI 插件：在 `main` 面板里加一个整页「任务指挥台」，并在左侧面板列表加一个同名图标。
纯增量、可卸载，与「对话」面板共存（不 shadow `root` / `sidebar` / `rightbar`）。

**V1a = 纯 Client、只读、0 行 Host。**

## 它做什么

一屏看所有对话任务，按状态分组，第一层 subagent 默认展开在父行下面：

- **分组**：需要你（批准 / 计划审核 / 提问）→ 运行中 → 空闲
- **每行**：状态点、标题、代理链（`主+3子` / `子`）、todo 进度条（`3/4`）、
  上下文占用（`62%`）、最后活动时间
- **子 agent**：第一层默认展开（`−N` 收起 / `+N` 展开），超过一层时显示 `+N` 计数
- **需要你横幅**：有待处理交互的任务被顶到最上面，处理完自动消失
- **详情抽屉**：概览 / 目标（goal）/ 团队（agentTeam 成员 + 共享任务）/
  todo 全量 / 子任务 / 产出区
- **跳转**：`打开对话` 回 Conversation（点 `↗`、双击行、或按 `o`）
- **键盘**：`j/k` 移动、`Enter` 详情、`o` 打开、`Esc` 关闭、`f` 过滤、`s` 安静模式、`/` 搜索
- **过滤**：搜索框、工作区下拉、全部/只看活跃/只看待你

## 它现在**不做**什么（V1b 再补）

- **产出列**：显示占位 `—`。文件写入 / 最后回答要一个 Host 投影
  （`changedFiles` + 截断的 `lastAssistantText`），V1a 故意不猜、不抓会话历史
- **失败分组**：Client 侧没有跨会话失败信号（`api-session/error` 只对已 retain 的会话可见）；
  `turn/end.reason` 也只能靠 Host 投影，跟着 V1b 一起做
- **可写操作**：批准 / 回答 / 打断一律不做，只在抽屉里跳回对话
- **workflow run**：`workflow/*` 是 Host 事件、不转发，V2 再评估
- **面板选中态持久化**：刷新回对话页（宿主 layout 不持久化）

## 安装

前提：DSH Desktop 0.2.1-rc.3（Web 端 `main` / `sidebar.panellist` / `locale` 契约）。

在 Harness Web UI：

1. 左侧 **插件** 页 → **安装插件**
2. 安装源填本地目录（绝对路径）：
   ```
   /Users/jaychen/Documents/MissionDashboard/plugin
   ```
3. 安装完成后：
   - 左侧面板列表出现「任务指挥台」图标（在「插件」「自动化任务」下面）
   - 点它 → 中列变成指挥台；点左侧任意会话 → 回到对话

安装 → 卸载：插件页里对该插件 `停用` / `删除` 即可（只是新增一条 bundle）。

## 数据来源（全部是 Client 现成投影）

| 信号 | 来源 |
|---|---|
| 会话 + `parentId` 树 | `useSessions(s => s)`（`ids` / `byId` / `projectionsBySession`） |
| running / 待你 / 未读 | `useSessionStatus(m => m)`（Map：`running` / `pendingInteraction.kind` / `completionUnread`） |
| 工作区名 | `useWorkspaces(s => s)` 的 `items[].sessionIds` |
| todo 进度 | 投影 `todos`（`{content, status}`） |
| 上下文 % | 投影 `contextPressure`（`projectedTokens` / `contextWindow`） |
| token 数 | 投影 `tokenUsage` |
| 子 agent 时长 | 投影 `subagentTiming`（`settledMs` + `active` + `lastTurnCompleted`） |
| 子 agent 目录 | 投影 `subagentCatalog`（`mode` / `label`） |
| 目标 | 投影 `goal` |
| 团队 | 投影 `agentTeam`（`members` / `tasks`） |

冷会话的投影用 `ctx.sessions.refreshProjections(id)` 拉一次（不 retain、不开历史流）。

## 结构

```
plugin/
  package.json          # 包名 = ModuleLoader id = 主 key；dsh.bundle.patch + dsh.client
  cordis.patch.yml      # insert 一条 id: mission-control
  index.js              # Host half：空 apply（Client half 靠这一行下发）
  client.js             # 全部 UI + 数据派生（无宿主 Client 包依赖，无 JSX）
  locale/{zh,en}.json   # 插件管理页显示的 meta.title / meta.description
  icon.svg              # 侧栏 + 插件页图标
tools/
  smoke-client.cjs      # 离线逻辑冒烟测试（stub React，无 DOM）
```

## 自测

```bash
node --check plugin/client.js
node --check plugin/index.js
node tools/smoke-client.cjs
```

冒烟测试覆盖：ModuleLoader 工厂 → `apply(ctx)` 注册的两个 slot（`main:mission` /
`sidebar.panellist:mission`，两者逐字相同）→ 中英词典 → 用示例数据渲染整页
（分组、子行、进度、上下文、需要你横幅）→ 点行打开抽屉（概览 / 目标 / 团队 /
进度 / 子任务 / 产出区），并断言输出里没有 `undefined` / `NaN` / `[object Object]`。

> 这是**逻辑**测试，不是视觉验收。真机效果以装进 Harness 后看到的页面为准。

## 设计依据

- `design/00-提案.md`：推荐方案、线框、版本切分
- `design/concepts.md`：三种范式、交互细节
- `design/panel-api.md`：slot / props / `selectPanel` 契约
- `design/data-signals.md`：信号可达性与刷新方式
- 已拍板：Q1 分组矩阵 + 行内嵌子树；Q2 产出拆「文件区 + 对话区」（V1b 落地）；
  Q3 V1 只读 + 跳转
