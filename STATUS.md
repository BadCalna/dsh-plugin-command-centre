# STATUS — Command Centre

> 最后更新：2026-10-27 · V1a (v0.1) 上线验收；v0.2 看板/快捷键/避让/科技感改造已提交，等待重装验收。

## 现在是什么状态

**V1a 完成（v0.1 真机验收通过）；v0.2 改造已写完并提交，待重装后验收。**

- 包位置：`plugin/`（包名 `@local/dsh-plugin-mission-control`，`file:` 装进 desktop profile）
- 入口：左侧面板列表「Command Centre」图标 + 全局 `⌘P`
- 版本：`v0.1.0`（分组矩阵）→ `v0.2.0`（默认看板 + ⌘P + chrome 避让 + 科技感样式）
- git：本仓库，两个提交
  - `69f554a` V1a 基线（矩阵/抽屉/跳转/键盘）
  - `c1b45bd` Command Centre v0.2.0（看板/快捷键/避让/改名/样式）

### v0.2 具体改了什么（用户四条反馈 → 落地）

| 反馈 | 落地 |
|---|---|
| 想看板形式 | 看板 = 默认视图（需要你 / 运行中 / 空闲 三列，卡片内嵌第一层子 agent）；矩阵保留为第二视图，`v` 或顶部分段按钮切换 |
| ⌘B 收起侧栏后回不去 | 注册全局快捷键 `⌘P`（web 用 `⌘⌥P`），open/return 双向；出现在「设置 → 快捷键」目录，可改键 |
| 标题被窗口按钮遮挡 | darwin 下 header 用 `--dsh-frame-top-clearance`（48px）做顶距；侧栏收起时用 `--dsh-frame-leading-clearance`（160px）做左距；抽屉标题同样避让 |
| 改名 + 去副标题 + 科技感 | 全面改名 `Command Centre`；删掉「一屏看…」副标题；等宽字体标签（AGENTS / CTX / OUT）、点阵背景、列顶部强调线、卡片左侧状态条、运行态脉冲点、`01/02` 补零计数、暗色友好的 token 混合色 |

### v0.1 家底（仍在）

- 分组/看板行：状态点、代理链 `主+N子`、todo 进度、上下文 %、活动时间
- 需要你横幅（approval / plan-review / question），处理完自动消失
- 详情抽屉：概览 / goal / agentTeam（成员 + 共享任务）/ todo 全量 / 子任务 / 产出占位
- 跳转：`o` / `↗` / 双击；键盘 `j k Enter Esc f s v /`；搜索 + 工作区筛选 + 安静模式
- ErrorBoundary：面板抛错只降级不空白

## 迭代方式（重要）

pnpm 装的是**快照副本**，不是软链。改了 `plugin/` 里任何文件：

1. 插件页 → 「Command Centre」→ **卸载**
2. **安装插件** → 安装源粘贴 `/Users/jaychen/Documents/MissionDashboard/plugin`
3. 纯 Client 改动（`client.js` / locale / icon）通常热生效；页面还是旧样子先 `⌘R` 刷新，
   再不行重启 App
4. **Host half（`index.js`）改动必须重启 App** 才会加载新模块

## 下一步：V1b（产出列）

要补的字段，都放进 **一个** Host 投影 `missionControl`（小 JSON，别放大文本）：

| 字段 | fold 来源 | 用途 |
|---|---|---|
| `changedFiles`（count + 最近 3 个 path） | `workspace/changes` | 卡片 `OUT` 列 + 抽屉「产出 · 文件区」 |
| `lastAssistantText`（截断 ≤200 字符） | `assistant/message` | 卡片摘要 + 抽屉「产出 · 对话区」 |
| `lastToolName` / `lastToolError` | `tool/call`、`tool/result` | 抽屉「最近活动」 |
| `turn` / `lastTurnEndReason` | `turn/start`、`turn/end` | 「失败」分组（`blocked/error/max-tokens`） |

落地顺序建议：

1. 先只加 `changedFiles` + `lastAssistantText` 两个字段（UI 里「文件区 / 对话区」占位已预留）
2. 装 + 重启一次 App，确认 wire 投影真的到 Client（`projectionsBySession[id].values.missionControl`）
3. 再补 `lastToolName` / `turn end reason`，把「失败」分组和「最近活动」换成真数据
4. 约束：`stateVersion: 1` 起步，字段语义变了必须 bump；control baseline 广播给所有 Client，
   所以只能放计数 / 枚举 / 截断文本

## 已知未做（别当 bug）

- 产出列当前是 `OUT —`（等 V1b）
- 没有「失败」分组（Client 侧没有跨会话失败信号）
- 刷新页面回对话页（宿主 layout 不持久化 `activePanelId`）→ 用 `⌘P` 回来
- 没做「启动即默认打开」（提案 Q5：先不做）
- 看板列只看所有工作区（可下拉筛选；Q4「只看当前工作区」还没定，因为 Client 拿不到
  「当前工作区」这个值，只有 `workspaces.items[].sessionIds`）
- 没做批准/回答/打断（Q3 只读；要 V2 的动作通道）
- 看板不支持拖拽改状态（状态是 Host 推的，拖了也没地方写）

## 文件地图

```
design/            交接资料（00-提案 / concepts / panel-api / data-signals / HANDOFF）
plugin/            插件包（package.json / cordis.patch.yml / index.js / client.js / locale / icon.svg / README.md）
tools/smoke-client.cjs   离线逻辑冒烟测试（stub React，无 DOM；不替代真机验收）
STATUS.md          本文件
```

## 自测命令

```bash
node --check plugin/client.js
node --check plugin/index.js
node tools/smoke-client.cjs
```

冒烟测试断言：ModuleLoader 工厂 → `apply` 注册 `main:mission` 与 `sidebar.panellist:mission`
（两者逐字相同）→ 中英词典（含所有字面量 / 动态 key）→ `⌘P` 注册与 resolve →
看板渲染（三列 / 卡片 / 子行 / 指标）→ 点卡片出抽屉 → 输出无 `undefined` / `NaN` / `[object Object]`。
