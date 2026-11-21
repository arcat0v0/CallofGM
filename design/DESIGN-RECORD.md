# Design record: CoGM — GM 人物管理（/gm/characters）

Status: shipped to working tree (uncommitted)
Next step: 用户验收；后续用 spot 模式检查改动
Last updated: 2026-11-21
Reviewers: own subagents (Claude Code Agent tool, general-purpose) · critic opus · brief writer n/a · spot check sonnet · why: opus 是当前可选最强视觉模型；spot check 用便宜档 · changes: none
Screenshots: playwright-core + /usr/bin/chromium（scratchpad 脚本，headless，DPR 1，dark color scheme）

## Brief
Product and audience: CoGM，CoC 7e 网页跑团工具；GM 后台的人物库，GM 备团/开团时管理 PC 与 NPC。
Surfaces: /gm/characters（apps/client/src/routes/gm/characters.tsx）
Emotional target: 专业的指挥台——高效、精确、信息密度高，GM 一眼掌握全部角色状态。
Taste anchors: 用户不满意点：“信息组织不好”“不美观”。未提供参考图。
Risk dial: 3（大胆但有清晰概念；保留全站 token 与组件体系）
Constraints: 必须移植回现有 React 19 + shadcn/ui + Tailwind v4 代码库；颜色等 token 只能来自 apps/client/src/styles/theme.css（MD3 Expressive，暗色，primary 萌黄 #b4d087）；规则相关数据必须经 RuleComponent 抽象获取（summaryMetrics / attributeEntries / skillEntries / sheetOverview）；桌面优先但移动端不能坏。

## Reference brief
Brief: none（用户未提供参考；以现有全站 token 为约束）

## Seed
String: NhG6xfYJQwwGGoExCcXJobsEILqBncV1uN2dTSitl6YAO57vyEWBS4b2B6HxAgDxkjlSe1yEIPfGzKIodqp1G9WGMVBWyyUb
Rolls: mid-century modern · textile and thread · monochrome plus one accent · grotesk · strict modular grid · glitchy and abrupt · collage · sparse · sound has a role
Neighbors: (1) material → stone/concrete; (2) era → speculative future, material → pixels/CRT

## Directions considered
| # | Name | One line | Source | Built? | Median score | Status | Why (the user's words) |
|---|------|----------|--------|--------|--------------|--------|------------------------|
| 1 | 台账即控制台 | 整页一张可排序高密度表 + 检视器 | anchor | merged into A | | shortlisted→merged | 用户勾选 |
| 2 | 乌尔姆仪表面板 | Braun 式刻度尺、半值/五分之一刻痕 | seed | merged into A | | shortlisted→merged | 用户勾选 |
| 3 | 混凝土控制室 | 粗野主义大块与超大数字 | neighbor 1 | no | | parked | 未选 |
| 4 | 磷光终端 | CRT 等宽、键盘优先 | neighbor 2 | no | | parked | 未选 |
| 5 | 主飞行显示器 | 纵向刻度带 | catalog | no | | parked | 未选 |
| 6 | 1969 任务控制中心 | 每个角色一个席位 | catalog | no | | parked | 未选 |
| 7 | 出发翻牌板 | 翻牌式名单 | terrible | no | | parked | 未选 |
| 8 | 卡片目录柜 | 索引卡抽屉 | catalog | no | | parked | 未选 |
| 9 | 打孔卡 | 属性值即孔位 | terrible | no | | parked | 未选 |
| 10 | 总谱 | 每个角色一行五线谱 | terrible | no | | parked | 未选 |
| 11 | 化验单 | 困难/极难列 = 参考区间，↑↓ 标记 | terrible | B | 7 (7-7) | shortlisted | 用户勾选 |
| 12 | 台账 × 仪表面板 | 台账名单 + 刻度面板检视器 | collision | A | 6 (6-6) | shortlisted | 用户勾选（推荐项） |
| 13 | 星图对比 | 雷达/星座图叠全员 | catalog | merged into A | | shortlisted→merged | 用户勾选 |
| 14 | 终端 × 台账 | 纯键盘等宽台账 | collision | no | | parked | 未选 |

User shortlist (2026-11-21): 12, 11, 1, 2, 13. 合并为两个原型：A = 12（吸收 1 的密度、2 的刻度、13 的星图），B = 11 化验单。

## Chosen direction
用户选择（2026-11-21）：“B 化验单 + A 的长处”。

# Direction: 化验单 × 台账
Concept: 每个角色读起来是一张化验报告——结果列旁边的“参考区间”就是困难(½)/极难(⅕)线，↑↓ 旗标标出相对名册的异常；名单是一张等高的样本台账。
Emotional target: 专业的指挥台——临床般精确、可扫读。
Taste anchors honored: 用户勾选 11 化验单，并要 A 的长处（台账密度、大号读数、形近/形远）。 | Avoids: 假条码/印章/医院品牌/纸纹；仪表盘卡片；雷达图（3 位评审点名）。
Risk level: 3–4
Palette: 全站暗色 token；旗标 ↑ #f0c11c（warning）、↓ #56d6f5（secondary），只用于字形与被标记的结果值；唯一强调色 #b4d087 用于选中与主操作。
Type: system sans 标签 + mono 所有数值/代码/样本号，tabular-nums；最小 11px。
Layout logic: 左 = 样本台账（52px 固定两行行），右 = 报告：表头网格 + FIG.1 立绘 + 结论行 + 一、一般项目（大号读数）/ 二、属性检验 / 三、技能检验（统一列轨：项目·代码·结果·旗标·困难·极难·名册差·范围条）+ 注 + 报告完。
Motion: 基本无；选中即翻页。
Signature moves: 1) 困难/极难作为参考区间列；2) 紧贴结果的 ↑↓ 旗标列 + 名单旗标；3) 文件式报告语法（编号分节、注、报告完）。
Never: 雷达图；同一数据画多遍；多个实心主按钮。

Aesthetic statement (given to every critic): "A dark-mode laboratory report system: the roster is a dense specimen ledger, and each character reads as a lab report whose reference-range columns are the Hard (½) and Extreme (⅕) thresholds, with ↑/↓ flags against the roster."

## Baseline
| Surface | Baseline (median) | Rules passed | Brief hash | Critic model | Date | Set by (round) |
|---------|-------------------|--------------|------------|--------------|------|----------------|
| /gm/characters (current) | 3 | n/a | none | opus | 2026-11-21 | r0 |

## Critic rounds
| Round | Date | Screenshots | Median (spread) | Rules passed | Verdict | Top gaps | What changed after |
|-------|------|-------------|-----------------|--------------|---------|----------|--------------------|
| r0 | 2026-11-21 | design/shots/gm-characters/r0-* | 3 (3-4) | n/a | RETHINK: structure ×3 | 名单无信息；详情下半屏空、技能只 8 项、无半值/五分之一；5 个圆角数值卡；副标题显示 coc7e；移动端被裁剪 | 进入方向探索 |
| poc-A | 2026-11-21 | design/shots/gm-characters/poca-* | 6 (6-6) | n/a | POLISH ×3 | 同一数据画三遍（星图+排位表+刻度条，专长重复技能）；雷达图是通用仪表盘套路；台账属性谱无标签不可横读；三段绿色无法区分；移动端看不到详情；无立绘的 × 像坏图 | — |
| poc-B | 2026-11-21 | design/shots/gm-characters/pocb-* | 7 (7-7) | n/a | POLISH ×3 | ↑↓ 标记在报告里太弱（需紧贴结果的旗标列）；范围条三段灰阶难分、均值刻线不可见；名单行 85–105px 不等高不够"一眼"；两个实心主按钮竞争；列网格松散；移动端看不到报告 | — |

## Media
Image backend: codex CLI（用户指定）· why: 用户提供；立绘是产品核心内容 · chosen: 2026-11-21
| File | Kind | Backend | Model | Prompt (verbatim) | Refs | Notes |
|------|------|---------|-------|-------------------|------|-------|
| portrait-{irene,thomas,li,margaret,osborne}.png | 角色立绘 3:4 | codex exec | codex default | 见 scratchpad codex-portraits 命令：1920s CoC painterly bust, cool key light upper-left, flat dark olive-charcoal bg #12140E, no text | none | 仅用于原型/截图演示，非产品资产 |


## Pivot (2026-11-21)
用户原话：“有点太过于coc风格了，这个项目是trpg项目，而不是专注于coc的。这个人物我希望能以模组为单位进行管理……可能整个页面逻辑也要重新优化一下”。追问后定为：
- “算了，改成以规则为单位来管理人物，同时也要考虑到如果有上百个人物时的处理逻辑”
- 列表纯通用（无规则数值）；规则数值只在详情里经规则插槽出现
- 重新探索视觉方向；B（化验单）与 A 作废为 parked（CoC 专属）
- PL 经审核加入模组的 PC：显示、只读、标明归属
技术发现：GET /gm/characters 在内存分页且返回 sheetJson；前端 fetchAllPages 全量拉取 → 上百人需新轻量列表接口（规则/类型/模组/归属/搜索/排序/游标）。GET /gm/modules/:id/characters 未校验模组归属（越权读取），移植时修复。
Round-2 seed: WxQceLUWhQIZaWOZbc0pfGJ3g3PWPpnclXw7qOhEC6Qpqs4GvcKj1dHC3LGSBoqRJ1VUCXx8kOLQ1ovbupuT0jl1vyNUjH21 → mid-century · light/neon · saturated clashing · display extreme · radial · cinematic · collage · airy · one typeface
Round-2 directions: 1 选角目录 · 2 邮件客户端三栏 · 3 档案检索台 · 4 名片架 · 5 片场通告单 · 6 演员表 · 7 霓虹选角夜(seed) · 8 胶片带 · 9 照片墙 · 10 命令面板(terrible) · 11 地铁线路图(terrible) · 12 胶片小样 · 13 三栏×选角目录(collision) · 14 检索台×名片架(collision)
User shortlist: 13, 2, 3 → C = 13+2 (design/briefs/direction-c-casting.md), D = 3 (design/briefs/direction-d-archive-desk.md); shared: design/briefs/build-context-v2.md; fixture: design/briefs/roster-fixture.json (134 人，布局测试数据)
Media: 追加 portrait-dnd-{ranger,cleric,wizard,rogue}.png（codex，同风格 D&D 版）

## Round 2 prototypes
| Round | Date | Screenshots | Median (spread) | Verdict | Top gaps |
|-------|------|-------------|-----------------|---------|----------|
| poc-C 三栏×选角目录 | 2026-11-21 | shots/gm-characters/pocc-* | 6 (6-6) | POLISH ×3 | 立绘墙 95% 是相同灰块；检视器立绘旁放 ID/“立绘已上传”等记账信息；移动详情挤压；列表列宽浪费 |
| poc-D 档案检索台 | 2026-11-21 | shots/gm-characters/pocd-* | 6 (6-6) | POLISH ×3 | “紧凑”不紧凑；默认滚动裁行；排序控件重复；移动端丢规则切换；抽屉泄露 ID |
用户授权由我决定（“直接干直到全部完成为止”）。决定：以 C 的规则/文件夹骨架为主，吸收 D 的表格精度；直接移植到 React，在真实页面上跑评审。
Critic conflict（用户优先）：6/6 位评审都建议在列表加入规则提供的“身份列”（职业/等级），与用户“列表纯通用”冲突，保持用户决定。

## Ported app rounds (real data: 134 人, 8 模组, 7 名玩家; codex 立绘)
| Round | Date | Screenshots | Median (spread) | Verdict | Top gaps | What changed after |
|-------|------|-------------|-----------------|---------|----------|--------------------|
| p-r1 | 2026-11-21 | shots/gm-characters/r3* | 6 (6-7) | POLISH ×3 | 选中行不在可视区；行高 49px 不够密；检视器立绘 470px 把名字/摘要挤出首屏；立绘墙占位不可区分；“我”噪声；移动副行丢类型/归属；数字基线漂移 | 36px 行、列表仅有立绘才显示缩略图；选中自动滚入视野；立绘封顶 320px；立绘墙改为卡内排版（类型标记+名字，PC/NPC 底色区分，有立绘时名字叠在底部）；新增“有立绘优先”排序；归属只显示玩家；移动副行“类型 · 模组/玩家”；计数改 sans tabular 并基线对齐；移动详情操作行不溢出 |

## Lighthouse
| Surface | Date | Perf | A11y | Best practices | SEO | Note |
|---------|------|------|------|----------------|-----|------|
| /gm/characters (vite dev) | 2026-11-21 | 38 | 100 | 96 | 83 | perf 为开发服务器未打包，仅供参考；报告 design/audits/gm-characters/ |
| p-r2 | 2026-11-21 | shots/gm-characters/r4* | 6 (6-6) | POLISH ×3 | 列表空缩略槽像缩进 bug（评审反转：要求恢复单字标识）；立绘墙占位卡不可区分；规则卡与文件夹选中态相同；表情条挤压摘要；移动工具栏过高；D&D 摘要把背景标成种族 | 单字标识恢复；立绘墙卡内排版；规则卡改为填充态；表情缩略图叠在立绘底部；移动端排序/视图移入筛选面板；D&D 种族/背景拆分 |
| p-r3 | 2026-11-21 | shots/gm-characters/r5* | 6 (6-6) | POLISH ×3 | 立绘墙无立绘卡仍占大块；强调色过多；规则卡过高；“默认”浮字；归属列浪费 | 无立绘人物收进“无立绘 · n”紧凑名牌分组；墙选中框只包卡片；去掉浮字；结果数仅在有筛选时显示；规则数字强调色；立绘对焦上移；摘要去掉规则名重复 |

Stopped because: 三轮中位数未涨满 1 分（6/6/6）→ 进入 gate。
Gate 1: 7 (6-7) on 2026-11-21 → 未达 9，按规则应用共识缺口（立绘墙统一网格、副行固定为“类型 · 模组 · 玩家”、称谓前缀降为次要色）后再跑一次。
Gate 2: 7 (7-7) on 2026-11-21 → 报告用户。两位评审 INTENT MATCH 升为 strong。
Critic config note: gate 起在评审说明中注明“导航栏与全局按钮形状来自全站设计系统”（多轮评审反复扣分于全站 pill 按钮，属设计系统层面决定，不在本页范围）。

## Remaining gaps (not fixed, with reason)
- 全站 pill 按钮/分段控件与 8px 输入框的圆角混用 → 属全站 MD3 设计系统（components/ui），需单独决策。
- D&D 职业/种族/背景值为英文（Wizard/Human/Acolyte）→ 来自 dnd5r 规则目录标签，未本地化，属规则数据层。
- 评审多次建议列表加规则“身份列”（职业/等级）→ 与用户“列表纯通用”冲突，保持用户决定。
- 无立绘人物在立绘墙的紧凑名牌在 4 列下模组名会被截断；列表视图是此类人物的主视图。
- 移动端 96px 全局导航栏占 25% 宽度 → 全局 shell（gm-admin.shell 主题插槽）无移动布局，建议单独改。

## States
| State | Screenshot | Notes |
|-------|------------|-------|
| Default (list) | shots/gm-characters/g2a-* | 默认选中首项 |
| Wall (portraits first) | shots/gm-characters/g2b-* | 有立绘 / 无立绘分组 |
| Mobile list / detail | g2d-mobile-top / g2c-mobile-top | |
| No results | shots/gm-characters/state-noresults-* | 清除搜索 / 清除筛选 |
| Loading | (骨架行，未截图) | |
| Error | (EmptyState + 重试，未截图) | |
| Empty rule | (EmptyState + 新建，未截图；当前数据两个规则都有人物) | |

## Handoff
Tokens: 全部来自 apps/client/src/styles/theme.css（md-surface* 分层、md-outline-variant 发丝线、accent 仅用于选中与主操作、md-scrim 仅用于立绘上的文字衬底）；无新增 token。
Signature moves: 1) 规则作为一级切换（library-sidebar.tsx LibraryRuleSwitch）；2) 带分面计数的筛选文件夹（LibraryFolders，计数来自服务端 facets）；3) 立绘主导的检视器（character-inspector.tsx），规则摘要只经 RuleComponent.sheetOverview/summaryMetrics。
Never "clean up": 列表里没有规则数值是产品决定；分面计数“按其余已选条件计算”是刻意的；玩家人物只读；GET /gm/characters/library 不返回 sheetJson 是性能约束。
Port notes: 页面 apps/client/src/routes/gm/characters.tsx；业务组件 apps/client/src/features/gm-characters/；服务端 ListCharacterLibraryUseCase / buildCharacterLibraryPage（use-cases.ts）与 listLibraryScope / gmHasReadAccess（drizzle-characters-repository.ts）。
