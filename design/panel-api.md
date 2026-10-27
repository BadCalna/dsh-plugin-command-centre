# 整页 Panel 渲染面可行性报告（Mission Control）

> 调研对象：DeepSeek Harness 0.2.1-rc.3 桌面版（`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/`）。
> 结论分「已验证（附证据）」与「未验证假设」。
> 本报告只做调研，不含安装、profile 改动或插件包实现。

---

## 0. 结论速览

| 问题 | 结论 | 置信度 |
|---|---|---|
| 插件能否注册「左侧入口 + 中央整页」 | **可行**。`sidebar.panellist`（list）+ `main`（keyed）双注册，id 与 key 必须同值 | 已验证 |
| 能否替代/补充当前三列（左列表/中详情/右输出） | **部分可行**。插件拿到的整页只是**中列**；左列（会话树）与右列（详情）属于 shell，仍由宿主占用。中列内部布局完全自由 | 已验证 |
| `ctx.layout.selectPanel` 能否选中插件面板 | 能。参数是 `main` 注册时的 `key`（string 品牌类型 `MainPanelId`），`null` 回 conversation | 已验证 |
| 能否默认打开 / 持久化 | 默认打开可用 `selectPanel` 实现（未验证时序）；**持久化不可用**——layout store 不落盘，刷新回 conversation | 部分已验证 |
| `main` 组件 props | root scope 标准 kit（9 个全局 hook）+ `t` + `renderSlot`/`SessionProvider` + `useStore`/`actions` + `inject` 业务 props；**没有 sessionId** | 已验证（契约目录）+ 源码 |
| 现有「插件 / 自动化任务」是谁注册的 | `@deepseek-ai/dsh-client-ui-plugin-manager`（id `plugins`）与 `@deepseek-ai/dsh-client-ui-schedule`（id `schedules`） | 已验证 |
| 最大风险 | 若注册进已占用 slot（如 `root`）而 priority 更低会**静默替换宿主 UI**；对已占用 key 重复注册在普通插件包下会**加载期抛错**；面板抛错只坏该格但可能留下空列 | 已验证机制，未运行时演练 |

**一句话**：Mission Control 应当做成一枚 **「main 里的一个全新 key」+「sidebar.panellist 里的一个同 id 图标」**，而不是去替换 root/sidebar/rightbar。这样它是纯增量、可与 conversation 共存、随插件卸载自动消失。

---

## 1. 渲染面拓扑（已验证）

宿主 shell 的 slot 骨架由 `@deepseek-ai/dsh-client-ui-layout` 在 `root` 里声明
（`.../dsh-client-ui-layout/lib/client.js:623-653`）：

```
root (single, 由 runtime 内置；占用者 = ui-layout 的 AppFrame)
├─ sidebar            (single, root)  → ui-sidebar 的 SidebarRoot
│   ├─ sidebar.brand.mark / sidebar.brand.name / sidebar.toggle.badge
│   ├─ sidebar.panellist            (list,   root)  ← 全局面板图标行（我们要注册的地方）
│   ├─ sidebar.panellist.actions    (list,   root)  ← 「更多」菜单里的面板行
│   ├─ sidebar.workspaces           (single, root)  ← 会话/工作区树（codex 式左侧列表）
│   ├─ sidebar.settings / sidebar.footer.action
├─ main               (keyed,  root)  ← 中列整页（我们要注册的地方）
├─ rightbar           (single, root)  ← 右列详情/输出面板
├─ shell.bottom / shell.overlay (list, root) / shell.leading
```

- `main` 的 keyed 派发在 `layout/lib/client.js:118-120`：
  `renderSlot("main", {}, { entryKey: usePanelInfo(info => info.activePanelId) ?? "conversation" })`
  → 当前选中的 panel id 就是 **`main` 注册项把 `options.key` 写成什么**。
- `sidebar.panellist` 的每一行由 ui-sidebar 依据 **panellist 自己的条目**生成，而不是依据 main 条目
  （`sidebar/lib/client.js:568-583`）：
  ```js
  const next = ctx.slots.entriesOfSlot("sidebar.panellist").map(({ options }) => ({
    id: options.id,
    order: options.order ?? 0,
    label: resolveSlotLabel(options.label) ?? id,   // label 可以是 string 或 thunk
  })).sort((a, b) => a.order - b.order)
  ```
  点击行时调用 `ctx.layout.selectPanel(id)`（`sidebar/lib/client.js:205-236`），
  而 `selectPanel` 校验的是 main 条目的 `options.key`（见 §3）——
  **所以 panellist 的 `id` 与 main 的 `key` 必须逐字相同**，这就是两者的「配对」规则。
- 面板图标组件不是整页容器，只是图标位：`renderSlot("sidebar.panellist", { size, active }, { only: id })`
  （`sidebar/lib/client.js:226-233`），owner props 为 `{ size: number; active: boolean }`。
- 中列出口是 `display: contents` 的锚点 div，包在 `centerCol`（flex column, `min-width:0`, `overflow:hidden`）里；
  面板组件自己负责 `height:100%` 与内部滚动。

`sandbox 侧证据`：`@deepseek-ai/dsh-cordis-client-runner/lib/client.js`（0.2.1 内置的 cordis API/slot 契约目录，由 `scripts/gen-cordis-inspect-catalog.ts` 生成）对 `main` 的原文：

> `key: "main"`, `kind: "keyed"`, `scope: "root"`,
> summary: `Central panel selected by sidebar entry id.`
> doc: `The reserved 'conversation' key hosts the Conversation; other keys receive no Session binding.`
> keyDomain: `open: any string the owner dispatches (no compile-time key set), already taken: conversation`
> declaredBy: `an entry in 'root' (client-ui-layout)`（runner client.js:4373 起）

---

## 2. 注册代码草图（client.js 形态，不可直接运行）

一个 Mission Control 插件包至少需要：`package.json`（含 `dsh.bundle.patch` 与 `dsh.client`）、Host half `index.js`（可为空 `apply`）、Client half `client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`。

### 2.1 Client half 骨架

```js
// client.js —— 浏览器半边（window.__ModuleLoader__ 约定；id 必须等于包名）
window.__ModuleLoader__.load({
  id: '@local/dsh-mission-control',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'missionControl';
    const PANEL_ID = 'mission';      // 必须同时作为 main.key 与 sidebar.panellist.id
    // 避让宿主已占用值：conversation / plugins / schedules

    const zh = { panel: '任务指挥台', title: '任务指挥台' };
    const en = { panel: 'Mission Control', title: 'Mission Control' };

    // —— 图标位：只画图标，收 owner props { size, active } ——
    function MissionIcon({ size, active }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, style: { display: 'block' },
      }, h('path', {
        d: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
        fill: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
      }));
    }

    // —— 整页面板：中列唯一占用者，内部自带多列/画布布局 ——
    function MissionControlPage(props) {
      const { t, usePanelInfo, useSessions, renderSlot } = props;
      // 视需要读全局数据；组件内不要再 import 任何 Harness Client 包
      return h('div', {
        style: {
          height: '100%', display: 'grid',
          gridTemplateColumns: '280px minmax(0,1fr) 320px',
          gridTemplateRows: 'minmax(0,1fr)',
          background: 'var(--dsw-alias-bg-base)',
          color: 'var(--dsw-alias-label-primary)',
          overflow: 'hidden',
        },
      },
        h('aside', { style: { minWidth: 0, overflow: 'auto' } }, 'conversations'),
        h('main', { style: { minWidth: 0, overflow: 'auto' } }, 'mission canvas'),
        h('aside', { style: { minWidth: 0, overflow: 'auto' } }, 'subagent / output'),
      );
    }

    return {
      // 用到的 Client 服务：slots 必填；layout 用于选面板/回 conversation；locale 用于文案
      inject: ['slots', 'layout', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mission: dictionaries');
        const t = ctx.locale.bind(NS);

        // 1) 中央整页：main 是 keyed slot，靠 options.key 与 activePanelId 对齐
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          // 可选：store 座位（defineStore 才有的 useStore/actions 会注入 props）
          // store: createMissionStore,
          // 可选：业务 props（可闭包 ctx，用于面板内的按钮跳回 conversation 等）
          inject: () => ({
            openConversation: () => ctx.layout.selectPanel(null),
            openPlugins: () => ctx.layout.selectPanel('plugins'),
          }),
          // 可选：给自己声明子 slot，让别的插件往面板里加卡片
          children: {
            'mission.column': { kind: 'list', scope: 'root' },
          },
        }, MissionControlPage));

        // 2) 左侧入口：sidebar.panellist 是 list slot，靠 options.id 生成一行
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,          // 与 main.key 同值
          order: 20,             // plugins=0, schedules=10；升序排
          locale: NS,
          label: () => t('panel'), // thunk：随语言切换自动更新
        }, MissionIcon));
      },
    };
  },
});
```

### 2.2 包清单要点

```jsonc
// package.json
{
  "name": "@local/dsh-mission-control",
  "type": "module",
  "exports": { ".": "./index.js", "./client": "./client.js", "./locale/*.json": "./locale/*.json", "./icon": "./icon.svg" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-sidebar"]
    }
  }
}
```

- `dsh.client.inject` **只决定激活顺序**（practices.md 明说），真正的等待由 `ctx.slots.inject(key, cb)` 完成：
  slot 已声明则同步执行，未声明则等声明提交后执行、声明塌陷时自动 dispose。因此即使不写 inject，注册也不会丢；写上是让插件排在 shell 之后激活，减少「首帧空列表」。
- `index.js` 的 Host half 可以是 `export function apply() {}`，**但必须有 patch 行让它成为 Host Loader entry**——见 §7 风险 6。

---

## 3. `ctx.layout.selectPanel` 契约（已验证）

来源：`layout/lib/client.js:452-495`（`LayoutController`）、`layout/lib/client.js:406-412`（store actions）。
另见 runner 内生成的 service 契约（`@deepseek-ai/dsh-cordis-client-runner/lib/client.js`，`SERVICE_API` 中 `key: "layout"`）：

```
selectPanel(panelId: MainPanelId | null): void
  panelId: registered main key, or null to show the Conversation.
  throws: if the selected main key is not registered; preserves the current selection.
```

- **类型**：`MainPanelId = Branded<'MainPanelId'>`，运行时就是字符串。取值来源 = 某个 `main` 注册项的 `options.key`（`conversation` / `plugins` / `schedules` / 你的 key）。
- **校验**：`if (panelId !== null && !this.hasMainPanel(panelId)) throw new Error('layout.selectPanel: main panel "..." is not registered')`
  其中 `hasMainPanel = id => ctx.slots.entries("main").some(entry => entry.options.key === id)`。
  → **插件注册的 key 可以被选中**，前提是注册仍存活（插件卸载 / 条目被 error boundary abdicate 后就不再是合法 id）。
- **副作用**：写 root layout store 的 `panelInfo.activePanelId`（内存态）；中止上一段导航（`beginNavigation()` 的 AbortSignal）；`main` keyed 出口随即换人渲染。
  - `activePanelId === null` ⇒ 渲染 `conversation` key；浏览器标题在此时才跟随会话标题（`layout/lib/client.js:57-70`），选中任意全局面板时标题回落到产品名。
  - `retainMainPanels()` 在 main 注册集合变化时把失效的 activePanelId 归零（`layout/lib/client.js:410-412, 614-615, 689-690`）→ 面板插件卸载会自动回 conversation。
- **切换回 conversation**：`ctx.layout.selectPanel(null)`。ui-workspace 在「选中会话 / reveal 会话」时就走这条路径（cached `dsh-client-ui-workspace/lib/client.js:969, 993`）。左侧会话树点击同样会回 conversation。
- **默认打开**：没有配置项；唯一写入口就是 `selectPanel`。在 `apply` 里注册完 main 之后调用 `ctx.layout.selectPanel(PANEL_ID)` 理论上可行、且不会抛错（注册是同步的）；但**没有任何 shipped 面板这么做，时序与用户体验未验证**，见 §8。
- **持久化**：**没有**。layout 的 store 是 `defineStore({ init: () => ({ panelInfo: { activePanelId: null }, ... }) })`（`layout/lib/client.js:391-447`），没有 `persist` 选项；`@deepseek-ai/dsh-client-store` 的持久化是 opt-in（`defineStore({ persist: { name } })`），layout 未启用。刷新页面后永远是 conversation。
  - 同理 sidebar 的面板「固定/取消固定」也只是内存 store（`sidebar/lib/client.js:17-30`），刷新即恢复默认。
  - 想要「默认/上次打开的 panel」只能插件自己记账（localStorage 或 Host 端存储），再在 apply/首次面板挂载时调 `selectPanel`；这是**未验证**的设计点。

---

## 4. `main` 面板的 props 形状（已验证契约 + 源码）

### 4.1 通用组合规则

`main` 的声明 scope 是 `root`（由 layout 声明，注册方**不能**改 scope）。root scope 条目拿到的 props 由五份 share 组合
（ui-renderer `standardKit`/`standardProps`，cached `dsh-client-ui-renderer/lib/client.js:659-760`）：

1. **runtime share（root 标准 kit）**——契约目录明确列出：
   `useRemoteAccess`、`useResource`、`useWorkspaces`、`usePanelInfo`、`useSessions`、`useSessionStatus`、`useSessionRetainInfo`、`useSessionAccess`、`useWorkspaceAccess`（均为 selector hook 或函数）。
2. **child-render share**：注册项声明了 `children` 才有 `renderSlot`（窄化到已声明的子 slot），有 `session`/`session-maybe` 子 slot 时还给 `SessionProvider`，有 chain 子 slot 时给 `renderSlotChain`。
3. **Factory share**：`renderFactorySlot`。
4. **store share**：注册项带 `store: defineStore(...)` 时给 `useStore` 与 `actions`（draft-stripped 写回调）。
5. **business share**：注册项 `inject` 返回值的浅合并（`inject: () => ({...})`；contract 里也可写成 `(sessionId) => ...`，但 main 是 root scope，没有 sessionId）。
   另：声明了 `locale: NS` 就有 `t`（该 namespace 的翻译函数）。
6. **owner props**：`main` 的 owner props 是空 `{}`（AppFrame 调 `renderSlot("main", {}, {entryKey})`）；`sidebar.panellist` 的 owner props 是 `{ size, active }`。

> 对照：插件包 `PluginManagerPage` 实际解构 `{ t, ensure, renderSlot, resolveText }` + `useStore/actions` + `usePluginManager`/`useConfigLedger`/`useConfigurations`/`configForm`（后 5 个来自 `inject: () => face`）——`plugin-manager/lib/client.js:3831` 起。

### 4.2 「没有 session 绑定」意味着什么

- root scope 面板**拿不到** `sessionId`、`useSession`、`useConversation`、`useChat`、`useProjection`、`useTrajectory`。这对 Mission Control 反而是优点：它是**跨会话**的全局视图，正好用 `useSessions` / `useSessionStatus` / `useSessionRetainInfo` + Remote 读全局状态。
- 需要渲染「某会话详情」时，shipped 的范式是**root 面板 + 自己声明 session-maybe 子 slot**：
  会话插件就是 `main`（key `conversation`，root）+ 子 slot `main.conversation`（`scope: "session-maybe"`）
  （`conversation/lib/client.js:20220-20236`），`ConversationPanel` 只做 `renderSlot("main.conversation", {})`（同文件 16353-16355）。
  session-maybe 的绑定来自 shell 根部的 `ScopeProvider scope="session-maybe"`（cached renderer `createSlotRenderer().renderRoot`），
  即「当前选中的会话」，不需要显式传参。
- 要在 Mission Control 里并排渲染**任意**会话（不限于当前选中会话），需要显式 `<SessionProvider session={...}>`；
  该 `session` 是 ui-session 的 **SessionReference（`{ binding, sessionId }` 引用对象）**，不是裸 id
  （cached `dsh-client-ui-session/lib/client.js:203-209`）。具体如何从插件里拿到该引用对象，**未验证**。

### 4.3 面板内部布局自由度（已验证）

- `main` 出口本身只是一个 `display:contents` 锚点，父容器是 `centerCol`（`display:flex; flex-direction:column; min-width:0; overflow:hidden`）。
  → 面板组件**可以**在中心列内部自由做多列/网格/画布/虚拟列表/自定义滚动，**不受 shell 三列约束**（shell 只约束「中心列」这一格的宽度）。
- 不能越过中心列的边界去覆盖左列/右列（除非改 grid 或注册 `shell.overlay`）。
- 全屏浮层需求：`shell.overlay`（list, root）是官方「增量、点击穿透」的帧级浮层；不要用 `root`。
- 样式必须用 `--dsw-alias-*` theme token（`Theme.listTokens` 可查），不要 import `@deepseek-ai/dsh-client-ui-primitives` 之类的 Client 包；需要控件就复制宿主 markup/CSS 并改前缀。

---

## 5. 现有面板实例剖析（已验证）

两个 shipped 面板是同一个模板，可直接抄结构。

### 5.1 「插件」面板

| 项 | 值 |
|---|---|
| Client 包 | `@deepseek-ai/dsh-client-ui-plugin-manager` |
| Client packageDir | `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager`（`read` 可直接读，`lib/client.js` 共 4498 行） |
| Host half | `@deepseek-ai/dsh-plugin-manager`，`Config.listConfigs({entry:"include:plugin-manager"})` 返回 `packageDir: /Applications/…/dsh/node_modules/@deepseek-ai/dsh-plugin-manager` |
| 面板 id / main key | `plugins` |
| 路由键（sidebar 排序/更多菜单） | `order: 0` |
| 文案 | `locale: "pluginManager"`，`label: () => t("panel")`，zh `panel: "插件"` |
| 页面组件 | `PluginManagerPage`（`plugin-manager/lib/client.js:3831`） |
| 图标组件 | `PluginsPanelIcon`，owner props `{ size, active }` |

注册代码（`plugin-manager/lib/client.js:4352-4366, 4412-4490`，节选整理）：

```js
const NS = "pluginManager";
const PANEL_ID = "plugins";
const inject = ["slots", "locale", "remote", "remote.pluginManager", "remote.pluginInventory",
                "remote.pluginRegistryProbe", "configForms", "layout"];

function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-plugin-manager: dictionaries");
  const t = ctx.locale.bind(NS);
  // …controller / remote 订阅…

  ctx.slots.inject("main", function* () {
    const handle = createNavigationStore(), instance = handle.create();
    yield ctx.slots.register({
      name: "main",
      key: PANEL_ID,
      locale: NS,
      store: { ...handle, create: () => instance },   // 给 useStore / actions
      inject: () => face,                              // 业务 props
      children: {                                      // 页面自己的子 slot
        "plugins.tab":            { kind: "list",  scope: "root" },
        "plugins.item":           { kind: "list",  scope: "root" },
        "plugins.bundle.config":  { kind: "keyed", scope: "root" },
        // …
      },
    }, PluginManagerPage);
    // 切走时把内部视图复位：订阅 panelInfo
    yield ctx.layout.panelInfo.subscribe(() => {
      if (ctx.layout.panelInfo.getSnapshot().activePanelId !== "plugins")
        instance.actions.setView({ kind: "list" });
    });
    // 对外暴露插件列表导航服务（别的插件可 openList/openBundle）
    const disposeNavigation = ctx.reflect.provide("pluginNavigation", { /* … */ });
    yield () => { disposeNavigation(); };
  });

  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 0,
    label: () => t("panel"),
    locale: NS,
  }, PluginsPanelIcon));
}
```

要点：
1. 先 `ctx.locale.register` + `bind`，再用 `locale: NS` 让注册项自动拿到 `t`。
2. main 注册可以使用 **generator 形式** 的 `ctx.slots.inject`，在同一个 effect 里登记「选面板 → 复位内部视图」和对外服务。
3. `store` 座位让页面有本地导航状态（选中 tab、详情视图等），并随条目卸载而销毁。
4. `children` 让页面成为可扩展宿主（其他插件往 `plugins.tab`、`plugins.item` 里加东西）。

### 5.2 「自动化任务」面板

| 项 | 值 |
|---|---|
| Client 包 | `@deepseek-ai/dsh-client-ui-schedule`（`lib/client.js` 约 7500+ 行） |
| Host half | `@deepseek-ai/dsh-schedule`，`Config.listConfigs({entry:"include:schedule"})` → `packageDir: /Applications/…/dsh/node_modules/@deepseek-ai/dsh-schedule` |
| 面板 id / main key | `schedules` |
| order | `10` |
| 文案 | `locale: "schedule.manager"`，zh `panel: "自动化任务"`（en `"Automation tasks"`） |
| 页面组件 | `TaskManagerPage`；图标 `TaskManagerIcon` |

注册代码（live `dsh-client-ui-schedule/lib/client.js:7364, 7474-7493`）：

```js
const MANAGER_NS = "schedule.manager";
const PANEL_ID = "schedules";
const inject = ["slots", "locale", "remote", "remote.schedule", "conversation",
                "uiConversation", "uiWorkspace", "sessions", "workspaces",
                "sidebarRightTabs", "sidebarRight"];
// apply 内：
ctx.slots.inject("main", () => ctx.slots.register({
  name: "main", key: PANEL_ID, locale: MANAGER_NS,
  inject: () => ({ ...detail, onNewTask: () => { ctx.uiWorkspace.startSession(); } }),
}, TaskManagerPage));

ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
  name: "sidebar.panellist", id: PANEL_ID, order: 10,
  locale: MANAGER_NS, label: () => t("panel"),
}, TaskManagerIcon));
```

与插件面板的差别：没有 `store`/`children`，但同样「main.key === panellist.id」。
它在 main 注册之外还注册了会话级 UI（`conversation.chat.turnTail`、`sidebar.right.pane.tab` 等）——
说明**一个插件可以同时占用「中央整页」和若干「会话内/右栏」增量 seat**，这正是 Mission Control「中列看全局，右栏看细节」的可行模式。

---

## 6. Scope 一览（对本设计最相关的部分）

| slot | kind | scope | 插件拿到什么 |
|---|---|---|---|
| `main` | keyed | root | 全局 kit（§4.1），无 session 绑定；`options.key` 必须唯一 |
| `sidebar.panellist` | list | root | 全局 kit + owner `{size, active}`；`options.id` 唯一 |
| `sidebar.panellist.actions` | list | root | 「更多」菜单行（用于把面板 pin/unpin） |
| `sidebar` | single | root | **不要碰**：替换整个左列 |
| `root` | single | root | **不要碰**：替换整个应用帧（契约原文：`DO NOT register here`） |
| `rightbar` | single | root | **不要碰**：右列详情面板（shipped 占用者 = right Sidebar） |
| `shell.overlay` | list | root | 增量浮层，`replaceRisk: "none"`，可做全屏 Mission Control 覆盖层 |
| `main.conversation` | single | session-maybe | 会话插件自己声明的子 slot（范例，不是给你注册的） |

注：`scope` 只由**父声明的 slot spec** 决定，`register(options)` 的 options 里没有 scope 字段（cached `dsh-client-ui-slots/lib/index.js:163-260` 的 register 只保留 key/id/order/label/priority/select/inject/children/store/locale/registrant）。想在面板里用会话数据 = 自己声明 session/session-maybe 子 slot。

---

## 7. 风险清单

### 7.1 `replaceRisk` 与 `shadows-shipped-ui` 的真实含义（已验证）

`replaceRisk` 是 cordis inspect 的 **Slot 契约目录**字段（`@deepseek-ai/dsh-cordis-client-runner/lib/client.js` 内嵌，0.2.1-rc.3 共 105 个 slot 条目）：
- 取值只有两种：`"shadows-shipped-ui"`（48 个）与 `"none"`（55 个）。
- `shadows-shipped-ui` = **该 slot 已被 shipped UI 占用**，注册进去会「遮蔽/替换」宿主界面；`none` = 增量 seat，安全。
- `main` 的值就是 `shadows-shipped-ui`——因为 `conversation` 已被占用；**用全新 key（如 `mission`）不触发该风险**。
- `sidebar.panellist` 的值是 `none`（复用 shipped id 才会替换那一格）。
- 同类高危：`root`、`sidebar`、`rightbar`、`sidebar.workspaces` 全是 `shadows-shipped-ui`，契约原文直接写 `DO NOT register here`。

运行时机制（分两条加载路径，必须分清）：
1. **普通插件包**（profile 安装、Host Loader entry）：`ctx.slots` 是真正的 SlotRegistry，不自动改优先级。
   - 同 slot 同 priority 重复占用 → **加载期抛错**：`single slot "x" already has a registration at priority 0 … register at a different priority to shadow it (lowest renders)`；keyed 同 key 同理（cached `dsh-client-ui-slots/lib/index.js:163-190`）。
   - 想遮蔽必须显式传**更低的 priority**（`0` 是默认，`-1` 更优先；「lowest renders」）。这就是「静默替换宿主 UI」的入口。
2. **动态包**（`cordis` 运行时工具生成、经 client-runner 装载）：`guardedSlots` 会给每个 register **自动分配一个更低的 shadow priority**（`runner/lib/client.js` 中 `env.allocatePriority()`；契约原文：`a dynamically registered entry is assigned a lower priority than the shipped one, which makes it the winner`）。
   → 这类包「注册进单占用 slot 即替换」，文档里才反复警告 `root` 不能用。

对本设计：**用新 key / 新 id，不设 priority** → 走「纯增量」路径，无遮蔽风险。

### 7.2 slot 内组件抛错会怎样（已验证）

- 每个条目有独立 React error boundary：组件 render 或其 `inject` 工厂抛错时，捕获后 `console.error("slot entry crashed in '<slot>':", error)`，并渲染 `<div data-slot-error="<slot>">`，**不会整页白屏**；兄弟条目继续渲染（cached renderer `SlotErrorBoundary`，`client.js:600-625`）。
- 对本设计，`main` 是 keyed：条目崩溃后会被 `reportEntryError(..., {abdicate:true})`「退位」，该 key 的出口变成空（中心列空白），左侧 sidebar 仍在，用户可从会话树点回 conversation；但此时 `selectPanel('mission')` 会因「key 已不在 main 条目集合」而抛 `not registered`，直到插件重载/重新注册。
- 更常见的「整页没了」是 **apply 阶段抛错**（重复 id/key、`locale` namespace 未注册、claim 冲突）→ 该 client 模块条目加载失败，插件面板根本不出现。
- 另：`inject: () => ({...})` 里抛错也算条目崩溃；不要在 inject 里做可能失败的重活。

### 7.3 与 conversation 面板共存（已验证）

- 各占一个 key，互斥渲染：选中全局 panel 时 conversation 不挂载；`selectPanel(null)` 回来。
- 切换不会丢会话状态（会话数据在 session log/store 里），但**面板组件会被卸载重建**——面板内部状态要么放 `store` 座位、要么放会话投影，别放组件局部 state 里指望跨切换保留（插件面板就是用 `panelInfo.subscribe` 主动复位内部视图的，见 §5.1）。
- `activePanelId !== null` 时浏览器标题回落到产品名（不显示会话标题）；这是预期行为，不是 bug。
- 插件卸载 / 面板条目移除时 layout 会自动把 activePanelId 归零（`retainMainPanels`），所以不会卡在空白面板。

### 7.4 Host half 与 Client half 的必需关系（已验证）

- Client half 是**谁**发现的：Host 侧 `@deepseek-ai/dsh-client-modules` 扫描 **Host Loader 的 entries**，收集声明了 `dsh.client` 的包，合成 boot manifest 下发浏览器（`dsh-client-modules/lib/index.js:104-106` 等）。
  → **没有 Host 行 = client.js 不会被下发/执行**，即使 `dsh.client` 写得再对。
- 所以一个 UI 插件包的标准形态是：
  - `cordis.patch.yml` 插入一行（Host 半个插件，`lib/index.js` 可以是空 `apply() {}`）；
  - `package.json` 同时声明 `dsh.bundle.patch` 与 `dsh.client`（`platform: "web"`、`exports["./client"]` 必须存在，否则 client-modules 直接报错 `declares dsh.client but exports no "./client" bundle`）；
  - Client half 用 `window.__ModuleLoader__.load({ id: 包名, factory })` 暴露 `{ inject, apply }`，插件行由 patch 行插入后加载。
- 反过来：Client half 不必有独立 loader 行，它由 boot manifest 驱动；Host half 也不必有任何运行时逻辑——但**必须有这一行**。
- 生命周期：client 插件是页内 Loader entry，卸载时会效应回卷（slot 注册、locale 字典、store 一并销毁）。`ctx.slots.inject` 的回调效应也挂在调用方 fiber 上，插件卸载不会留下孤儿面板。

### 7.5 其它

- **id/key 冲突**：别的插件若也用 `mission` 会加载期抛错（keyed 同 key）。建议前缀命名（如 `mission-control`），并在 `README`/`Config` 里固定。
- **面板默认可见性**：只有 `plugins` 免于「更多」菜单隐藏（`sidebar/lib/client.js:472`）；其他面板默认显示但用户可 unpin 进「更多」，且 pin 状态不持久化。别依赖「一定在我的图标行上」。
- **不要 npm import Harness Client 包**（`dsh-client-ui-primitives`/`-slots`/`-store`）：版本随 dsh 变、纯 JS 无类型检查、抛错会坏 slot；复制控件实现 + 只依赖 `--dsw-alias-*` token（practices.md）。
- **i18n**：`locale` 包需要 zh/en 双语文案（zh 为 key 全集），面板 label 用 thunk 才能跟随切换。
- **显示物料**：`plugin_manager`/插件页要求有意义的本地化标题、描述与**原创或已授权图标**（host-plugin.md 的 display checklist），空默认图标不可接受。
- **升级稳定性**：slot 的 key/kind/scope/owner props 是宿主契约（contract 目录带 source 路径）；`main`/`sidebar.panellist` 是 shipped 稳定面，但仍建议把注册集中在一个文件、用契约目录（`cordis_inspect_query` 的 `Slots`）在升级后复核。

---

## 8. 未验证项 / 需要拍板的点

**环境限制（必须声明）**：本会话的 Client inspect 不可用——`Slots.listSubTree`（root=`main`、`sidebar.panellist`）两次 `timed out after 10000ms`（页面未连接/未打开）。因此「live slot 拓扑」结论来自**已安装 0.2.1-rc.3 源码 + 内置契约目录**，不是 live inspection。

1. **默认打开**：`apply` 内 `ctx.layout.selectPanel(PANEL_ID)` 的可行性与时序未实测（没有 shipped 面板这么做）。可能问题：首帧闪烁、用户当时正开会话被切走、SSR/启动顺序。建议要么不做默认打开，要么做成用户可关闭的偏好。
2. **跨刷新保持「上次面板」**：layout 不持久化；插件自建持久化（localStorage/Host storage）需要额外设计，且要处理「上次面板已卸载」的兜底（`selectPanel` 会抛错）。
3. **普通插件包的 shadow priority 语义**：源码层清楚（同 priority 抛错、显式更低 priority 才遮蔽），但没有实际安装演练过；若后续要做「接管整个 shell」，需先写最小实验验证。
4. **`SessionProvider` 显式 session 引用**：给多会话并排渲染提供任意会话内容，需要 ui-session 的 SessionReference（`{binding, sessionId}`），插件侧如何取得未验证；不确定时退回「只读全局 useSessions + Host 投影」。
5. **全局 panel 选中时右列（rightbar）是否仍显示**：rightbar 占用者是独立的 right Sidebar，按 `ctx.layout` 报告自己；选中 `main` 全局面板时它的行为未验证（可能保留、可能因会话上下文缺失而空）。设计上建议 Mission Control 不依赖右列。
6. **性能**：Mission Control 想同时展示 N 个会话/子 agent 的实时状态时，数据源应走 Host 投影（`wire.view` + `useProjection` 的等价物）而不是自己订阅 `session/event`；具体选型见同目录 `data-signals.md`，本报告未评估吞吐。
7. **组件 props 的完整清单**：契约目录列出 9 个 root 标准 hook；实际运行时可能还有其它 share（`renderFactorySlot` 恒有）。写代码时用解构、不要假设「只有这些」。

---

## 9. 证据附录

### 9.1 已完成的 inspection
| 调用 | 结果 |
|---|---|
| `client Slots.listSubTree {root:"main"}` | **超时**（10s，页面未连接） |
| `client Slots.listSubTree {root:"sidebar.panellist"}` | **超时** |
| `host Config.listConfigs {limit:100}` | 202 条挂载条目（含 `include:plugin-manager`、`include:schedule`） |
| `host Config.listConfigs {name:"@deepseek-ai/dsh-schedule"}` | 1 条：`include:schedule`，status `schema` |
| `host Config.listConfigs {entry:"include:plugin-manager"}` | `packageDir=/Applications/…/app.asar/dsh/node_modules/@deepseek-ai/dsh-plugin-manager` |
| `host Config.listConfigs {entry:"include:schedule"}` | `packageDir=/Applications/…/app.asar/dsh/node_modules/@deepseek-ai/dsh-schedule` |

### 9.2 已读源码（0.2.1-rc.3，均在 app.asar 内，用 read/asar 解包读取）
- `@deepseek-ai/dsh-client-ui-layout/lib/client.js`：`root` 子 slot 声明（623-653）、`main` keyed 派发（118-120）、`selectPanel`（452-495）、layout store（391-447）、DocumentTitle（57-70）、`retainMainPanels`（410-412）。
- `@deepseek-ai/dsh-client-ui-sidebar/lib/client.js`：`sidebar.panellist` 声明（628-630）、面板列表投影（566-583）、`PanelRow`/`selectPanel`（204-236）、面板行过滤与「更多」菜单（468-501）、pin store 非持久化（17-30）。
- `@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js`：`NS/PANEL_ID/inject`（4352-4366）、`PluginManagerPage`（3831）、main 注册（4412-4483）、panellist 注册（4485-4490）。
- `@deepseek-ai/dsh-client-ui-schedule/lib/client.js`：`MANAGER_NS/PANEL_ID`（7364）、main + panellist 注册（7474-7493）、zh 文案 `panel: "自动化任务"`（6516）。
- `@deepseek-ai/dsh-client-ui-conversation/lib/client.js`：root main + session-maybe 子 slot 范例（20220-20236）、`ConversationPanel`（16353-16355）。
- `@deepseek-ai/dsh-cordis-client-runner/lib/client.js`：生成式契约目录——`main` 契约（4373 起）、`sidebar.panellist` 契约（5749 起）、`root` 警告（4913 附近）、`replaceRisk` 字段（2470 起）、`ctx.layout` 服务契约与 `MainPanelId` 声明、`guardedSlots` 自动 shadow priority。
- `@deepseek-ai/dsh-client-modules/lib/index.js`：`dsh.client` 扫描 Host Loader entries（104-106 等）。
- 缓存镜像 `.dsh-cordis-inspect/dsh/node_modules/@deepseek-ai/`（0.2.0-rc.2，用于读 0.2.1 未随包发布的 ui-slots / ui-renderer / ui-store 实现细节；关键结论已与 0.2.1 asar 源码交叉核对）：`dsh-client-ui-slots/lib/index.js:163-260`（register 校验/priority）、`dsh-client-ui-renderer/lib/client.js:600-760`（error boundary、scope kit、`standardKit`）、`dsh-client-ui-session/lib/client.js:203-209, 469-480`（session 绑定与 root provide）。

### 9.3 与本次结论冲突/需注意的版本差异
- 缓存镜像为 0.2.0-rc.2，`@deepseek-ai/dsh-client-ui-slots`、`-primitives`、`-store` 在本安装（0.2.1-rc.3）中没有独立 `node_modules` 目录（打包进 web 前端 bundle）。相关语义已用 0.2.1 asar 中的**生成式契约目录 + 实际客户端调用点**核对；但 slot 内部实现细节的最终权威仍是升级后的源码/新版契约目录。
