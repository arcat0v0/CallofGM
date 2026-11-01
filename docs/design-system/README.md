# CoGM Expressive 组件库

以 Flutter / Dart 源码为结构和视觉参考，在仓库内重绘 shadcn/ui 组件，保留 Radix 的焦点、键盘与可访问性行为。项目色彩、中文字体和 motion scheme 仍以 [DESIGN.md](../DESIGN.md) 为准。

## 查看

```sh
bun run dev:client
```

打开 `http://localhost:15633/design-system`。该页面是独立的 Vite 开发入口（`design-system.html`），不注册进 SPA 路由表，也不进入生产构建产物；开发服务器只把 `/design-system` 重写到该入口。示例状态完全本地，不连接实际团、不发送消息。页面包含原有 27 个组件、新增组件、状态、两种 motion scheme、播放暂停、滑块、浮层、日期/时间、加载与 35 种形状。

`frontend.pen` 新增六个 `CoGM Expressive / 01–06` 画板。旧 HeroUI 库、旧页面以及 GM Expressive V2 页面均保留。新可复用组件以 `M3/` 命名。Pen 展示可编辑图层、关键状态和动效分镜；可运行的交互动画以 Web 组件为准。

## 固定来源

| 来源 | 固定版本 | 用途 |
|---|---|---|
| Flutter 官方 `material_ui` | 1.3.0 | Material 基础结构、原生状态语义；源码 ThemeData 标注 Expressive 仍在开发 |
| 社区 `material_3_expressive` | 1.1.2 | 40 个组件入口的补充规格、尺寸、状态和动画参考 |
| 社区 `material_new_shapes` | 1.0.0 | 35 个 RoundedPolygon 的原始三次贝塞尔曲线 |
| shadcn/ui Radix registry | 本次获取的 radix-nova 源码 | 新增 Calendar、Carousel、Drawer、Sheet、Field、Toggle、ToggleGroup 的行为基底 |

官方状态来自 [Flutter 发布说明](https://flutter.dev/blog/decoupling-material-cupertino)。社区包分别见 [material_3_expressive](https://pub.dev/packages/material_3_expressive/versions/1.1.2) 和 [material_new_shapes](https://pub.dev/packages/material_new_shapes/versions/1.0.0)。不能把社区实现的覆盖度解释成 Flutter 官方已经完整支持。

[upstream.lock.json](upstream.lock.json) 保存发布归档 URL、版本与 SHA-256。第三方许可证与本文件同目录；不把 Flutter 或社区 React UI 库加入运行时依赖。

重新拉取并验证源代码：

```sh
bun scripts/fetch-expressive-sources.ts /tmp/cogm-m3-sources
```

重新导出形状需要 Dart SDK。本次实际使用 Dart 3.13.4：

```sh
bun scripts/export-expressive-shapes.ts /tmp/cogm-m3-sources/material_new_shapes /path/to/dart
```

导出脚本只在临时副本移除 `dart:ui` Path 适配层，直接运行原有 RoundedPolygon 算法生成 SVG 曲线。静态形状使用源三次贝塞尔路径；七阶段加载变形采用等弧长采样的 128 点轮廓，属于 Web 近似。

## 使用与样式职责

组件位于 `apps/client/src/components/ui/`，按文件直接导入。完整对应关系见 [coverage.md](coverage.md) 和 [components.json](components.json)。

```tsx
<Button variant="filled" size="md" shape="round">放行发言</Button>
<Slider value={position} onValueChange={setPosition} wavy playing={playing} aria-label="播放进度" />
<Progress value={42} wavy aria-label="资源加载" />
<LoadingIndicator contained label="正在同步" />
```

- `theme.css`：唯一 token 来源，包括五档按钮尺寸、滑块几何、状态层、波浪与加载周期。
- `expressive.css`：统一 data-slot 组件样式及共享动画；原有 27 个组件全部纳入，避免在各文件重复同一状态配方。
- `expressive-shapes.css`：从 Dart 曲线导出的加载关键帧，不定义新的 theme token。
- `globals.css`：只新增样式导入，继续只负责入口与全局基础样式。

Button 的 `xs/sm/md/lg/xl` 高度现在与 Dart 对齐为 **32/40/56/96/136 px**。旧 `primary/secondary/outline/ghost/danger` 等变体名称仍可使用；`filled/tonal/elevated/text` 是与 Material 术语一致的变体。尺寸发生变化，业务页面原来的密度需要随视觉验收一起检查。

在普通容器上设置 `data-motion="standard"` 或 `data-motion="expressive"`。默认 standard。Radix Portal 脱离局部容器，浮层使用根级 standard；需要全应用 expressive 时将属性放在 html/body，或在浮层 Content 上显式设置。颜色、透明度始终使用无过冲 effects；位置、形状使用 spatial。系统减弱动画会停止循环并直接显示最终状态。

## 已落实与平台差异

已落实五档按钮、圆/方/按压形状、连接内角、独立状态层、不同容器表面、字段浮动标签、细长滑块手柄与间隔、波浪轨道、确定/不确定进度、圆形波浪、七形状加载、Tabs 指示器移动、浮层进入退出及减弱动画。

组件族覆盖 **40/40**；这不是所有 Flutter 参数、原生手势及物理模拟的一比一移植：

- 动效使用 DESIGN.md 的 Web 曲线换算；不运行 Flutter 的连续速度弹簧求解器，中断回弹不保证逐帧相同。
- Switch 位移与尺寸分别采样 Dart 的 `stiffness: 380 / damping: 0.55、0.7`。按钮形变采用更收敛的 `380 / 0.8`（源 `expressiveSpatialDefault`）采样；普通按钮与 IconButton 均在实际半径间插值，不对 `9999px` 做动画。连接按钮外侧圆角固定，内侧在 8 / 4 px 间过渡；悬停只使用一个状态层，置于文字与图标下方。
- Navigation、单选 ToggleGroup 与 Tabs 使用同一测量和指示器实现。按桌面反馈改为 350 ms 临界阻尼位移（`380 / 1` 采样并归一终点），不越过目标；Navigation 的局部形变每侧最多 4 px，图标最多 1.02 倍，不随跨项距离放大。快速反向切换从当前渲染位置续接，但不保留物理速度。
- 加载形状使用相同顺序、1000 ms 阶段及 1600 ms 全局旋转，轮廓插值不是 Flutter Morph 的特征匹配算法。
- 轮播使用 Embla 的滚动与吸附；未复制 Flutter sliver 的动态权重挤压布局。
- RefreshIndicator 提供桌面刷新按钮和进行中状态，不接管页面原生下拉刷新手势。
- 时间选择器提供双圈时钟点击及原生精确时间输入，刻度包含 8% 悬停、10% 按压状态层与键盘焦点环；不实现 Flutter 的拖针手势。日期范围可直接使用 Calendar 的 range 模式。
- SearchView 使用可访问的对话框展开：实色面板从 0.98 倍 / 下移 8 px 进入，不对面板整体做透明度动画；只有遮罩淡入，避免背景内容透过面板。不承诺 Flutter 跨路由容器几何共享动画。
- Radix 菜单、Vaul 面板、Sonner 消息的行为和手势沿用各自 Web 实现；保留 Web 语义，不模拟 Flutter 手势系统。
- 35 形状是源数据导出，品牌色、字体和中文行高有意采用 CoGM 规范。

## 验证

```sh
bun run test:ui
bun run --cwd apps/client typecheck
bun run build:client
```

测试覆盖 React/Radix 输出的进度语义、范围和无效数值、滑块手柄、SVG ID、混合选择、字段错误关联、Button asChild、图标按钮语义和 35 个形状数据。测试不等于浏览器交互验收。

颜色回归测试覆盖全部 30 个自定义字阶，防止 `tailwind-merge` 将字号误归为前景色并删除正确颜色。日历日期使用独立组件槽位，避免 ghost 按钮的透明底色覆盖选中态；Sheet 的标题、内容和页脚分别负责间距与滚动。

`.github/workflows/ui-components.yml` 对相关客户端改动运行上述测试、类型检查和构建。

2026-09-20 的 `bun audit --audit-level=high` 报告 15 项高危告警，涉及原锁文件已有的 brace-expansion、browserslist、fast-uri、ip-address、js-yaml、nanoid 和 undici 版本；本次未改动这些条目，未将该审计标为通过。

按项目要求，浏览器视觉与动效验证由用户执行：检查五档尺寸在实际页面的密度，快速连续切换 Tabs，拖动单值/范围/纵向滑块，使用键盘操作浮层与选择器，启用系统减弱动画，并检查窄屏和中文长文案。代理未启动浏览器验证。
