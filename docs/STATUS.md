# STATUS — Command Centre

> 最后更新：2026-10-27 · v0.9.0（节点间投递 + 对话区 markdown 扁平化）。

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

## 关键结论 / 踩过的坑

| 事项 | 结论 |
|---|---|
| 面板挂载 | `main`（`key: 'mission'`）+ `sidebar.panellist`（`id: 'mission'`）必须逐字相同；避开 `conversation`/`plugins`/`schedules` |
| 快捷键 | `⌘P` 被 `workspace.files` 占用且冲突会被拒绝 → 用 `⌘⇧P`；`⌘B`/`⌘T`/`⌘,`/`⌘/`/`` ⌘` ``/`⌘⌥B`/`⌘⌥O` 也已占用 |
| 快捷键注册是**全平台预校验** | `register()` 会校验 desktop/web × macOS/Windows/Linux 的所有默认键位，任一平台非法就整条命令失败（不注册、不报错）。Web+Linux 只允许 `⌘/`、`⌘⇧,`、`⌘⇧.` → 插件必须省略 `web:linux` 默认值；注册失败要 `console.warn`，不能静默吞掉 |
| macOS 标题遮挡 | header 用 `--dsh-frame-top-clearance`（48px）；侧栏收起时再加 `--dsh-frame-leading-clearance`（160px） |
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
