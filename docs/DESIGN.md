# 设计规范（UI/UX）

本文档是 CoGM 视觉与交互设计的单一事实来源，面向 UI/UX 设计师与前端工程师。开始任何 UI 工作前必读。

## 设计方向：Material Design 3 Expressive

全站采用 **M3 Expressive**（2025-05-13 随 Google I/O 发布）设计语言。它是 Material Design 3 的扩展，**不是 M4、不取代 M3**：在 M3 的动态颜色、字阶、组件体系上叠加"情感化表达"层——更鲜活的色彩、弹簧动效、35 种形状、强调字重。官方研究（46 项研究、18,000+ 参与者）结论：Expressive 界面让用户定位关键 UI 元素的速度最高提升 4 倍，各年龄段用户均偏好，且在 playful / energy / creativity / friendliness 维度得分一致更高。

## 调研结论（2026-09-18 核实）

### 1. 官方组件库：Web 平台没有，且不会跟进

| 平台                           | 状态                                                                        | 证据                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Android（Jetpack Compose）     | ✅ 唯一官方完整实现（组件 + 形状库 + MotionScheme）                         | [developer.android.com 参考](https://developer.android.com/reference/kotlin/androidx/compose/material3/package-summary) |
| Web（Material Web Components） | ❌ 维护模式，官方明示 **"Material 3 Expressive is not implemented on Web"** | [m3.material.io/develop/web](https://m3.material.io/develop/web)                                                        |
| Flutter | ⚠️ 官方 material_ui 已独立发布；Expressive 开发中，尚非完整实现（2026-09-19 源码复核） | [Flutter 发布说明](https://flutter.dev/blog/decoupling-material-cupertino) |

社区 React 实现（均非官方，仅供规格参考，**不作为依赖引入**）：

- [`gersilva96/react-material-expressive`](https://github.com/gersilva96/react-material-expressive)（MIT，React 19+）：自称首个完整 Web 端 M3 Expressive 实现，全套官方 token + 预编译 CSS，[Storybook 演示](https://react-material-expressive.vercel.app)。星数极少、单作者，成熟度风险高。
- [`md3-react`](https://md3-react.ngs.io/)：普通 M3，非 Expressive。

### 2. 决策：shadcn/ui 基底 + 全套 M3 Expressive 规范改造

官方没有 Web 组件库 → 按既定方案：以仓库内的 **shadcn/ui 原子组件**（`apps/client/src/components/ui/`）为基底深度改造，把 M3 Expressive 的 token 体系、组件规格、动效曲线落到 Tailwind v4 / CSS 变量层。shadcn 组件源码在仓库内、天然可改，业务逻辑（Radix 行为、可访问性）全部复用，只重做视觉与动效。改造时以官方 Figma 套件与规范页面为准绳，逐组件对齐。

自定义字阶必须在 `tailwind-merge` 的 `text` theme 分组注册，避免字号与前景色互相覆盖。组件专项动效可按已固定版本的 Dart 弹簧参数采样为 CSS `linear()` token：Switch 分离位移与尺寸；导航位移单调收敛，局部形变每侧不超过 4px，不随跨项距离放大；普通按钮和图标按钮使用真实半径形变，不插值 `9999px`、不靠整体缩放替代形变。按钮仅使用单一状态层，连接按钮固定外圆角、只过渡内圆角。参数仍统一放在 `theme.css`，来源与 Web 中断限制见 `docs/design-system/README.md`。

### 3. 官方资源（设计师/工程师入口）

| 资源                                                       | 链接                                                                                                                                                       | 用途                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M3 Expressive 总览博客                                     | [m3.material.io/blog/building-with-m3-expressive](https://m3.material.io/blog/building-with-m3-expressive)                                                 | 发布说明、7 条战术、组件清单                                      |
| **Figma 官方设计套件**（已含 Expressive 组件与 35 形状库） | [figma.com/community/file/1035203688168086460](https://www.figma.com/community/file/1035203688168086460)                                                   | 设计师主工作文件，组件/形状/token 的权威视觉源                    |
| Material Theme Builder                                     | [material-foundation.github.io/material-theme-builder](https://material-foundation.github.io/material-theme-builder/)                                      | 输入种子色生成全套 MD3 配色方案并导出 token（CSS 变量可直接粘贴） |
| 颜色规范                                                   | [m3.material.io/styles/color](https://m3.material.io/styles/color/overview)                                                                                | 26+ 颜色角色、三级对比度、色调表面                                |
| 字体规范                                                   | [m3.material.io/styles/typography/type-scale-tokens](https://m3.material.io/styles/typography/type-scale-tokens)                                           | 15 baseline + 15 emphasized 字阶                                  |
| 形状规范                                                   | [m3.material.io/styles/shape](https://m3.material.io/styles/shape/overview-principles) · [圆角阶](https://m3.material.io/styles/shape/corner-radius-scale) | 35 形状、形状变形、圆角 token                                     |
| 动效规范                                                   | [原理](https://m3.material.io/styles/motion/overview/how-it-works) · [规格（含 Web 换算表）](https://m3.material.io/styles/motion/overview/specs)          | 弹簧物理、motion scheme、Web 曲线换算                             |
| 组件规范                                                   | [m3.material.io/components](https://m3.material.io/components)                                                                                             | 逐组件结构与状态规格                                              |
| Google Design 案例库                                     | [design.google/library](https://design.google/library)（如 [Expressive UX 研究](https://design.google/library/expressive-material-design-google-research)，文章底部 Related 链接相关指南/套件/模板）                                                              | 官方落地案例、教程、研究方法；查新需求官方参考的第一站            |

## 新需求 UI 的设计流程（先查官方，再自行设计）

新增组件或为全新需求构建 UI 之前，必须按以下顺序查证 Google 官方是否已有相关模板/模式，**有官方方案一律优先采用，不另行发明**：

1. **[m3.material.io/components](https://m3.material.io/components) 与 foundations**——查是否已有对应组件规范或交互模式（注意 15 个 Expressive 更新组件的新行为）。
2. **[Figma M3 Design Kit](https://www.figma.com/community/file/1035203688168086460)**——查套件中是否已有可直接复用的组件/模板。
3. **[design.google/library](https://design.google/library)**——Google 官方设计案例库，含各产品的 Expressive 落地案例与教程；文章页底部 "Related" 区块会链接相关指南、套件与模板，顺藤摸瓜找齐参考。
4. 以上都没有 → 按本文档"风格系统规范"与"组件策略"自行设计。

无论参考来源，最终落地都必须收敛到本文档的 token 体系与工程约束，不引入体系外的样式与动效。

## 核心理念与设计思路

### Expressive 的抓手：7 条设计战术

1. **多样形状**——混合圆与方制造张力；打破周围形状风格以突出特定元素（但小形状会削弱主操作的重要性）。
2. **丰富有层次的色彩**——用 primary / secondary / tertiary 角色对比排优先级；用表面色调（surface container 层级）建视觉层级。
3. **字体引导注意力**——emphasized 字重用于标题、主操作、选中态；制造"编辑排版（editorial）"时刻。
4. **容器分组强调**——内容按逻辑分组进容器，最重要内容给足空间与最亮表面。
5. **流畅自然动效**——弹簧动效、形状变形、表面效果，让交互"活"。
6. **组件灵活性**——组件随环境与设备形态变化（本项目为桌面 Web 为主，仍需响应式）。
7. **组合战术制造 Hero Moment**——全产品只保留 1–2 个"高光时刻"（对本项目：场景切换/演绎呈现是天然候选），过多则失焦。

判断 Hero Moment 的标准：这个交互是否有情感冲击力？是否是产品关键交互？

### 与本产品的结合

- **沉浸舞台视图**（背景 + 立绘 + 对话框）是产品自有表面，MD3 无对应组件：保留 `stage-*` / `dialogue-*` token 分区，但其值、圆角、动效一律从 MD3 token 推导，不另起体系。
- GM 后台 / 控制台是工具型界面：组件密度高，**以 standard motion scheme 为主**；玩家沉浸视图用 expressive scheme。单界面内 scheme 可逐元素切换。
- 全站深色主题（墨色底，见 `docs/product.md`）：MD3 内建深色方案，用 Theme Builder 以品牌种子色生成，不使用手动调色。

## 页面设计方向（2026-09-19 重设计）

> 上一版仅做了 token 级换皮，布局与视觉语言未动，被判不合格。本节是页面级设计的单一事实来源：每个表面给出**官方参考出处**与版式/层级/形状/动效决策，实现与验收均以本节为准。

### 官方参考实例（版式模式的直接来源）

| 参考 | 提取的模式 | 用在 |
|---|---|---|
| [m3.material.io](https://m3.material.io) 官网自身 | 左侧 **navigation rail**（图标+短标签垂直堆叠，选中态为 secondary-container 横向椭圆指示器）；页头巨型 display 字 + pill 分段页签 | GM 后台布局、GM 各页页头 |
| [building-with-m3-expressive](https://m3.material.io/blog/building-with-m3-expressive) 的 Serafina 音乐播放器示例 | **display serif 大标题 + 大面积色块（color field）+ 巨型圆角主按钮**构成 Hero Moment | 入口页 `/` |
| [styles/shape](https://m3.material.io/styles/shape/overview-principles) 35 形状库 | **arch 拱形**（顶部全圆角，肖像/人物框的天然形状，且呼应 TRPG 牌位感）；大圆 blob 作背景装饰色块 | 立绘/头像框、入口页背景 |
| [components/button-groups](https://m3.material.io/components/button-groups/overview) | 连接按钮组：非对称内圆角、选中段弹簧变形 | GM 控制台阶段切换、骰盘预设 |
| 官网组件页 pill 分段页签 | 圆角容器内 tonal pill 选中 | 聊天频道切换（Tabs）、各处 segmented |

### 全局语言修正

- **层级靠容器色不靠描边**：面板与背景之间用 surface-container 层级差（`bg-md-surface-container-low` 面板 on `bg-background` 页面），分隔线只在列表内部使用，去掉面板大边线。
- **每页一个 Hero Moment**：入口页=品牌区；玩家视图=舞台对话；GM 仪表盘=统计色块卡；控制台=阶段切换。其余元素降噪。
- **入场动效**：页面/区块 `animate-in fade-in slide-in-from-bottom-4 duration-500 ease-expressive-default-spatial`，列表子项依次 `delay-75/150/225`；GM 工具面用 standard 曲线。
- **编辑排版时刻**：衬线仅用于入口品牌与沉浸演出中的场景名、演绎者名、情报标题等表达性内容；工具界面的页面标题、列表项和弹窗标题使用 `font-sans` + emphasized 字阶，描述 `text-body-large text-md-on-surface-variant`。

### 入口页 `/`（参考 Serafina hero）

- 全屏居中；背景放 2 个低透明度大圆形色块（`bg-md-primary/10`、`bg-md-tertiary/10`，`blur-3xl`，错位布局）作环境光，禁止图片素材。
- 品牌区：Logo `size-16`；`CoGM` 用 `text-display-large-emph font-serif`；副题"主持人的呼唤" `text-title-medium text-md-on-surface-variant`。
- 表单即主操作：输入框 `h-14`，主按钮 `h-14 px-8` primary 大按钮（Expressive large size），二者同高并排。
- 主持人入口保持底部 ghost 小字，降噪。

### 进团页 `/join/$sessionId`

- 页头：团名 `text-headline-medium-emph font-serif`，导语 `text-body-large`。
- PC 座位卡为大卡（`rounded-2xl`、surface-container-low），头像/立绘框用 **arch 形**（`rounded-t-full rounded-b-xl`）；选中态 `bg-md-primary-container` + `ring-2 ring-md-primary`，切换带 spring。
- OB 位降级为次级列表区，不与 PC 卡抢层级。

### 玩家沉浸视图 `/play/$sessionId`

与 GM 控制台共享“浮岛”语言：场景全屏铺满，交互层以悬浮卡片叠在画面之上，玩家侧只保留聊天与必要操作。

- **舞台**：全屏背景图 + 立绘，顶部/底部 scrim 渐变保留；场景信息在左上，场景名 `text-headline-small-emph font-serif`，状态/阶段 chip 用 tonal badge，外层为小号浮岛卡（`bg-md-surface-container-low/72` + blur）。
- **顶部工具坞**：画面顶部居中，形制与 GM 控制台一致；桌面端显示图标 + 文案（窄视口自动收为纯图标），提供掷骰/鉴定、人物卡、情报、在线玩家四个入口。点击展开浮层或对话框，不占用聊天侧栏。
- **对话框**：底部居中的悬浮卡（最大 860px），说话人名牌为半悬浮 pill（`-top-4`，`bg-md-primary-container`，serif emphasized），正文 `text-body-large`；新消息 `animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial`。
- **聊天浮岛**：右侧悬浮 `rounded-xl` 面板（`bg-md-surface-container-low/92` + blur + border），宽度随视口 344–400px，可收起；结构为标题 + 频道筛选 + 消息流 + 作曲器，不再内嵌骰盘。
- **消息**：本人/己方 `bg-md-primary-container`，他人 `bg-md-surface-container-high/70`，系统骰点/鉴定记录为带骰子图标的独立小卡（`rounded-xl`，失败/成功用左侧 2px 状态色），气泡 `rounded-2xl`、连续同人消息收紧间距。
- **审查状态**：玩家发言进入待呈现队列时，作者侧立即显示「待审查」与放行提示；主持人拒绝时可填写理由，玩家侧保留原发言并显示「未通过」与拒绝理由。
- **作曲器**：说话人 + 发言模式/表情（表情经浮层选择）+ 单行输入；骰盘、人物卡、情报、在线列表均以浮层/对话框展开。
- **界面显示**：工具坞的「界面显示」浮层可逐项隐藏场景信息、音乐播放器、人物状态卡、对话框与情报提示；设置仅保存在本机。
- **竖屏/横屏**：舞台与聊天改为上下叠放（竖屏）或左右浮岛（横屏），操作坞并入聊天面板，避免遮挡立绘。

### GM 后台 `/gm/*`（参考 m3.material.io 官网版式）

- **导航改为 navigation rail**：`w-24` 窄栏，每站 icon（上）+ label-medium（下）垂直堆叠；选中态为 `bg-md-secondary-container` 横向椭圆指示器包裹 icon + emphasized 标签，切换用 standard spring。顶 Logo、底主持人头像+登出。
- 页头：标题 `text-display-small-emph font-sans`，描述 `text-body-large`；主操作按钮大号（`h-12 px-6`）。
- **仪表盘统计卡（Hero）**：四卡分别 `bg-md-primary-container / secondary-container / tertiary-container / error-container`，数字 `text-display-small-emph`，图标+标签 on-container 色，`rounded-2xl`、`h-28`——色块战术的直接落地。
- 列表页：表格外层套 `rounded-2xl bg-md-surface-container-low` 容器；模组/音乐等卡片封面区 `rounded-t-2xl bg-md-surface-container-highest`，标题 sans emphasized。
- 表格、表单等高密度区保持信息密度，不为装饰牺牲可用性。

### GM 控制台 `/gm/session/$sessionId`（B2 · 导演工作台）

以 1920×1080 为基准的全屏舞台构图，控制层作为浮岛叠在场景之上，不再切分左右实体栏。

- **顶部导航**：44px 圆形返回键 + 模组题名（sans headline-small）+「团名 / 导演工作台」副题；右侧依次为状态 pill（进行中）、在线人数 pill、更多菜单与 KP 头像。
- **舞台**：左右 24px、上 104px、下 24px 的内嵌 32px 圆角画面；顶部 457px 与底部 438px 的暗色可读性渐变。
- **左列浮岛**（292px，`bg-md-surface-container-low/95` + blur）：团内阶段大卡（`bg-md-primary`，内含 36px sans 阶段名）、待呈现队列、角色状态重点提醒、BGM 迷你播放器。阶段卡展开为 380px 纵向菜单。
- **右列浮岛**：292px「桌边对话」实时消息卡；频道筛选、搜索、消息流与 KP 作曲器。系统骰点/鉴定记录用独立容器卡呈现。
- **中央工具坞**：顶部居中的 56px 圆形按钮组，激活项横向展开为 112px 主色胶囊；图标固定 24px，外层始终画面居中。面板从按钮下方展开为 584px `rounded-xl-inc` 浮层，点击原按钮或 Esc 收起。
- **五块配置浮层**：场景（搜索 + 缩略图列表）、人物（表情 / HP / MP / SAN 与状态编辑）、情报（条目预览 + 公开/秘密发放）、鉴定（类型/对象/技能/难度/奖惩/暗骰）、声音（曲目、波浪进度、循环与淡入淡出、全团音量、即兴音效）。
- 动效以 standard 曲线为主：宽度变化直接停靠，颜色单独平滑过渡，避免共享底板横向滑动。

## 风格系统规范（落地参数）

### 颜色

- 采用 MD3 完整颜色角色体系（26+ 角色：`primary / on-primary / primary-container / on-primary-container`、secondary、tertiary、error、`surface / surface-container-lowest…highest / on-surface / on-surface-variant / outline / outline-variant / inverse-*` 等）。
- 配色不手写：以和风品牌种子色（现有 `brand-*`，如墨色 `#1C1C1C`、萌黄 `#7BA23F`、红 `#CB1B45`、山吹 `#FFB11B`）输入 Theme Builder 生成深色方案，导出 CSS 变量粘贴进 `theme.css`。
- 表面层级用**色调表面**（surface-container 五档），不用 elevation 阴影叠色。
- 对比度遵循三级体系（standard / medium / high），默认 standard，至少满足 WCAG AA。
- 语义色（danger/warning/success）映射到 MD3 的 error 角色 + tertiary 扩展角色，不脱离色调体系另造颜色。

### 字体排印

- 采用 M3 字阶：**15 baseline + 15 emphasized 共 30 种样式**，同一标尺（Display → Label）。Emphasized = 更高字重 + 微调，用于标题、主按钮、选中态、未读提示；**与 baseline 混用，组件默认仍用 baseline**。
- baseline 标尺（Material 默认值，dp/sp ≈ px）：Display L/M/S = 57/45/36，Headline L/M/S = 32/28/24，Title L/M/S = 22/16/14，Body L/M/S = 16/14/12，Label L/M/S = 14/12/11；Title 与 Label 级字重 500。Emphasized 各档精确值以 Figma 套件 / 规范页 token 表为准。
- 双字族：**brand typeface** 用于入口品牌与沉浸演出中的表达性内容，**plain typeface** 用于工具界面标题、Body/Label 与列表内容。本项目映射：brand → 系统 serif 栈（`ui-serif` / Songti SC / SimSun / Georgia），plain → 系统 sans 栈（`system-ui` / PingFang SC / Microsoft YaHei），数字与英文 UI 小字沿用系统 UI 字体。全站不请求、不下载外部字体，`font-mono` 同样使用系统等宽栈。
- 中文属 **Medium 语言高度**（行高约比拉丁 +7%），行高按此设定；固定高度组件注意防裁切。

### 形状与圆角

- 圆角采用 M3 十级阶梯 token：**none 0 / xs 4 / sm 8 / md 12 / lg 16 / lg-increased 20 / xl 28 / xl-increased 32 / xxl 48 / full 全圆角**（px）。Expressive 更新点：新增 20/32/48 三档，全圆角用 `full` 不再用 50%。
- 组件默认映射：按钮全圆角（full）、卡片 md–lg、对话框 xl；菜单、split button 等紧密分组用**非对称内圆角**（inner corner）。
- 35 种装饰形状（Figma 套件 / Compose Shape Library）只用于非交互装饰：立绘裁切、头像遮罩、loading、进度指示。**形状不承载语义**（同一形状不绑定固定含义），抽象形状克制使用。
- 形状变形（shape morph）用于：选中态切换、进行中状态、环境变化提示；Web 端用 CSS `border-radius` / `clip-path` 过渡实现。

### 动效（motion physics → Web 换算）

MD3 Expressive 用**弹簧物理**取代传统 easing+duration，两类弹簧 × 三档速度：

- **spatial spring**：位置/旋转/尺寸/圆角，允许过冲回弹；
- **effects spring**：颜色/透明度，无过冲。
- 两档 scheme：**expressive**（默认，回弹明显，用于玩家视图与关键时刻）与 **standard**（功能性，回弹极小，用于 GM 工具界面）。

Web 端按官方换算表落为 `cubic-bezier` + 时长（CSS transition / tw-animate-css）：

| Spring token               | cubic-bezier               | 时长          |
| -------------------------- | -------------------------- | ------------- |
| expressive fast spatial    | `(0.42, 1.67, 0.21, 0.90)` | 350ms         |
| expressive default spatial | `(0.38, 1.21, 0.22, 1.00)` | 500ms         |
| expressive slow spatial    | `(0.39, 1.29, 0.35, 0.98)` | 650ms         |
| expressive fast effects    | `(0.31, 0.94, 0.34, 1.00)` | 150ms         |
| expressive default effects | `(0.34, 0.80, 0.34, 1.00)` | 200ms         |
| expressive slow effects    | `(0.34, 0.88, 0.34, 1.00)` | 300ms         |
| standard fast spatial      | `(0.27, 1.06, 0.18, 1.00)` | 350ms         |
| standard default spatial   | `(0.27, 1.06, 0.18, 1.00)` | 500ms         |
| standard slow spatial      | `(0.27, 1.06, 0.18, 1.00)` | 750ms         |
| standard effects（三档）   | 同 expressive effects      | 150/200/300ms |

速度选用：小元件（switch、按钮）→ fast；半屏级（对话框、面板）→ default；全屏级 → slow。尊重 `prefers-reduced-motion`。

## 组件策略

Expressive 更新涉及 15 个组件（App bars、Button groups🆕、Common buttons、Extended FAB、FAB menu🆕、FABs、Icon buttons、Loading indicator🆕、Navigation bar、Navigation rail、Progress indicators、Sliders、Split button🆕、Toolbars🆕）。shadcn/ui 基底改造时的对应关系：

| 现有 shadcn 组件                                             | MD3 Expressive 对应                       | 改造要点                                                   |
| ------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `button`                                                     | Common buttons                            | 全圆角/方角变体、尺寸阶、emphasized 字重、按压 shape morph |
| —（新增）                                                    | Button groups / Split button              | 非对称内圆角、连接态                                       |
| `dialog` / `alert-dialog`                                    | Dialogs                                   | xxl 圆角、expressive spatial 进出                          |
| `card`                                                       | Cards                                     | 色调表面、圆角 lg–xl                                       |
| `switch` / `checkbox` / `radio-group`                        | Switch / Checkbox / Radio                 | fast spatial 弹簧、state layer                             |
| `slider`                                                     | Sliders (Expressive)                      | 波浪轨道、手柄形状                                         |
| `progress`                                                   | Progress indicators + Loading indicator🆕 | wavy 变体、形状循环                                        |
| `tabs`                                                       | Tabs / Navigation                         | 指示条弹簧滑动                                             |
| `badge`                                                      | Badges                                    | emphasized label                                           |
| `dropdown-menu` / `popover` / `select`                       | Menus                                     | 内圆角分组、expressive 展开                                |
| `input` / `textarea` / `input-group`                         | Text fields                               | 容器态、state layer、标签动效                              |
| `tooltip`                                                    | Tooltips                                  | plain tooltip 规格                                         |
| `sonner`                                                     | Snackbar                                  | 容器色 + 动作按钮                                          |
| `separator`                                                  | Divider                                   | outline-variant                                            |
| `avatar` / 立绘裁切                                          | Shape library 装饰用法                    | 35 形状遮罩、shape morph                                   |
| `table` / `pagination` / `accordion` / `label` / `input-otp` | 无直接对应                                | 按颜色/字体/圆角/动效 token 体系套用，保持视觉一致         |

逐组件视觉以 Figma 套件为对齐基准；交互行为沿用 Radix/shadcn 现有实现，不为对齐像素重写行为逻辑。

## 工程约束（硬性）

- **样式文件职责分离**：`apps/client/src/styles/globals.css` 仅作为全局样式入口（聚合 `@import` 与 `@layer base`）；全部设计 token（颜色、阴影、圆角、字体、动效）必须定义在 `apps/client/src/styles/theme.css` 的 `@theme` 块中并按文件内分区归类，禁止写回 `globals.css` 或在其他文件中新建 `@theme`。
- **token 单一来源**：组件只使用 token 生成的 utility class，禁止硬编码颜色/圆角/时长字面量。MD3 角色色值由 Theme Builder 导出后粘贴，保持可再生成。
- **token 命名**：MD3 规范角色以 `md-` 前缀落 token（`bg-md-primary`、`bg-md-surface-container-high`、`text-md-on-surface-variant`…），色值为 Theme Builder 同引擎生成结果，禁止手调；`accent`/`danger`/`field`/`stage` 等语义别名是 products 层的稳定接口，视图优先用语义别名，别名不够时才直接用 `md-*` 角色。
- **字阶落 token**：`text-{display|headline|title|body|label}-{large|medium|small}[-emph]` 携带 size/line-height/weight，禁止再叠加 `leading-*`/`font-medium` 等重复定义；入口品牌、场景名、演绎者名与情报标题等表达性文本用 `font-serif`（brand 字族），工具界面标题、列表项、弹窗标题与正文用 `font-sans`（plain 字族）。
- 全站统一深色主题；玩家沉浸视图与 GM 后台共用同一套语义 token。
- 新增动效一律引用上表曲线 token，不自创缓动。
- **站点文案一律走 i18n**：新增 UI 文案必须加入 `apps/client/src/i18n/messages/zh-CN.ts` 并在组件中通过 `t("域.键")` 读取，禁止在 JSX 中硬编码中文；这样运行时主题才能按 key 覆盖文案。基础语言为 `zh-CN`，缺失键逐级回退。
- **运行时主题是 token 约束的文档化例外**：自部署者可通过主题包覆盖插槽、`--color-md-*` token 与文案，详见 `docs/theme-system.md`。主题 CSS 与 `manifest.tokens` 不得写回核心 `theme.css`；核心代码仍只使用本文档规定的 token。
- **主题化边界**：核心拥有的路由、状态与 GM 主题浮钮不可被主题替换；主题只实现 `packages/theme-sdk` 声明的页面级插槽，未覆盖部分回退内置 `default` 主题。

## Dart 源码迁移组件库（2026-09-20）

原有 27 个 shadcn 原子组件全部纳入重绘，补齐社区 Dart 的 40 个组件入口映射。固定源码、许可证、Pen 新画板、组件清单与平台差异见 [组件库说明](design-system/README.md)。官方 material_ui 作为基础参考，material_3_expressive 仅作明确标注的补充来源。

组件样式统一维护在 expressive.css，形状关键帧由 expressive-shapes.css 承载，二者均不定义 @theme。theme.css 仍为唯一 token 来源。Button 五档尺寸为 32/40/56/96/136 px；旧变体名继续兼容。新增 /design-system 开发预览页，生产不开放。
