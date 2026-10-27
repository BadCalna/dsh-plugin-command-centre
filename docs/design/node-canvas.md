# Command Centre · 节点式画布（Node Canvas）规划 v0.1

> 结论：**纯 Client 就能做，不需要新依赖**。P0（静态树布局 + 平移缩放 + 点节点开抽屉）约一个迭代；
> 边流动光点、手动拖拽、位置持久化放 P1/P2。与看板是互补视图，不是替代。
>
> **状态：P0 + 布局开关已实现（v0.4.0 / v0.5.0）** —— 三层视图循环、卡片 `⌗` 聚焦、拖拽平移、`⌘`+滚轮缩放、`0`/`⌖` 适配、
> 运行中边流动光点（已顺手做了）。v0.5.0 追加画布内布局开关：**方向 横/纵**、**范围 全部/子树**、
**连线 曲线/直角**（状态存在组件内，刷新回默认）。P1 剩余：键盘 DFS 显式提示、折叠 `+N`、节点内联展开、
记住布局选择；P2：手动拖拽 + 持久化、minimap、时间线、workflow 阶段节点。

## 1. 为什么值得做（和看板的差别）

| | 看板 | 画布 |
|---|---|---|
| 回答的问题 | 谁在跑、谁在等我、谁空了 | 一个任务被拆成哪些子任务、依赖/派生关系、卡在哪一层 |
| 单位 | 任务（一行/一卡） | 节点（会话 / subagent / 未来 workflow 阶段） |
| 强度 | 并发扫视（10–30 个任务） | 单主线深挖（1 个任务 + 3–10 个子节点） |
| 现状 | 已有（默认） | **没有**，正是你想补的那种"工作流"感 |

真实使用里 subagent 树很浅（1 主 + 1–6 子），所以画布不该是首页，而是**放大镜**：
从看板里点一个任务的「画布」按钮进入，或作为第三个视图切过去。

## 2. 信息模型

**节点**（来自 `useSessions` 的 `byId` + 投影，全部现成）：

| 字段 | 来源 |
|---|---|
| id / 标题 / 工作区 | `byId[id].id` / `displayTitle` / `workspaces` |
| 层级 | `byId[id].parentId`（主会话为根） |
| 状态 | `useSessionStatus`：`running` / `pendingInteraction.kind` / `completionUnread` |
| 角色 | `subagentCatalog[].mode` + `subagent` 投影的 `mode/seq`（子节点顺序） |
| 进度 | 投影 `todos`（`done/total`） |
| 压力 | 投影 `contextPressure`（`projectedTokens/contextWindow`） |
| 时长 | 投影 `subagentTiming`（`settledMs` + `active`） |
| 目标/团队 | 投影 `goal` / `agentTeam`（Lead 节点额外挂队友节点） |

**边**（父子派生关系，方向父→子）：

1. `parentId` 边：主会话 → subagent（实线）
2. `agentTeam.members[]` 边：Lead → teammate（虚线，因为队友不一定是 parentId 子会话）
3. V1b 后可选：`tool-workflow/agent-start|end` 折叠出的 workflow 阶段节点（虚线框，独立分组）

**状态色**（沿用现有 token 与赛博朋克规范）：运行=青蓝呼吸、待你=琥珀菱形、完成未读=绿、
空闲=灰、失败（V1b）=红。**颜色不是唯一编码**：节点左上角同时有状态字形（●◆✓○✕）。

## 3. 布局算法（自己写，无依赖）

分层树（Sugiyama 简化版），从左到右：

```
depth(node) = parentId ? depth(parent)+1 : 0
for each depth level: 按（父节点顺序, 子序号）排序
y 坐标：按层内顺序堆叠，节点高度 88px + 间距 18px，用父节点 y 的中位数做回填（减少交叉）
x 坐标：depth * (节点宽 260 + 水平间距 72)
```

三个细节：

- **单子节点不换行**：只有一个子节点的链保持水平直线，视觉上像"流水线"，比扇出更清楚
- **根节点优先**：多个根（并发任务）纵向排列，同一根的子树用淡色包围框（cluster）标出来
- **规模上限**：≤120 节点正常；>120 自动折叠 depth≥3 的子树为「+N」节点，点开再展开

备选布局（P2 再评估）：**时间线**（x=创建时间，y=层级），适合"我这一天跑了什么"。

## 4. 交互

| 操作 | 行为 |
|---|---|
| 拖拽空白 | 平移（`transform: translate3d`） |
| `⌘/Ctrl + 滚轮`、触控板双指 | 缩放 0.35–1.6，围绕鼠标点 |
| 滚轮 / 触控板单指 | 纵向平移（不缩放，避免误触） |
| `F` 或按钮「适配」 | 缩放到全部节点可见（fit-to-view） |
| 单击节点 | 选中 + 打开右侧抽屉（复用现有 Drawer） |
| 双击节点 / `o` | 打开该会话 |
| `Enter` | 以选中节点为中心放大（focus） |
| `j/k` 或方向键 | 在树里上下移动选中（DFS 顺序） |
| 拖拽节点 | P1：临时移动（仅本机内存）；P2 存 localStorage（按 workspace+session 指纹） |
| 悬停边 | 高亮该链路（父到根、子到叶） |

**不做的**：翻页/无限画布、节点内联编辑、连线拖拽（只读，没有可写的语义）。

## 5. 技术实现（纯 Client）

```
<div class="mc-canvas">                     ← 捕获 pointer/wheel，overflow hidden
  <div class="mc-canvasWorld" style="transform: translate(x,y) scale(k)">   ← 只有这一个被 transform
    <svg class="mc-canvasEdges" width=W height=H>   ← 边用 SVG path（贝塞尔），pointer-events:none
    <div class="mc-node" style="left/top">…</div>   ← 节点用绝对定位的 div（HTML 内容更好排版）
  </div>
</div>
```

关键点：

- **只有 world 层做 transform**，节点内部不跟随缩放重排（`will-change: transform`）
- 边用 `path` 三次贝塞尔：起止点按节点右/左中点，控制点水平外推 0.4×间距；运行中的边加 `stroke-dasharray` + 流动动画（P1）
- 布局函数纯函数 `layout(nodes, edges) → {positions, size}`，`useMemo` 依赖 `byId/parentId`，不依赖 `now`
- 平移/缩放状态放 `useRef` + `requestAnimationFrame` 合帧，避免 React 每帧重渲染
- 缩放用 `transform` + `transform-origin` 计算，不做 `zoom`（Chromium 里会和布局打架）
- 节点数 ≤120 才允许全量渲染；超过走折叠
- `prefers-reduced-motion`：关掉边流动、节点呼吸，保留缩放/平移

## 6. 视图与信息架构

顶部视图切换从两段变三段：`看板 | 矩阵 | 画布`（`v` 循环）。

保留"从看板聚焦到画布"的入口：卡片右上角加一个 `⌗` 按钮，进入画布并自动 fit 到该节点的子树
（这样画布就不会变成又一个需要单独逛的地方）。

## 7. 分阶段

| 阶段 | 内容 | 依赖 | 验收 |
|---|---|---|---|
| **P0** | 静态树布局 + 平移缩放 + fit + 点击节点开抽屉 + 双击打开会话 + 状态色/进度/上下文 | 0 行 Host | 任意任务点 `⌗` 能看清它的完整子树；拖动/缩放不卡；`Esc` 回看板 |
| **P1** | 运行中的边流动光点、节点呼吸、从看板/搜索定位、键盘 DFS 导航、折叠 `+N` | 0 行 Host | 与看板状态实时一致；缩放后文字仍可读 |
| **P2** | 手动拖拽节点 + localStorage 持久化、minimap、时间线布局、workflow 阶段节点 | 位置持久化；workflow 需 Host 投影 | 刷新后布局不丢；workflow 阶段可见 |

## 8. 风险与待定

1. **布局质量**：自己写分层布局，扇出很大时会交叉；先用"单子节点不换行 + 父中位数回填"压住，P1 再加交叉最小化
2. **性能**：节点多 + 边多时 SVG 可能吃力（>300 边）；120 节点内没问题，超过折叠
3. **手动位置持久化**：localStorage 是 Client 私有状态，换机器不跟随；要跨设备得走 Host 存储（V2）
4. **workflow 节点**：`workflow/*` 是 Host 事件、不转发，没有投影就画不出阶段节点（V1b 后可评估）
5. **缩放后可读性**：节点文字 < 0.6 倍时隐藏次级信息（只留标题+状态点），否则会糊

## 9. 需要你拍板

| # | 问题 | 我的建议 |
|---|---|---|
| N1 | 默认视图：看板 / 画布 | **看板**（画布是放大镜） |
| N2 | 布局方向：左→右 / 上→下 | **左→右**（文本横向阅读、和子节点缩进一致） |
| N3 | 是否允许手动拖节点（P2） | 先不做，自动布局够用；做了就要考虑"自动布局会打乱我的手动位置" |
| N4 | 画布是否只显示"选中任务的子树"还是"全部任务" | **全部任务分簇**，但从看板点 `⌗` 时 fit 到子树 |
