# STATUS — Command Centre

> 最后更新：2026-10-28 · v0.9.4（输入框按键隔离/IME + 主题切换 + 懒加载投影；性能结论）。

## 现在是什么状态

**V1a 完成并真机验收；v0.2（看板/⌘⇧P/避让）已验收；v0.3（赛博朋克视觉）代码已落地，待 ⌘R 验收。**

- 包：仓库根即插件包，包名 **`dsh-plugin-command-centre`**（原 `@local/dsh-plugin-mission-control`）
- 入口：左侧面板列表「Command Centre」图标 + 全局 **`⌘⇧P`**
- 仓库：GitHub `BadCalna/dsh-plugin-command-centre`（public），MIT
- 版本历史：
  - `v0.1.0` 分组矩阵 / 抽屉 / 跳转 / 键盘（已验收）
  - `v0.2.0` 默认看板 + `⌘⇧P` + macOS chrome 避让 + 改名（已验收）
  - `v0.3.0` 赛博朋克「Cold Console」视觉系统（`docs/design/visual-cyberpunk.md`）
  - `v0.3.1` 修复快捷键全平台预校验导致的"一个键都没注册"；动效加强（扫光/扫描带/边框呼吸/点脉动）
  - `v0.4.0` 节点式画布 P0：分层树布局 + 平移缩放 + fit + 卡片 `⌗` 聚焦 + 运行中边流动；视图循环 看板→矩阵→画布
  - `v0.5.0` 画布布局开关：方向（横/纵）、范围（全部/子树）、连线（曲线/直角）；冒烟测试覆盖三种切换
  - `v0.5.1` 画布可用性修复：节点可拖（边/簇框跟随、↺ 重置）、空白拖拽平移、点击不误选；子树范围改为按选中节点回溯（之前按根，只有一个根时无效）
  - `v0.6.0` 画布默认改 纵+直角；方向/范围/连线 + 手动位置存 localStorage（250ms 防抖，刷新保持，↺ 清空）
  - `v0.7.0` **V1b**：Host 投影 `missionControl`（最后回答 200 字 / 写入文件最近 5 个+次数 / 最后工具 / turn 结果）；
    看板/matrix/画布新增「失败」列；产出列与抽屉「文件区 + 对话区」换成真数据；
    画布偏好改存 Host（`~/.dsh/command-centre/canvas.json`，路由 `/api/command-centre.prefs`），跨重启保持
  - `v0.8.0` 画布：连线加粗+主题色+选中链路高亮、滚轮直接缩放（Shift+滚轮平移）、去掉「子树」范围开关；
    产出文件可点开面板内预览（文本/代码/图片 + 在桌面打开，走 `remote.workspaceFiles` / `remote.session.openWorkspacePath`）；
    新增 ⚙ 设置：默认界面 / 安静模式默认开 / 记住上次界面（存 Host prefs）
  - `v0.9.0` 节点间**投递**：抽屉文件行可拖到看板卡片 / 画布节点 → 确认框（目标、文件、可选附带来源摘要）
    → `sessions.using(...).binding.session.prompt([{type:'text'}], 'queue')`；对话区 markdown 扁平化
  - `v0.9.1` 画布去掉「工作区」感的根子树分组框（虚线簇框 + 标题副本）：标题节点卡片里已有，
    从属关系靠连线 + `主/子` 标记；顺带解决簇框标题压住左上角布局开关、多个根时标题互压
  - `v0.9.2` ① 画布拖节点时**整棵子树跟着走**（子节点走轻微欠阻尼弹簧：起步同帧、快速拖轻微拖尾、
    松手收一下，拖尾上限 26px，`prefers-reduced-motion` 下降级为刚性）；
    ② Host 投影 fold 会话日志的 `deliverables/presented`（**stateVersion 2**）→ 抽屉「交付物」，
    **脚本（bash）生成的 pptx/xlsx/png 也能进产出区**（此前只认 write/edit，pptx 完全不可见）；
    ③ 文件预览修好：`ctx.inject` 必须声明 `remote.workspaceFiles` / `remote.session` 命名空间
    （之前只声明 `remote`，运行时报 `cannot get property "remote.workspaceFiles" without inject`）；
    远程调用按 `{ ok, value }` 信封解包（之前直接读裸值 → 文本显示「—」、图片报 empty payload）；
    图片改走 `remote.workspaceFiles.readBytes` + blob URL；「在桌面打开」先 `stat` 取 `absolutePath`
    （Host 按自己的 cwd 解析相对路径，传相对路径会失败）；
    ④ 新增 `scripts/smoke-host.mjs` 覆盖投影 fold；Client 冒烟补：远程命名空间注入、信封解包、
    stat 绝对化、交付物渲染、画布子树弹簧拖拽
  - `v0.9.3` ① 连线**端点智能选边**：按两节点相对位置选最近的父/子边，端点沿边滑向对方（多子节点分叉），
    不再固定右/下侧；曲线与直角都按新端点重算（`edgeSides`/`sideAnchor`/`edgeGeometry`，edge 加 `data-from/to`）；
    节点改**圆角矩形**（10px）；
    ② 画布节点**右键菜单**：继续对话 / 查看工作轨迹 / 修改标题 / 打开对话；
    ③ 继续对话 = 节点旁 composer，`binding.session.prompt(text,'queue',undefined,requestId)`（不打断、幂等），
    走 `sessions.using` + `openState==='error'` 守卫，结果按 `{ok,value}` 解包；
    ④ 修改标题 = `binding.session.rename(title)`（宿主 `session/rename`，durable；会先 resume 会话）；
    ⑤ 工作轨迹 = 折叠已加载的 `eventSource` 窗口（turn/tool/回答/交付/错误，最多 40 行），
    冷会话可读、不唤醒 Agent，仅覆盖最近窗口；
    ⑥ 冒烟补：菜单开关、composer 发送/幂等 id、改名、轨迹折叠与渲染
  - `v0.9.4` ① **输入框按键隔离**：`.mc-root` 的 j/k/o/v/f/s/0// 单键快捷键此前不区分焦点，
    在我们自己的搜索框/composer 里打字会误触发（用户报的"下一个/上一个对话"其实就是插件自己的 j/k）；
    现在面板 handler 检查 `defaultPrevented` + 可编辑目标 + IME，输入框对无修饰键的按键做 `stopPropagation`
    （宿主 dispatch 在 window bubble，晚于我们的 handler）；React 合成事件没有 `isComposing`，
    统一用 `nativeEvent.isComposing || keyCode===229`；
    ② **主题设置**：设置里加 跟随系统 / 亮 / 暗，用 `data-tone` 驱动（不再依赖 `body[data-ds-dark-theme]`），
    暗色单独覆盖 `--dsw-alias-*` token，强制亮/暗都不漏宿主色；
    ③ **懒加载投影**（性能）：面板打开时只预热前 8 个会话 + 选中节点及其子节点，不再一次刷 80 个；
    ④ **轨迹优先复用原生**：右键「查看工作轨迹」先走宿主原生 `conversation.view` 的 `trajectory` 标签
    （best-effort：写该会话的持久化 view 偏好 `localStorage["dsh.conversation.<id>"].view='trajectory'` 再 `uiWorkspace.openSession`；
    没有公开"选视图"API）；不可用时退化为面板内紧凑轨迹并在底部提示怎么开启「显示代码工作视图」；
    ⑤ 实测结论见下表「性能」行

## 关键结论 / 踩过的坑

| 事项 | 结论 |
|---|---|
| 面板挂载 | `main`（`key: 'mission'`）+ `sidebar.panellist`（`id: 'mission'`）必须逐字相同；避开 `conversation`/`plugins`/`schedules` |
| 快捷键 | `⌘P` 被 `workspace.files` 占用且冲突会被拒绝 → 用 `⌘⇧P`；`⌘B`/`⌘T`/`⌘,`/`⌘/`/`` ⌘` ``/`⌘⌥B`/`⌘⌥O` 也已占用 |
| 快捷键不能吞输入 | 宿主 dispatch 在 window **bubble**、且无 per-element opt-out；插件输入框必须在自己的 handler 里对无修饰键 `stopPropagation`（preventDefault 会吃掉字符，capture `stopImmediatePropagation` 会连自己的 handler 一起废掉） |
| 快捷键注册是**全平台预校验** | `register()` 会校验 desktop/web × macOS/Windows/Linux 的所有默认键位，任一平台非法就整条命令失败（不注册、不报错）。Web+Linux 只允许 `⌘/`、`⌘⇧,`、`⌘⇧.` → 插件必须省略 `web:linux` 默认值；注册失败要 `console.warn`，不能静默吞掉 |
| macOS 标题遮挡 | header 用 `--dsh-frame-top-clearance`（48px）；侧栏收起时再加 `--dsh-frame-leading-clearance`（160px） |
| 性能（2026-10-28 实测） | 面板不在前台时**卸载**（keyed `main` slot）→ 聊天时无本插件渲染/定时器/监听/CSS；Host 投影 0.13µs/事件（75 会话全量 fold 7.9ms，状态 47KB）；打开面板才有的成本 = 冷会话投影读取（v0.9.4 已从 80 → 8+选中）；聊天卡顿的嫌疑在宿主自身（Lexical composer + shortcut 适配器每按键 `querySelectorAll`），不是本插件 |
| 暗色判定 | 宿主在 **`body[data-ds-dark-theme]`** 上切暗色，不是 html |
| pnpm 安装 | 本地目录是**硬链接**：原地改文件自动同步；**删了重建会断链**（`ln -f` 修回）；重装用 `link:` 更省事 |
| Host half | `index.js` 改动必须重启 App 才会加载新模块；纯 Client 改动 `⌘R` 即可 |
| 投影是权威 | `useSessions(s=>s)` 的 `byId` 已含 subagent 子行（`parentId`/`origin`），不需要自己爬 tree |

## V1b 已落地（v0.7.0）

Host 投影 `missionControl`（`stateVersion: 1`）：`text`（≤200 字符）/ `files`（最近 5 个写入路径）/
`fileCount`（累计写入次数）/ `tool` / `toolError` / `turn` / `reason`（`turn/end.reason.kind`）。
Client 用它做产出列（`2F`/`TXT`/`ERR`）、抽屉「文件区 + 对话区」、失败列。

已知取舍：
- `files` 来自 `tool/call` 中 `write`/`edit` 的 `file_path`，不是 diff，也不是 `workspace/changes` 的权威列表
- 投影会进所有 Client 的 control baseline，所以只放截断文本/计数/枚举；语义变了要 bump `stateVersion`
- 画布偏好走 Host 路由（`/api/command-centre.prefs`）写 `~/.dsh/command-centre/canvas.json`，
  localStorage 仅兜底；App 重启后 origin 变了也能恢复

## 下一步候选

0. **从画布/看板进对话后的「返回」**（用户 2026-10-28 指定为下一个 feat）：现在跳进 Conversation 后只能靠 `⌘⇧P`
   或侧栏图标回来。计划：进入前记住来源（panel + 选中节点/滚动位置），在 Conversation 里挂一个轻量「← 回指挥台」
   徽标（需要找一个宿主允许插的槽位：右侧栏/会话头部/浮层），点击回 `mission` 面板并恢复到原来选中的节点；
   需要先确认 `slots` 里有没有不带"DO NOT register"警告的会话级槽位（`docs/design/panel-api.md` 有槽位清单）
1. 画布 P1：节点折叠 `+N`、键盘 DFS 提示、节点内联展开
2. 产出更准：接 `ctx.workspaceChanges.summary` / `/api/changes.summary` 拿真实 turn 改动
3. workflow 阶段节点（仍缺 Host 事件投影，需要 fold `tool-workflow/*` 会话事件）
4. V2：动作通道（批准 / 回答 / 打断）

## 已知未做（别当 bug）

- 产出列 `OUT —`（等 V1b）
- 没有「失败」列（Client 无跨会话失败信号）
- 刷新回对话页（宿主 layout 不持久化 `activePanelId`）→ `⌘⇧P`
- 不支持拖拽改状态（状态来自宿主投影）
- 只看所有工作区（Q4「只看当前工作区」缺宿主侧"当前工作区"信号）
- 工作轨迹只读已加载窗口（tail），不能跳到某条消息（宿主无 anchor 深链）；全量历史要 loadOlder 循环
- 原生轨迹只能 best-effort 打开：目标会话**当前已挂载**时，内存里的会话 store 会盖掉我们写的持久化偏好（会落在原标签），
  此时只能提示用户点对话上方的「轨迹」标签；轨迹视图还受「设置 → 通用 → 显示代码工作视图」门控（默认开）
- 原生轨迹组件无法嵌进插件面板（trajectory 只导出 apply/inject、slot 有 ownership 检查、规范禁止 require 宿主 Client 包）
- 改名会 resume 会话（冷会话变 live、拿 writer 锁）；子会话/归档由宿主行为决定
- 继续对话对 one-shot 子会话/归档会话可能被宿主拒绝，插件只显示错误
- 没做批准/回答/打断（Q3 只读；V2 动作通道）
- 未发布 npm（GitHub 安装即可；npm 上 `dsh-plugin-command-centre` 名字可用）

## 文件地图

```
client.js            # 全部 UI + 数据派生 + 快捷键（无 JSX、无宿主 Client 包依赖）
index.js             # Host half（V1a 空 apply）
cordis.patch.yml     # insert 一行 id: mission-control
locale/{zh,en}.json  # 插件管理页 meta
icon.svg
scripts/smoke-client.cjs   # 离线逻辑冒烟测试（stub React，无 DOM）
docs/design/         # 交接调研 + 视觉规范
docs/STATUS.md       # 本文件
```

## 自测命令

```bash
node --check client.js
node scripts/smoke-client.cjs
```

冒烟测试断言：模块工厂 → `apply` 注册 `main:mission` 与 `sidebar.panellist:mission` →
中英词典完整性 → `⌘⇧P` 注册与 resolve → 看板渲染（三列/卡片/子行/指标）→ 点卡片出抽屉 →
输出无 `undefined`/`NaN`/`[object Object]`。
