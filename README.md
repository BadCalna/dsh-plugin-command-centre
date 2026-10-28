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
- **卡片**：状态点、标题、工作区、`AGENTS 主+2子`（含活跃数）、`CTX 62%`、todo 分段进度、最后活动、
  **产出码**（`OUT 1D` = 交付了 1 个交付物 / `OUT 2F` = 写了 2 个文件 / `TXT` = 有回答 / `ERR` = 出错，悬停看内容）
- **四个看板列**：需要你 / 运行中 / **失败** / 空闲；失败来自宿主的 `turn/end.reason`
  （`error` / `blocked` / `max-tokens`）
- **subagent**：卡片内嵌第一层子 agent（`−N` 收起 / `+N` 展开 / 更深层显示 `+N` 计数）
- **需要你横幅**：审批 / 计划审核 / 提问被顶到最上方，处理完自动消失
- **详情抽屉**：概览 / 目标（goal）/ 团队 / todo 全量 / 子任务 / **产出区（交付物 + 文件区 + 对话区，真实数据）**；
  **交付物**来自会话日志的 `deliverables/presented`（agent 用 `present` 交出来的文件），所以**脚本生成**的
  pptx/xlsx/png 也算产出，不再只看 `write`/`edit`；写的脚本/中间文件仍列在下面；
  点文件 → 面板内**文件预览**（文本/代码按行读、图片走 `remote.workspaceFiles.readBytes` 转 blob，其他类型给「在桌面打开」）；
  预览走 `remote.workspaceFiles` / `remote.session` 两个命名空间（`ctx.inject` 必须声明 `remote.<ns>`，只声明 `remote` 会在运行时报 `without inject`），
  结果按 `{ ok, value }` 信封解包，「在桌面打开」先把相对路径经 `stat.absolutePath` 绝对化
- **设置（⚙）**：默认界面（看板 / 矩阵 / 画布）、**主题（跟随系统 / 亮 / 暗，亮暗两套都覆盖宿主 token，强制亮/暗不会漏色）**、
  安静模式默认开、是否记住上次界面
- **节点间投递**：把抽屉「产出 · 文件区」里的文件**拖到看板卡片或画布节点**上 → 确认框 →
  以 `queue` 模式向目标会话投一条带文件路径的用户消息（不会打断正在跑的回合）；
  可选附带来源会话的最近回答摘要。文件不拷贝，目标 agent 用自己的工具读。
  在画布上尤其顺手：点开 A 节点的抽屉看产出、直接把文件行拖到画布上可见的 B 节点——抽屉打开时
  遮罩层不再吃掉拖放事件（拖拽期间节点高亮成可投放目标），松开即进入投递确认
- **对话区**做轻量 markdown 扁平化（去 `**`、标题、列表符号），不引第三方库
- **跳转**：`打开对话` 回到 Conversation（`↗`、双击卡片、`o`）
- **快捷键**：`⌘⇧P`（Windows / Linux 为 `Ctrl+Shift+P`）打开 / 返回面板；可在 **设置 → 快捷键** 改键
- **节点式画布**：`v` 切到「画布」，任务变成节点、父子关系连线，单子节点不换行；
  默认 **纵（上→下）+ 直角连线**；左上角可切方向（横/纵）、连线（曲线/直角）；
  **节点可拖**（拖动一个节点时它的整棵子树一起走，连线跟随，`↺` 重置）；子节点挂在**弹簧**上跟随，
  起步同帧、快速拖动时轻微拖尾、松手收一下再落定（拖尾上限 26px，不会散架；`prefers-reduced-motion` 下改为刚性平移）；
  空白处拖拽平移、**滚轮直接缩放**、Shift+滚轮平移、`0` 适配全图；
  只画节点和连线：不再套「根子树」分组框和重复标题（标题就在节点里，从属关系看连线 + `主/子` 标记）；
  节点是**圆角矩形**；**连线端点会自动选边**（按两个节点的相对位置挑最近的父/子边，端点沿边滑向对方，
  多子节点自然分叉，不再固定钉在卡片右侧），拖动节点到任意方位都会重新选边；
  连线加粗并带主题强调色，选中节点的上下游连线会高亮发光；
  从看板卡片右上角 `⌗` 进入会自动 fit 到该任务的子树。子树范围按**当前选中节点**往下取；
  布局选择与手动位置存 `localStorage`（`dsh.command-centre.canvas.v1`），刷新/重启保持
- **「← 指挥台」返回按钮**：从指挥台跳进对话后，对话头部会多一个 `← 指挥台` 小按钮，点它回到 Command Centre
  **并恢复离开前的视图和选中的任务**（画布/看板/矩阵 + 选中节点 + 画布聚焦位置）；它占的是宿主的
  `conversation.header.leading` 槽位（root scope、当前无宿主占用、替换风险 `none`），不遮蔽任何宿主 UI
- **画布右键节点**：`继续对话` / `查看工作轨迹` / `修改标题` / `打开对话`
  - **继续对话**：就在节点旁弹一个输入框，`Enter` 发送（`queue` 模式，排到下一轮、不打断正在跑的回合），
    每次草稿带 `requestId`，重复点不会重复投递；发完显示「已排队，下一轮送到」
  - **查看工作轨迹**：优先打开**宿主原生的「轨迹」标签**（会话视图，best-effort：会把该会话的视图偏好设成
    `trajectory` 再打开对话）；原生不可用时（没开「设置 → 通用 → 显示代码工作视图」，或该部署没挂载轨迹视图）
    退化为右侧的**面板内紧凑轨迹**——回合分隔、工具调用 + 文件/命令、回答摘要、交付物、工具错误，
    数据来自会话已加载的事件窗口（冷会话也能读、不唤醒 Agent，只覆盖最近窗口）
  - **修改标题**：走宿主 `session.rename`（durable、进会话日志）；注意宿主会先 resume 这个会话
- **性能**：面板不在前台时宿主会**卸载**整个组件（keyed `main` slot），聊天/输入时没有本插件的渲染、定时器、监听器和 CSS；
  Host 投影约 0.13µs/事件（一个回合 ~0.04ms）、状态 ~0.6KB/会话；打开面板时只**预热前 8 个会话**的投影（v0.9.4 起，之前会一次唤醒 80 个冷会话的日志加载）
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

> 在插件的输入框（搜索 / 画布发问 / 改标题）里打字**不会**触发这些单键快捷键，也不会穿透到宿主的全局快捷键：
> 输入框会把未带修饰键的按键拦在自己这一层；中文输入法组字期间（`isComposing`/keyCode 229）的回车也不会误发送。
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

- **产出是折叠来的、不是 diff**：`files` 来自 `tool/call` 里 `write`/`edit` 的 `file_path`（最近 5 个，
  计数是累计写入次数），不是 git 级别的改动列表；最后回答截断到 200 字符
- **只读**：批准 / 回答 / 打断都不做
- **不持久化面板选中态**：刷新回对话页，所以给了 `⌘⇧P`
- **不支持拖拽改状态**：状态来自宿主投影，拖了也没地方写
- **画布不能画 workflow 阶段节点**：`workflow/*` 是 Host 事件、不转发，要等 Host 投影（V1b 之后）
- **画布位置存本机 Host 文件**（`~/.dsh/command-centre/canvas.json`），不跟随账号/换机器
- **投递是写操作**：会在目标会话里排一条用户消息（`queue` 模式，不打断运行中的回合）；
  是路径引用，不是文件拷贝；目标是 subagent 会话时可能被宿主拒绝（会显示错误）
- **投递没有撤销**：发出去就是一条排队消息，取消请到目标会话里删
- **文件预览是面板内的**，不是宿主右栏的原生预览面板（宿主没暴露打开它的 Client API）
- 只看所有工作区（可下拉过滤；「只看当前工作区」需要宿主暴露当前工作区，暂缺）
- **返回按钮寄宿在宿主槽位**：如果某个版本的宿主自己占用了 `conversation.header.leading`，我们的注册会被拒绝
  （插件只打 warn 并跳过，不影响其它功能），此时仍可用 `⌘⇧P` 或侧栏图标回来
- **工作轨迹只是最近窗口**：首屏历史按「≥50 条消息 / ≥2 回合、上限 500」加载，更早的要 `loadOlder()`；
  也不支持「跳到某一条消息」（宿主没有暴露 anchor/seq 深链），只能先打开对话
- **改标题会唤醒会话**：宿主 rename 前会 resume 冷会话；子 agent 会话/被别的 writer 占住时会返回宿主错误
- **继续对话对子会话有限制**：one-shot 子会话只读、归档会话发进去可能被 gate 成 blocked（宿主行为，插件只显示错误）

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
| 交付物（脚本生成也算） | Host 投影 `missionControl.deliverables`，fold 会话日志的 `deliverables/presented` |
| 工作轨迹（最近动作） | `sessions.using(id, …, ref => ref.binding.eventSource.getSnapshot().entries)`，按 turn/tool/回答/交付折叠 |
| 改标题 | `sessions.using(id, …, ref => ref.binding.session.rename(title))` → `remote.session.rename` |

冷会话投影用 `ctx.sessions.refreshProjections(id)` 拉一次（不 retain、不开流）。

## 开发

无构建步骤：纯 JS + CSS（`window.__ModuleLoader__` 约定，无 JSX，不 require 任何宿主 Client 包）。

```
client.js            # 全部 UI + 数据派生 + 快捷键
index.js             # Host half：missionControl 投影 + canvas 偏好持久化路由
cordis.patch.yml     # 插入一条 id: mission-control 的插件行
locale/{zh,en}.json  # 插件管理页展示用的 meta（运行时词典在 client.js）
icon.svg             # 侧栏 + 插件页图标
scripts/smoke-client.cjs   # 离线逻辑冒烟测试（stub React，无 DOM）
docs/                # 设计调研、视觉规范、状态记录
```

```bash
node --check client.js
node --check index.js
node scripts/smoke-client.cjs   # Client：渲染树 + 交互 + 画布弹簧拖拽
node scripts/smoke-host.mjs     # Host：missionControl 投影 fold（含 deliverables）
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
