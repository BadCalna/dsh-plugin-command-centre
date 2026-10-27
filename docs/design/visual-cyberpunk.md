# Command Centre · 赛博朋克仪表盘 CSS 规范 v1.0

> 由 subagent 调研产出，v0.3.0 落地。约束：单文件 `<style>`、无远程资源、继承宿主
> `--dsw-*` token、明暗双主题、`prefers-reduced-motion`。
> 核心结论：赛博感来自**结构密度 + 硬边 + 单一冷光 + 扫描纹理**，不来自彩虹霓虹。
> 采用方向 ①「COLD CONSOLE」，配色走「92/6/2 配额」。

## 参考与可提取的结论

| 参考 | 提取什么 |
|---|---|
| [Cyberpunk 2077 UI 拆解](https://www.ixbt.com/live/games/kod-krasnyy-razbor-interfeysa-cyberpunk-2077.html) | 切角、错位层、扫描噪点；故障感来自**结构错位**而非颜色数量 |
| [Cyberpunk UI 设计评述](https://pixso.net/tips/cyberpunk-ui/) | 霓虹滥用典型翻车：全屏高饱和 + 无留白 = 廉价 |
| [Warp 自定义主题](https://docs.warp.dev/terminal/appearance/custom-themes/) | 近黑底 + 极少色 + 高对比前景，颜色只承担语义 |
| [btop](https://github.com/aristocratos/btop) | 仪表感来自对齐与分段，不来自装饰 |
| [Bloomberg Amber CRT 风格](https://designbycurio.com/zh/learn/bloomberg-terminal-amber) | 琥珀是疲劳工程学选择；浅色版保留网格与硬边、丢掉磷光 |
| [NASA DSN 人机界面](https://dl.acm.org/doi/pdf/10.1145/259964.260004) | 暗环境控制台：编码稳定、位置恒定、颜色不随意复用 |
| [W3C C39 reduced-motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) | 动效降级必须语义等价 |

为什么有效：颜色越少，颜色才越像信号；结构线越硬，界面越像仪器；动效越少，异常才越显眼。

## 配色（已落地）

语义色一律继承宿主 token（`--dsw-alias-state-*`），只有**结构冷光**是插件自定义：

| 用途 | 浅色 | 深色 |
|---|---|---|
| accent（焦点/选中/扫光/图标） | `#0a6c7e` | `#57e2ff` |
| 网格线 | `rgba(14,110,130,.10)` | `rgba(96,208,255,.055)` |
| 扫描线 | `rgba(10,40,50,.012)` | `rgba(255,255,255,.018)` |
| tint（hover/选中底色） | `rgba(10,108,126,.05)` | `rgba(87,226,255,.06)` |
| 暗角 | `rgba(20,40,55,.06)` | `rgba(0,0,0,.55)` |
| 状态文字色（浅色下压暗到 ≥4.5:1） | `color-mix(state 58–72%, #06202b)` | 直接用宿主 state 色 |

**92/6/2 法则**：92% 面积中性（文字 + 底），6% 低饱和 tint，2% 高饱和信号。
饱和色填充面积 >6% 即视为违规；发光元素每屏 ≤3 个。

深色覆盖用宿主属性 `body[data-ds-dark-theme] .mc-root { … }`（已确认宿主只在该 body 属性上切暗色）。

## 已落地的技法

- **背景**：48px 双层网格 + 3px 扫描线 + 内联 SVG 噪点（`feTurbulence`，一次栅格化）+ 顶部 tint 渐变 + 暗角；全程静态，不动画 `background-position`
- **边框/切角**：卡片 2px 圆角 + 左上/右下 L 形角标（`::before/::after`）；列头 `clip-path` 切角 + `CH-0N` 编号
- **光晕**：三层 `box-shadow`（接触环 1px / 核心 6px / 泛光 14px），外层透明度 ≤16%
- **标题/数字**：等宽、`.16em` 字距、`tabular-nums slashed-zero`、深色下轻微 text-shadow
- **卡片**：内缩状态轨（背景渐变画，不占 DOM）+ hover 只抬 1px + 选中 accent 描边
- **进度条**：6px 直角、`mask-image` 12 段、25% 刻线、填充带 10px 光
- **状态**：运行 = 呼吸光点（2.4s）；需要你 = 菱形（`clip-path`，不用 rotate）；失败 = 4.5s 两步熄灯
- **头部**：单条 26% 宽扫光，7s 一次，只动 `transform`
- **抽屉**：97% 不透明（替代 backdrop-filter）+ 左缘 accent + scrim + 140ms 滑入
- **减弱动效**：`prefers-reduced-motion` 下关掉扫光/呼吸/入场，运行点改静态描边环

## 禁忌（评审基线）

1. 全屏紫蓝渐变 + 每张卡外发光：颜色不再表意
2. 荧光绿正文 / 10px 标签：暗底泛光糊成一片
3. 所有卡片都切角都发光：没有主次，`clip-path` 还会剪掉阴影
4. `backdrop-filter: blur(20px)` 大面积使用：滚动掉帧第一来源
5. 持续 glitch / 随机抖动：与"扫一眼知道谁在等"直接冲突
6. 纯黑底 + 纯白大字：暗色 halation，久看疲劳
7. 状态只靠颜色：色盲不可用，也不符合宿主语义
8. accent 铺满（标题/图标/边框/进度全青）：信号贬值

## 验收三条

1. 缩到 50% 截图仍能分出三列与「需要你」
2. 屏内饱和像素 <2%、发光元素 ≤3
3. 浅色主题下所有 10px 标签对比度 ≥4.5:1、无 `text-shadow`
