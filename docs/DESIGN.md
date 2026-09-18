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
| Flutter                        | ❌ 官方明示 **"M3 Expressive is not available on Flutter"**                 | [m3.material.io/develop/flutter](https://m3.material.io/develop/flutter)                                                |

社区 React 实现（均非官方，仅供规格参考，**不作为依赖引入**）：

- [`gersilva96/react-material-expressive`](https://github.com/gersilva96/react-material-expressive)（MIT，React 19+）：自称首个完整 Web 端 M3 Expressive 实现，全套官方 token + 预编译 CSS，[Storybook 演示](https://react-material-expressive.vercel.app)。星数极少、单作者，成熟度风险高。
- [`md3-react`](https://md3-react.ngs.io/)：普通 M3，非 Expressive。

### 2. 决策：shadcn/ui 基底 + 全套 M3 Expressive 规范改造

官方没有 Web 组件库 → 按既定方案：以仓库内的 **shadcn/ui 原子组件**（`apps/client/src/components/ui/`）为基底深度改造，把 M3 Expressive 的 token 体系、组件规格、动效曲线落到 Tailwind v4 / CSS 变量层。shadcn 组件源码在仓库内、天然可改，业务逻辑（Radix 行为、可访问性）全部复用，只重做视觉与动效。改造时以官方 Figma 套件与规范页面为准绳，逐组件对齐。

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
- 双字族：**brand typeface** 用于 Display/Headline（表达），**plain typeface** 用于 Body/Label（可读性）。本项目映射：brand → `Noto Serif SC`（题字感），plain → `Noto Sans SC`；数字与英文 UI 小字可引入 Google Sans Flex / Inter。
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
- **字阶落 token**：`text-{display|headline|title|body|label}-{large|medium|small}[-emph]` 携带 size/line-height/weight，禁止再叠加 `leading-*`/`font-medium` 等重复定义；标题/演绎者名等表达性文本用 `font-serif`（brand 字族），正文用 `font-sans`（plain 字族）。
- 全站统一深色主题；玩家沉浸视图与 GM 后台共用同一套语义 token。
- 新增动效一律引用上表曲线 token，不自创缓动。
