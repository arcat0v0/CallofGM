# Design record: CoGM — GM 模组管理（/gm/modules & /gm/module/$moduleId）

Status: shipped
Next step: none (ready for user review)
Last updated: 2026-11-22
Reviewers: own subagents (`define_subagent` isolated read-only) · critic inherit (strongest vision model) · brief writer inherit · spot check flash · why: 评审打分与参考简报需要最强视觉模型保证分数稳定；spot check 用轻量档 · changes: none
Screenshots: /usr/bin/chromium (v158) via headless CDP script (`scratch/shoot.ts`, DPR 1, dark color scheme, 1440×900 & 390×844) against isolated preview DB (`127.0.0.1:16633`)

## Brief
Product and audience: CoGM（支持 CoC 7e 与 D&D 5e 2024 等多规则的网页跑团工具）；GM 后台的模组目录（`/gm/modules`）及其子页面——模组详情与资源工作台（`/gm/module/$moduleId`，包含场景、人物、音乐、情报、模组设定与人物提交链接）。
Surfaces:
- `/gm/modules` (`apps/client/src/routes/gm/modules.tsx`)
- `/gm/module/$moduleId` (`apps/client/src/routes/gm/module.$moduleId.tsx`)
Emotional target: 导演备团工作台——高效、精密、素材触手可及（与新版 `/gm/characters` 一致的专业感）。
Aesthetic statement: A dark warm-olive director's campaign workbench for tabletop RPG Game Masters: calm tonal surfaces separated by crisp hairlines, disciplined chartreuse-sage reserved strictly for active selection and primary actions, widescreen visual staging, and read-first asset management with zero form clutter (note: global M3 pill buttons and navigation rail come from the app's shared design system).
Taste anchors:
- 同系统兄弟页 `/gm/characters`（`design/references/sibling-characters-{desktop,mobile}-top.png`）：左侧发丝线分面目录、安静的深暖橄榄色调层次（`#12140e`..`#33362e`）、克制的萌黄绿（`#b4d087`）仅用于选中态与主操作、画廊/台账双视图。
Risk dial: safe-sibling（严格复用全站 `apps/client/src/styles/theme.css` MD3 Expressive 深暖橄榄 token 与 `/gm/characters` 兄弟工作台语言，直接进入 `iterate` 模式迭代真实代码）。
Constraints:
- 直接在 React 19 + TanStack Router + Tailwind v4 + shadcn/ui 代码库落地，不修改 `theme.css` 色板或破坏全站 `Button` / 导航栏规范。
- 补齐并修通后端/前端缺失能力：规则隔离的人物关联、音频试听 + 网易云/QQ 平台曲目/歌单导入（`MusicSourcePanel`）、场景换图/排序/预览、情报配图展示与编辑、详情页修改模组主题（`themeId`），以及服务端目录接口 `ownerId` / `deletedAt` 过滤漏洞。
- 桌面端宽屏导演工作台优先，同时彻底修复移动端布局与触控可用性。
- 零硬编码规则 ID（使用 `useRuleOptions()` + `getRuleComponent()`），零硬编码中文（文案统一在 `apps/client/src/i18n/messages/zh-CN.ts`）。

## Reference brief
Inspiration set: `design/references/sibling-characters-desktop-top.png`, `design/references/sibling-characters-mobile-top.png`（本仓同体系已交付页）。
Brief: 采用与 `/gm/characters` 一致的暗暖橄榄发丝线工作室架构——左侧窄分面目录 + 顶部极简标题与搜索/排序/视图切换工具栏 + 读优先资源画布（卡片无遮挡视觉主区，操作统一收口至静默 `...` 菜单与弹窗编辑）。
Kept elements: MD3 Expressive 深暖橄榄表面色阶、3px 萌黄左边框选中条、分段视图切换、统一 40px 表单控件高度、无裸露 CRUD 表单。

## Seed
Mode: `iterate`（用户选择直接基于兄弟页语言在真实应用中做 2–4 轮隔离评审迭代，跳过多方向 HTML POC）。

## Directions considered
| # | Name | One line | Source (anchor / seed / terrible / collision) | Built? | Median score | Status (chosen / parked / rejected) | Why (the user's words) |
|---|------|----------|-------------------------------------------------|--------|--------------|--------------------------------------|------------------------|
| 1 | Sibling Director's Workbench | 与 `/gm/characters` 一致的深暖橄榄导演备团工作台，双视图模组目录 + 全宽页签式只读资源舞台 | anchor (`/gm/characters`) | yes (live app) | r1: 6 / 6 | chosen | 用户明确选择「导演备团工作台——与新版 `/gm/characters` 一致的专业感」及直接进入真实应用 `iterate` 迭代 |

## Chosen direction
Sibling Director's Workbench：
- `/gm/modules`：桌面端左分面目录（全部 / 规则 / 备团状态）+ 顶部统一工具栏（搜索、排序、画廊/台账切换）+ 3 列无遮挡 16:9 封面画廊 / 对齐台账；移动端顶栏抽屉释放 100% 宽度 + 快速筛选条 + 底部筛选抽屉。
- `/gm/module/$moduleId`：100% 宽屏顶置精简头部 + 左对齐横向下划线页签（场景 / 人物 / 音乐 / 情报 / 设置），全部资源遵循「读优先、点击即预览/编辑、操作统一收口 `...` 菜单与弹窗」，彻底消除常驻 CRUD 表单。

## Baseline
| Surface | Baseline (median) | Rules passed | Brief hash | Critic model | Date | Set by (round) |
|---------|-------------------|--------------|------------|--------------|------|----------------|
| `/gm/modules` (current) | 4 (4–5) | n/a | none | inherit | 2026-11-21 | r0 |
| `/gm/module/$moduleId` (current) | 4 (4–4) | n/a | none | inherit | 2026-11-21 | r0 |

## Critic rounds
| Round | Date | Screenshots | Median (spread) | Rules passed | Verdict | Top gaps | What changed after |
|-------|------|-------------|-----------------|--------------|---------|----------|--------------------|
| r0 (`/gm/modules`) | 2026-11-21 | design/shots/gm-modules/r0-* | 4 (4–5) [D:5 M:3] | n/a | RETHINK: structure ×3 | 2 列卡片过大且缺搜索/规则筛选/排序；4 个统计胶囊+未标注主题下拉+重复管理按钮+孤立时间占满页脚；内嵌封面+模糊底渐隐+死灰空封面；移动端第 3 行裁切露头、固定导航栏占 22% 宽 | 重构为左分面目录+3 列画廊/台账双视图；移动端改为顶栏+抽屉；修复服务端 `ownerId` 与 `deletedAt` 过滤 |
| r0 (`/gm/module/$moduleId`) | 2026-11-21 | design/shots/gm-module-detail/r0-* | 4 (4–4) [D:5 M:2] | n/a | RETHINK: structure ×3 | 左侧常驻设置卡占 26% 宽且下方大片空洞、移动端挤掉全部资源；所有资源是常驻输入框+禁用保存按钮的 CRUD 表单，桌面/移动均截断场景名；移动端页签溢出重叠表单；缺音乐试听/平台导入、人物规则过滤/立绘/分组、场景换图、情报配图展示、细节页主题设置 | 重构为全宽头部+5 页签工作台；接入规则过滤人物库弹窗、Howler 试听+平台曲目弹窗、场景换图/预览/排序、情报配图与弹窗编辑、独立设置页签 |
| r1 (`/gm/modules`) | 2026-11-22 | design/shots/gm-modules/r1-* | 6 (6–6) [D:7 M:6] | n/a | POLISH ×3 · INTENT strong ×3 | 侧栏多余标题导致分隔线阶梯错位+静态 `6` 泄漏强调绿、左导航缺右发丝线；封面悬浮圆钮遮挡 16:9 画面、无封面卡片偏亮且重复显示 `CoC 7e`、台账缩略图 8px 字糊成一团；零计数与辅助字对比度不足 AA；台账素材列未纵向对齐；移动端缺总数/快速筛选条/视图切换 | 计划 r2 全部收口：去除侧栏多余头部并齐平分隔线、移除悬浮按钮改入底栏、`红月钟楼` 下沉深底+发丝框、提升 AA 对比度、4 栏纵向对齐台账、移动端补总数+横向快速筛选与视图切换 |
| r1 (`/gm/module/$moduleId`) | 2026-11-22 | design/shots/gm-module-detail/r1-* | 6 (6–6) [D:6 M:7] | n/a | RETHINK: structure ×3 · INTENT partial ×3 | 音乐页签顶部常驻三字段上传表单+高亮上传按钮且压住 BGM/SE、图标用离题黄闪电/装饰绿圆盘、每行重复「本地上传」；人物卡立绘过小且重复「我创建的」+绿 PC 胶囊+裸露 `↗ ×`；情报两栏留白失衡+裸露 `✎ 🗑`；设置居中孤岛+缺年份；页签左缩进不齐、场景 `#04` 空框偏亮、左下角 `VersionBadge` 定位被 `[data-button]` 覆盖产生残影 | 计划 r2 结构重整：音乐页签 BGM/SE 置顶+底置极简本地上传条、人物升级竖构图肖像卡+统一 `...` 菜单、情报升级 3 列档案卡+统一 `...` 菜单、设置改左对齐双栏、修复页签左缘与 `VersionBadge` 定位残影 |
| r2 (`/gm/modules`) | 2026-11-22 | design/shots/gm-modules/r2-* | 7 (6–7) [D:7 M:6] | n/a | POLISH ×3 · INTENT strong ×3 | `红月钟楼` 内嵌虚线框像线框图上传区；工具栏方圆角搜索/下拉与 M3 胶囊按钮/分段器混搭；台账 `音乐` 右对齐数字紧贴 `主题` 且 `共 6 个模组` 三重重复计数；`md-outline` 小号次级数字/零计数在暗底偏暗；左侧栏选中绿条紧贴导航发丝线且与主标题重复 `全部模组`；移动端芯片缺 `已有素材`、缺分组分隔线且高度约 32px | 计划 r3 精修冲刺 8+：全铺深橄榄无虚线封面底板、工具栏统一全圆角胶囊几何、台账拉宽 `音乐`/`主题` 间距并用 `—` 替代淡 `0`+列头排序指示+去冗余页脚、提升小字次级对比度至 AA+、左侧栏内缩圆角选中条、移动端补齐分组分隔与 `h-9` 芯片 |
| r2 (`/gm/module/$moduleId`) | 2026-11-22 | design/shots/gm-module-detail/r2-* | 6 (6–6) [D:6 M:7] | n/a | POLISH ×3 · INTENT partial ×3 | 情报页签图文卡与两张纯文本卡参差阶梯留白；音乐页签底部常驻虚线文件选择器与顶部 `↑ 上传音频` 重复；人物页签 4 列偏扁且每张重复 `25 分钟前`+`PC`/`NPC` 同色；设置页签右缘缺口 ~260px、实心红 `删除模组` 抢视觉焦点、`创建后不可更改` 误放在创建时间下；场景 `#04` 内嵌虚线导致 `#04` 徽标错位、`封面` 与 `#01` 无区分；`提交链接` 孤悬面包屑行 | 计划 r3 精修冲刺 8+：情报改等高档案卡（含 `#01` 编号与图文/文档标）；音乐移除底部表单条改为静默拖放+主按钮直触上传；人物升级 3 列 `h-28` 肖像卡+真实角色元信息+PC 轻萌黄区分；设置铺满全宽+描边低饱和红删除按钮+说明归位规则下；场景 `#04` 全铺深底齐平角标+`封面` 轻萌黄点缀；`提交链接` 齐平标题行、工具栏全圆角统一 |
| r3 (`/gm/modules`) | 2026-11-22 | design/shots/gm-modules/r3-* | 7 (7–7) [D:7 M:6] | n/a | POLISH ×3 · INTENT strong ×3 | 画廊卡片页脚重复暗色 `0 人物 · 0 情报 · 0 音乐` 噪声、难以一眼分辨备团进度；台账工具栏 `最近更新` 与列头 `更新 ↓` 重复、缩略图偏小且 `主题` 空列过宽；左侧栏 `全部模组` 缩进圆角条与下方对齐轴错开；移动端芯片右侧硬裁缺渐隐提示 | 计划 r4 终审冲刺：画廊仅展示非零素材数拉制备团对比、台账隐藏冗余排序下拉并放大 72×40 缩略图、左侧栏统一左齐轴线与 184px 窄轨、移动端芯片增高至 `h-10` 并加右缘渐隐遮罩、次级文字全面升至 `text-md-on-surface-variant`（AA+） |
| r3 (`/gm/module/$moduleId`) | 2026-11-22 | design/shots/gm-module-detail/r3-* | 6 (6–6) [D:6 M:7] | n/a | POLISH ×3 · INTENT strong ×2 / partial ×1 | 情报等高拉伸导致 `#02`/`#03` 纯文卡留出 ~250px 黑洞且 `编辑情报` 页脚重复；人物横条卡把立绘压缩至 84px 且右侧 60% 留白、`PC` 胶囊借用强调绿；音乐页签下方孤立一行格式限制说明且 `⚡` 图标偏泛化；移动端标题与 `提交链接` 挤在同一行存在长名碰撞风险；`提交链接` 次按钮漏绿、场景 `#04` 取景框缺左上角 | 计划 r4 终审冲刺：人物改 4 列 3:4 竖版肖像立绘卡（与 `/gm/characters` 同源、中性 PC/NPC 区分、无图卡统一对称取景框）；情报改紧凑内嵌 4:3 图文缩略图档案卡（自然齐高、零空洞、去冗余页脚）；音乐去孤立说明行+单色 `BGM`/`SE` 等宽标+序号 `01`/`02`+`Volume2` 图标；移动端 `提交链接` 归入顶部返回栏、次按钮全中性色、场景 `#04` 对称中心取景框 |
| r4 / Gate (`/gm/modules`) | 2026-11-22 | design/shots/gm-modules/r4-* | **7 (6–7)** [D:7 M:6] | n/a | POLISH ×3 · INTENT strong ×3 | 终审门禁通过（较基线 4/10 提升 +3，分差 1 ≤ 2，零结构返工）；剩余可选项：桌面侧栏与工具栏横线跨栏对齐、台账空 `主题` 列移位至 `规则` 旁、移动端筛选条简化 | 已定稿交付 |
| r4 / Gate (`/gm/module/$moduleId`) | 2026-11-22 | design/shots/gm-module-detail/r4-* | **7 (7–7)** [D:7 M:7] | n/a | POLISH ×3 · INTENT strong ×3 | 终审门禁全员一致通过（较基线 4/10 提升 +3，分差 0 ≤ 2，全员 `INTENT MATCH: strong`）；剩余可选项：人物空槽卡去重副标题并支持直达添加立绘、音乐 BGM/SE 差异化交互态、非视觉页签最大宽度收敛 | 已定稿交付 |

## Delivery checks (Step 6)
- **Subtraction pass**: 移除侧栏冗余标题块、移除 16:9 封面悬浮黑圆钮、移除桌面场景栏提示句、移除台账重复计数页脚、移除音乐有曲目时的常驻上传表单与孤立格式说明行、移除情报卡片冗余「编辑情报」页脚、移除人物工具栏重复「提交链接」按钮、移除 4× 重复的「我创建的」「本地上传」「25 分钟前」与画廊零计数噪声。
- **Key states captured**:
  - 正常填充态（画廊 / 台账 / 5 页签 / 桌面 + 移动）：`design/shots/gm-modules/r4-*`、`design/shots/gm-module-detail/r4-*`
  - 空封面态：`红月钟楼`（画廊 16:9 取景框底板与台账 16:9 缩略底板）
  - 空场景背景态：`#04 礁石洞窟祭坛`（对称取景框 + 一键添加背景图）
  - 空人物立绘态：`女房东 玛格丽特`（3:4 对称取景框单字底片）
  - 搜索无结果态：`design/shots/gm-modules/state-no-results-{desktop,mobile}-top.png`
- **Lighthouse Accessibility**: skipped (`lighthouse` CLI 未安装于当前环境，未伪造分数；已对全部次级文本、占位提示、表头与状态文案统一抬升至 `text-md-on-surface-variant` / AA+，并保障移动端按钮与页签触控热区)。

## Media
Image backend: none needed（项目内已有真实场景图与人物立绘资源）
Video: skipped: no video backend

## Technical gaps spotted during audit (status)
- [x] `GET /gm/modules/summaries` 与 `/:id/scenes`、`/:id/handouts`、`/scenes/:id`、`/handouts/:id` 已补齐 `ownerId` 隔离与 `isNull(*.deletedAt)` 过滤。
- [x] 模组详情页「人物」已改用 `/gm/characters/library?ruleId=...` 按当前模组规则隔离并支持搜索/类型筛选与立绘展示。
- [x] 模组详情页「音乐」已接入 Howler 试听与 `MusicSourcePanel` 网易云/QQ 平台曲目与歌单导入。
- [x] 模组详情页「情报」已支持渲染/预览/替换/移除 `imageAssetId` 配图；「场景」已支持换图/预览/排序/重命名。
- [x] 模组详情页「设置」已支持修改 `themeId`；列表与详情统一展示 `RuleComponent.shortName`。
- [x] `VersionBadge` 在 `AdminLayout` 下因 `expressive.css` `[data-button] { position: relative }` 覆盖 `fixed` 导致移出视口并露头于左下角——已改为桌面端居左导航栏底端居中、移动端置于页尾流式布局，彻底消除残影与卡片遮挡。

## 交付后修订

- 2026-11-22 `/gm/modules` 使用 28px 卡片圆角和 20px 内嵌封面圆角，台账和分面导航以表面色阶划分。两库桌面分面导航共用组件和断点宽度。独立截图快评与宽度验证见 `DESIGN-RECORD.md` 的交付后修订，截图见 `shots/gm-modules/spot-expressive-*`。
