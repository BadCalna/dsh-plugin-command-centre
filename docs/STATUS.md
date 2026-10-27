# STATUS — Command Centre

> 最后更新：2026-10-27 · v0.4.0（赛博朋克冷光控制台 + 节点式画布 P0）。

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

## 下一步：V1b（产出列 + 失败列）

一个 Host 投影 `missionControl`（小 JSON，别放大文本）：

| 字段 | fold 来源 | 用途 |
|---|---|---|
| `changedFiles`（count + 最近 3 个 path） | `workspace/changes` | 卡片 `OUT` + 抽屉「产出 · 文件区」 |
| `lastAssistantText`（截断 ≤200 字符） | `assistant/message` | 卡片摘要 + 抽屉「产出 · 对话区」 |
| `lastToolName` / `lastToolError` | `tool/call`、`tool/result` | 抽屉「最近活动」 |
| `turn` / `lastTurnEndReason` | `turn/start`、`turn/end` | 新增「失败」看板列（`blocked/error/max-tokens`） |

顺序：先 `changedFiles` + `lastAssistantText` → 装（改 Host half 需重启 App）→ 确认
`projectionsBySession[id].values.missionControl` 真的到 Client → 再补 `turn end reason` 做失败列。

约束：`stateVersion: 1` 起步，语义变了必须 bump；control baseline 广播给所有 Client，只放计数/枚举/截断文本。

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
