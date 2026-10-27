# HANDOFF — 任务指挥台插件（Mission Control）

> 交接给新工作区 `~/code/dsh-mission-control` 里的新会话。
> 上一个会话完成的是**需求拆解 + 可行性/数据调研 + 方案设计**，还没有写一行插件代码。

---

## 0. 你要做什么

给 DeepSeek Harness 做一个 Web UI 插件：一个叫**「任务指挥台」**的整页面板，替代/补充现在 codex 式的「左对话列表 / 中对话详情 / 右输出面板」。用户要能一屏看到：

1. 各个对话（任务）的**进度**；
2. 各个对话的**产出**；
3. **subagent 的创建、处理状态，以及它和主 agent 的关系**。

用户是重度使用者，经常同时跑多个对话 + subagent + workflow。**当前阶段：先做 V1a（纯 Client 只读面板），跑起来给用户看，再迭代。**

---

## 1. 第一件事：把资料拷进当前工作区

```bash
cd /Users/jaychen/code/dsh-mission-control
cp -R /Users/jaychen/Documents/deepseek-harness/default-workspace/plugin-design ./design
ls design
```

预期看到 `00-提案.md`、`concepts.md`、`panel-api.md`、`data-signals.md`、`HANDOFF.md`。

> 上面这条命令是**跨工作区读取**（已实测允许），写入落在新工作区（允许）。如果被沙箱拒绝，请用户在 Finder 里手动拖过来，然后告诉用户"读取被拒"，不要硬试。

---

## 2. 已定的事（不用再讨论）

- **形态**：`main` 面板里的一个新 key + `sidebar.panellist` 里的同名图标，纯增量、可卸载，与对话面板共存。**不 shadow `root`/`sidebar`/`rightbar`**（会顶掉宿主 UI）。
- **首选范式**：分组矩阵 + 行内嵌子树（`concepts.md` 的 C），点行出面板内抽屉；「交付码头」（B）留作第二 tab，等"产出"定义清楚再上。
- **技术路线**：V1a 纯 Client（0 行 Host）；V1b 加 1 个 Host 投影补"产出"。
- **范围**：先只看当前工作区、只读 + 跳转。

## 3. 待用户拍板（新会话开场先问这 5 个，附推荐默认）

| # | 问题 | 推荐默认 |
|---|---|---|
| Q1 | 首页形态：矩阵 / 任务树 / 交付物看板 | 矩阵 + 行内子树 |
| Q2 | 什么算"产出"：文件写入+最终回答 / 只看写入 / agent 显式声明 / 手动钉选 | 文件写入 + 最终回答（+手动钉选兜底） |
| Q3 | V1 只读还是可写（批准/回答/打断） | 只读 + 跳转 |
| Q4 | 范围：当前工作区 / 全部工作区 | 当前工作区 |
| Q5 | 接受"只占中列、刷新回对话"吗；要不要启动即默认打开 | 接受；默认打开先不做 |

用户可以直接说"按推荐来"。

---

## 4. 关键技术结论（已验证，省你重查）

### 4.1 面板怎么挂

```js
// client.js
window.__ModuleLoader__.load({
  id: 'dsh-plugin-mission-control',   // 必须等于包名
  factory(require) {
    const React = require('react');
    return {
      inject: ['slots', 'layout', 'locale'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'mission', locale: 'mission',
        }, Page));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'mission', order: 20,
          label: () => t('panel'),
        }, Icon));
      },
    };
  },
});
```

- **`sidebar.panellist.id` 必须与 `main.key` 逐字相同**（点击侧栏传 id，layout 用 main 的 key 校验）。
- 避开已占用值：`conversation` / `plugins` / `schedules`。
- 先例：`@deepseek-ai/dsh-client-ui-schedule`（「自动化任务」页）、`@deepseek-ai/dsh-client-ui-plugin-manager`（「插件」页）。
- `ctx.layout.selectPanel(key | null)`：`null` 回对话；未注册会 throw。**选中态不持久**，刷新回对话。
- 面板组件 props：`useSessions`、`useSessionStatus`、`usePanelInfo`、`useWorkspaces`、`t`、`renderSlot` 等，**没有 sessionId**。内部布局完全自由（高度 100%、自己滚动）。
- 包必须有 Host half `index.js`（`export function apply() {}` 即可）+ patch 行，client half 才会被下发。

### 4.2 数据从哪来（V1a 全现成）

- 会话列表 + `parentId` + 每个会话的投影值：slot props `useSessions(s => s)`
- running/idle：`useSessionStatus(m => m)`
- 现成投影（`projectionsBySession[id].values`）：`tokenUsage`、`contextPressure`、`contextBreakdown`、`todos`、`plan`、`goal`、`subagentCatalog`（子 agent 目录）、`subagentTiming`、`agentTeam`、`sessionListMetadata`
- 多层 subagent 树：父 `subagentCatalog` → 对每个 child `ctx.sessions.refreshProjections(childId)` 拉它的 catalog，递归
- 打开对话：`ctx.uiWorkspace.openSession(id)`

### 4.3 V1a 拿不到、需要 V1b 自写一个 Host 投影的

1. 跨会话"最后回复文本"
2. 最后工具调用 / workflow run 汇总
3. subagent 结束原因（只在 Host `subagent/end`）

→ 一个 `ctx.sessionProjections.register({ key, stateSchema, init, apply, stateVersion, wire: { viewSchema, view } })`，**只放小 JSON**（截断文本、计数、枚举），因为 control baseline 会广播给所有 Client。

### 4.4 风险

- Client inspect 本会话多次超时，slot 契约来自 0.2.1-rc.3 源码 + 内置契约目录，**落地以真插件跑通为准**。
- 新投影 key 不在 `SessionProjectionMap` 编译期白名单里（运行时不校验），未来版本可能收紧 → 失败要 feature-detect 降级。
- 面板抛错只坏该格（`data-slot-error`），但 `main` 条目会 abdicate 成空中心列 —— 加 ErrorBoundary。
- 异常状态色常驻会视觉疲劳 → 留"安静模式"。

---

## 5. 建议执行顺序

1. 问 Q1–Q3（Q4/Q5 可后置），拿到答复再动手。
2. 写插件包：`package.json` + `cordis.patch.yml` + `index.js`（空 apply）+ `client.js` + `locale/{zh,en}.json` + `icon.svg`。
3. `plugin_manager` `install_bundle`，`target` = 包目录绝对路径。
4. 用 `application` / `warnings` 判断是否真的生效，别靠日志；然后在页面里点左侧新图标验收。
5. V1a 通过后再做 V1b（Host 投影补产出列）。
6. 验收时用 `webapp-testing` 技能 / 截图，别只声称"装好了"。

---

## 6. 深读资料（拷过来后按需读，不用全读）

| 文件 | 什么时候读 |
|---|---|
| `design/00-提案.md` | 先读这个，200 行，含推荐方案 + 线框 + 版本切分 |
| `design/concepts.md` | 要线框细节/交互/空状态时读；三种范式 |
| `design/panel-api.md` | 写注册代码前读 §2/§3/§4，含 props 形状与风险 |
| `design/data-signals.md` | 决定某个信号怎么取时查矩阵 |
