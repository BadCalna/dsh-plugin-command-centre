# STATUS — 任务指挥台（Mission Control）

> 最后更新：2026-10-27 · V1a 已上线并真机验收通过。

## 现在是什么状态

**V1a 完成，正在你的 Harness 里跑。**

- 包位置：`plugin/`（包名 `@local/dsh-plugin-mission-control`，`file:` 装进 desktop profile）
- 入口：左侧面板列表「任务指挥台」图标 → 中列整页；点任意会话回对话
- 已验收：图标可见、面板可打开、数据正确（用户确认）
- profile 侧证据：`dependencies` 有 `file:/Users/jaychen/Documents/MissionDashboard/plugin`，
  `dsh.profile.bundles` 已追加该包，`node_modules/@local/...` 与工作区逐字节一致，
  pnpm `+ … Done in 261ms`，无构建脚本

V1a 能力与边界见 `plugin/README.md`；设计依据见 `design/`。

## 迭代方式（重要）

pnpm 装的是**快照副本**，不是软链。改了 `plugin/` 里任何文件：

1. 插件页 → 「任务指挥台」→ **卸载**
2. **安装插件** → 安装源粘贴 `/Users/jaychen/Documents/MissionDashboard/plugin`
3. 纯 Client 改动（`client.js` / locale / icon）有 HMR 时热生效；
   **Host half（`index.js`）改动需要重启 App** 才会加载新模块

## 下一步：V1b（产出列）

要补的四个字段，都放进 **一个** Host 投影 `missionControl`（小 JSON，别放大文本）：

| 字段 | fold 来源 | 用途 |
|---|---|---|
| `changedFiles`（count + 最近 3 个 path） | `workspace/changes` | 抽屉「产出 · 文件区」+ 列表产出列 |
| `lastAssistantText`（截断 ≤200 字符） | `assistant/message` | 抽屉「产出 · 对话区」+ 列表摘要 |
| `lastToolName` / `lastToolError` | `tool/call`、`tool/result` | 抽屉「最近活动」 |
| `turn` / `lastTurnEndReason` | `turn/start`、`turn/end` | 「失败」分组（`blocked/error/max-tokens`）有了数据才敢做 |

落地顺序建议：

1. 先只加 `changedFiles` + `lastAssistantText` 两个字段（V1a 的 UI 里已经预留
   「文件区 / 对话区」两个占位区块，直接填）
2. 装 + 重启一次 App，确认 wire 投影真的到 Client（`projectionsBySession[id].values.missionControl`）
3. 再补 `lastToolName` / `turn end reason`，把「失败」分组和「最近活动」换成真数据
4. 约束：`stateVersion: 1` 起步，字段语义变了必须 bump；control baseline 广播给所有 Client，
   所以只能放计数 / 枚举 / 截断文本

## 已知未做（别当 bug）

- 产出列当前是 `—`（等 V1b）
- 没有「失败」分组（Client 侧没有跨会话失败信号）
- 刷新页面回对话页（宿主 layout 不持久化 `activePanelId`）
- 没做「启动即默认打开」（提案里 Q5：先不做）
- 面板只看所有工作区（可下拉筛选；Q4「只看当前工作区」还没定，因为 Client 拿不到
  「当前工作区」这个值，只有 `workspaces.items[].sessionIds`）
- 没做批准/回答/打断（Q3 只读；要 V2 的动作通道）

## 文件地图

```
design/            交接资料（00-提案 / concepts / panel-api / data-signals / HANDOFF）
plugin/            V1a 插件包（package.json / cordis.patch.yml / index.js / client.js / locale / icon.svg / README.md）
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
（两者逐字相同）→ 中英词典（含所有字面量 / 动态 key）→ 示例数据渲染整页 → 点行出抽屉 →
输出无 `undefined` / `NaN` / `[object Object]`。
