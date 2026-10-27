# Command Centre · 任务指挥台

[![license: MIT](https://img.shields.io/badge/license-MIT-0a6c7e.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/DSH-0.2.1--rc.3-57e2ff.svg)](#安装)
[![tag: dsh-plugin](https://img.shields.io/badge/tag-dsh--plugin-555.svg)](#deepseek-harness-plugin)

给 **DeepSeek Harness** 的 Web UI 加一个整页「Command Centre」：
**一屏看所有对话任务的进度、subagent 关系和产出**，替代「左列表 / 中对话 / 右输出」那种
"一次只能看一个对话"的视角。

纯增量插件：新增一个 `main` 面板 + 左侧一个图标 + 一个全局快捷键，**不替换**宿主的
`root` / `sidebar` / `rightbar`，随时可卸载。

> **V1a：只读**。它是观察台 + 跳转器，不做批准 / 回答 / 打断（那是 V2 的动作通道）。

```
┌ ◆ COMMAND CENTRE ── [03 运行] [02 待你] [00 空闲] ── [看板|矩阵] [搜索] [过滤] ┐
│ ⚠ 需要你 · 02   支付重构 · 待批准            登录超时 · 待回答                   │
├──────────────┬──────────────────────┬──────────────────────┐
│ CH-01 需要你 │ CH-02 运行中         │ CH-03 空闲           │
│ ┌──────────┐ │ ┌──────────────────┐ │ ┌──────────────────┐ │
│ │支付重构  │ │ │修复登录超时      │ │ │整理会议纪要      │ │
│ │待批准    │ │ │AGENTS 主+2子 1跑 │ │ │AGENTS 主         │ │
│ │AGENTS 主 │ │ │CTX 69%           │ │ │CTX 12%           │ │
│ │CTX —     │ │ │▓▓░░░░ 1/3        │ │ │░░░░░░ —          │ │
│ │OUT —     │ │ │ ├ 定位超时 4m前  │ │ │OUT —             │ │
│ └──────────┘ │ │ └ 写回归测试 3m前│ │ └──────────────────┘ │
├──────────────┴──────────────────────┴──────────────────────┤
│ SYS // j/k 移动 · Enter 详情 · o 打开 · v 视图 · f 过滤      │
└────────────────────────────────────────────────────────────┘
```

## 能做什么

- **看板（默认）**：`需要你` / `运行中` / `空闲` 三列，列头带 `CH-0N` 编号与计数；按 `v` 切到矩阵视图
- **卡片**：状态点、标题、工作区、`AGENTS 主+2子`（含活跃数）、`CTX 62%`、todo 分段进度、最后活动、`OUT —`
- **subagent**：卡片内嵌第一层子 agent（`−N` 收起 / `+N` 展开 / 更深层显示 `+N` 计数）
- **需要你横幅**：审批 / 计划审核 / 提问被顶到最上方，处理完自动消失
- **详情抽屉**：概览 / 目标（goal）/ 团队（agentTeam 成员与共享任务）/ todo 全量 / 子任务 / 产出区
- **跳转**：`打开对话` 回到 Conversation（`↗`、双击卡片、`o`）
- **快捷键**：`⌘⇧P`（Windows / Linux 为 `Ctrl+Shift+P`）打开 / 返回面板；可在 **设置 → 快捷键** 改键
- **节点式画布**：`v` 切到「画布」，任务变成节点、父子关系连线，单子节点不换行；
  画布左上角可切 **方向（横/纵）**、**范围（全部/子树）**、**连线（曲线/直角）**；
  拖拽平移、`⌘`+滚轮缩放、`0` 适配全图；从看板卡片右上角 `⌗` 进入会自动 fit 到该任务的子树
- **过滤**：搜索、工作区下拉、全部 / 只看活跃 / 只看待你
- **安静模式**（`s`）：降饱和，长时间盯屏不刺眼

## 快捷键

| 键 | 动作 |
|---|---|
| `⌘⇧P` | 打开 / 返回 Command Centre（侧栏 `⌘B` 收起后也能回到这里） |
| `j` / `k`，`↓` / `↑` | 在任务之间移动 |
| `Enter` | 打开详情抽屉 |
| `o` | 打开该任务的对话 |
| `v` | 视图循环：看板 → 矩阵 → 画布 |
| `0` | 画布：适配全图（`⌖` 按钮同效） |
| 画布左上 | 横/纵布局、全部/子树范围、曲线/直角连线 |
| `f` | 过滤循环（全部 → 只看活跃 → 只看待你） |
| `s` | 安静模式 |
| `/` | 聚焦搜索 |
| `Esc` | 关闭抽屉 |

> 为什么不是 `⌘P`：它被宿主的「工作区文件」面板占用（`workspace.files`），
> 宿主的快捷键服务对冲突是**拒绝**而不是覆盖，所以插件用 `⌘⇧P`。

## 安装

**前提**：DeepSeek Harness `0.2.1-rc.3`（`main` / `sidebar.panellist` / `locale` / `shortcuts`
契约在该版本核对过；其他版本可能需要小改）。

在 Harness Web UI 里：左侧 **插件** → **安装插件** → 安装源填下面任一：

```
github:BadCalna/dsh-plugin-command-centre
```

或本地目录 / 软链（开发时推荐）：

```
link:/absolute/path/to/dsh-plugin-command-centre
```

装完左侧面板列表出现 **Command Centre**，按 `⌘⇧P` 或点图标进入。
卸载：插件页里对该插件「停用 / 删除」即可，不改动宿主任何文件。

> 用命令行 profile（非桌面 App 独占管理的 profile）时等价命令：
> `dsh plugin --profile <name> add github:BadCalna/dsh-plugin-command-centre`，
> 再把它加进该 profile 的 `dsh.profile.bundles`（插件管理页会代劳）。

## 它现在**不做**什么

- **产出**列显示 `OUT —`：文件写入 / 最后回答需要宿主侧投影，V1b 才做
- **没有「失败」列**：Client 侧拿不到跨会话失败信号（`turn/end.reason` 需要 Host 投影）
- **只读**：批准 / 回答 / 打断都不做
- **不持久化面板选中态**：刷新回对话页，所以给了 `⌘⇧P`
- **不支持拖拽改状态**：状态来自宿主投影，拖了也没地方写
- **画布不能画 workflow 阶段节点**：`workflow/*` 是 Host 事件、不转发，要等 Host 投影（V1b 之后）
- **画布节点位置不持久化**：现在是自动布局；手动拖节点（P2）才会考虑存 localStorage
- 只看所有工作区（可下拉过滤；「只看当前工作区」需要宿主暴露当前工作区，暂缺）

## 数据来源

全部来自宿主 Client 已有投影，不额外开历史流：

| 信号 | 来源 |
|---|---|
| 会话列表 + `parentId` 树 | `useSessions(s => s)` |
| running / 待处理 / 未读 | `useSessionStatus(m => m)` |
| 工作区名 | `useWorkspaces(s => s)` |
| todo 进度 | 投影 `todos` |
| 上下文占用 | 投影 `contextPressure` |
| token 数 | 投影 `tokenUsage` |
| 子 agent 目录 / 时长 | 投影 `subagentCatalog` / `subagentTiming` |
| 目标 / 团队 | 投影 `goal` / `agentTeam` |

冷会话投影用 `ctx.sessions.refreshProjections(id)` 拉一次（不 retain、不开流）。

## 开发

无构建步骤：纯 JS + CSS（`window.__ModuleLoader__` 约定，无 JSX，不 require 任何宿主 Client 包）。

```
client.js            # 全部 UI + 数据派生 + 快捷键
index.js             # Host half（V1a 为空 apply；Client half 靠这条 loader row 下发）
cordis.patch.yml     # 插入一条 id: mission-control 的插件行
locale/{zh,en}.json  # 插件管理页展示用的 meta（运行时词典在 client.js）
icon.svg             # 侧栏 + 插件页图标
scripts/smoke-client.cjs   # 离线逻辑冒烟测试（stub React，无 DOM）
docs/                # 设计调研、视觉规范、状态记录
```

```bash
node --check client.js
node scripts/smoke-client.cjs
```

冒烟测试覆盖：模块工厂 → `apply` 注册两个 slot（`main:mission` 与 `sidebar.panellist:mission`
逐字相同）→ 中英词典完整性 → `⌘⇧P` 注册与 resolve → 示例数据渲染整页看板 →
点卡片出抽屉，并断言输出无 `undefined` / `NaN` / `[object Object]`。
这是**逻辑**测试，不替代真机视觉验收。

本地迭代：`link:` 安装时 pnpm 建软链，改完 `⌘R` 刷新即可；目录安装时是硬链接，
**原地改文件**会同步，但"删了重建"会断链（`ln -f` 可修）。

## 设计文档

`docs/design/` 是完整的可行性调研：渲染面拓扑、slot 契约、数据可达矩阵、三种范式线框；
`docs/design/visual-cyberpunk.md` 是赛博朋克视觉规范（参考案例 → CSS 落地映射）；
`docs/design/node-canvas.md` 是节点画布的布局算法、交互与分阶段规划。

## DeepSeek Harness plugin

本仓库按 DSH 插件约定打包，供搜索与安装识别：

- 包名：`dsh-plugin-command-centre`（`dsh-plugin-` 前缀是社区惯例）
- npm `keywords`：`dsh-plugin`、`deepseek-harness`、`dsh`、`plugin`、`mission-control`、`kanban`、`dashboard`、`cyberpunk`
- GitHub topics：`dsh-plugin`、`deepseek-harness`、`dsh`、`harness-plugin`、`kanban`、`mission-control`、`cyberpunk`
- 清单：`package.json` 的 `dsh.bundle.patch` + `dsh.client`，`cordis.patch.yml` 只 `insert` 一行

## License

MIT
