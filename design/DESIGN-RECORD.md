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

## 交付后修订

- 2026-11-21 用户反馈“规则切换的逻辑不好，规则多了怎么办”：左栏堆叠的规则块与移动端分段控件均随规则数线性增长。改为 `LibraryRulePicker`——单个触发器（当前规则简称、全名、人数）+ 弹层；弹层按“有人物（按人数降序）/暂无人物（按名称）”分组，规则超过 6 套出现搜索框（匹配简称、全名、id，回车选第一项），方向键在选项间移动；桌面与移动端共用，移动端为单行形态。无 `?rule=` 时恢复上次使用的规则（localStorage `cogm.gmLibraryRule`）。截图：`shots/gm-characters/picker-*`；8 套规则的分组/搜索行为由 `apps/client/tests/library-rule-picker.test.tsx` 覆盖。未重跑评审轮。
- 2026-11-22 圆角与表面色阶调整。人物库和模组库共用二级导航外壳、分组和筛选项。Chromium 实测两页在 1024px 和 1440px 视口下分别为 176px 和 208px。人物台账保持 36px 行高，窄屏从详情顶部展示立绘。
- 独立截图快评（`scout` 默认模型）明确偏好新版。分面目录、台账与检视器更易区分，画廊保留三列。评审建议加深搜索框边界并补列表分隔线，本轮保留低对比表面以减少连续线条。截图见 `shots/gm-characters/spot-expressive-*` 和 `shots/gm-modules/spot-expressive-*`。

- 2026-11-22 人物台账调整为人物、模组、更新时间三列。类型与玩家归属紧贴姓名，表体用细分隔线，选中行用中性表面与短强调线。Chromium 使用两条搜索结果和 64 人名单，验证 390–1920px 布局、36px 桌面行高、键盘切换和滚动表头。截图见 `shots/gm-characters/spot-ledger-*`。
- 截图快评（`scout` 默认模型）略偏好三列版，认为姓名更易扫读。保留中性选中底色与强调线，PC/NPC 标记采用现有容器色。

---

# Design record: CoGM — GM 音乐管理（/gm/music）

Status: 已移植到工作区（未提交）；评审收尾，中位数 6（基线 4）
Next step: 用户验收；后续用 spot 模式检查改动；移动端导航壳另行处理
Last updated: 2026-11-21
Reviewers: critic opus（与 gm-characters 同配置）· spot check sonnet
Screenshots: design/shots/gm-music/（r0 = 现状基线；评审用的中性副本在 .critic/ 下，已 gitignore）

## Brief (gm-music)
Product and audience: CoGM 的 GM 后台音乐库；GM 备团时按模组管理 BGM（循环长曲）与 SE（一次性音效），来源有上传、网易云、QQ 音乐。
Surfaces: /gm/music（apps/client/src/routes/gm/music.tsx）；与之相邻：模组页的上传表单、开团工作台的声音面板（不在本次范围，但添加曲目的组件可复用）。
用户原话：“整个音乐相关的页面我也不满意，包括 UI/UX、布局、操作逻辑等等”。沿用前一轮的常驻指令：不再逐步确认，直接做到全部完成。
Emotional target（按产品与受众推导，未单独访谈）：像剧场调度员的提示单——精确、克制、一眼能找到、点一下就能听。
Risk dial: 3。约束：必须移植回现有 React 19 + shadcn/ui + Tailwind v4；token 只来自 theme.css；通用组件优先。

### 现状（r0）诊断
- 数据：曲目归属模组；API 已支持改类型（bgm/se）、平台来源、艺术家/专辑，页面一个都没用上。
- 逻辑：本页不能添加曲目（只有“去模组上传”跳转）；平台搜索与歌单导入只存在于开团工作台；无搜索/排序/筛选/批量；改名与删除是逐行图标；平台曲目被标成“上传 —”；没有试听进度与当前播放态。
- 布局：模组选择是整行大胶囊（随模组数线性增长，且是页面最重的元素）；BGM/SE 左右两卡，SE 常常只有两行；桌面下半屏空；移动端被全站 96px 导航栏挤压（全站壳层问题，非本页范围）。

## Baseline (gm-music)
| Surface | Baseline (median) | Spread | Critic model | Date | Set by |
|---|---|---|---|---|---|
| /gm/music (current) | 4 | 4-4-4（桌面 5 / 移动 3） | opus | 2026-11-21 | r0 |

三位评审一致的 gaps：①选择器压过内容；②行内无播放态/进度，无搜索排序；③删除/编辑红色图标逐行重复；④桌面空白、SE 卡空；⑤主 CTA 把人送走；⑥副标题解释系统、计数药丸、双色图标、空状态怯懦；⑦移动端被导航栏挤（壳层）。KEEP：克制的暗色鼠尾草绿单一强调色；BGM/SE 的区分概念；导航栏激活态。
截图工具注意：主表面在内部容器里滚动，fullPage 截图不会展开——后续轮次需要展开内部滚动容器再截。

## Seed (gm-music)
Rolls：era 7 speculative future · material 1 metal, machined · color 0 monochrome plus one accent · type 6 blackletter/unusual revival · layout 7 map or spatial canvas · motion 2 organic and slow · imagery 0 photography · density 1 airy editorial · wildcard 2 everything is a list。Neighbors：type→handwritten/stencil；layout→table/ledger/document。
取舍：blackletter 对中文 UI 不成立（CJK 没有对应字形），保留“单色＋一个强调色”“万物皆列表”“机加工的雕刻线”，丢弃“空间画布”“摄影”（管理页的真实内容是曲目，不是图）。

## Directions considered (gm-music)
1 提示单 · 2 调音台 · 3 唱片箱 · 4 馆藏目录 · 5 机架 · 6 波形片段 · 7 目录页 · 8 终端 ls -l · 9 听音室 · 10 磁带书脊 · 11 广播节目单 · 12 文件管理器＋底部播放条（对照组） · 13 星图（听起来行不通） · 14 发车时刻表翻页板（听起来行不通）
PoC：1 与 2。其余原因：3/10 偏拟物，易“戴戏服”；4/7/11 是 1 的变体；5 装饰大于功能；6 的波形需真实解码，只在试听行做；8 键盘优先作为 1 的增强吸收（空格试听、/ 搜索）；9 列表退居次要，与管理页职责冲突；12 作为对照，不单独做；13/14 见下表。

### Rejected prompts (gm-music)
| Idea | Build prompt | Model/date | Result |
|---|---|---|---|
| 星图 | “曲库是一张星图：每个模组是一个星座，曲目是星，亮度=时长，连线=同一模组；正在试听的星脉冲发光；点星试听，框选批量。深蓝黑底，小型大写标签，单一强调色。” | claude-sonnet-5-5 · 2026-11-21 | 未建（上百首曲目时无法按名称扫读，违背管理页职责） |
| 发车时刻表 | “曲库是一块翻页板：每首曲目一行班次，曲名逐字翻动，时长是‘到站时间’，正在试听的行高亮闪动。” | claude-sonnet-5-5 · 2026-11-21 | 未建 |

### 逻辑缺陷（实测，随本次移植一并修）
- 删除曲目无效：`DELETE /gm/modules/tracks/:id` 返回 200 但只写了 `deletedAt`，`listTracksByModuleId`、`findTrackById`、模组列表的 `trackCount`、`drizzle-music-track-access-repository`（流代理）都没有过滤软删除，列表刷新后曲目还在。已用演示库复现：删除前后列表相同。
- 现页把所有曲目标成“上传”（含网易云/QQ），平台曲目显示“上传 —”。

## PoC 评审（gm-music，critic opus ×3 / 方向）
| 方向 | 截图 | 中位数 | 分布 | 结论 | 主要 gaps |
|---|---|---|---|---|---|
| 1 提示单 | shots/gm-music/poc-a-* | 5 | 6/5/5（桌面 6 / 移动 5·4·5） | POLISH | 台账感只在文案与编号；全是胶囊控件像消费类 App；悬浮圆角播放卡与行内读数重复；移动端播放条文字折行、丢掉编号与类型；来源列重复且中间 570px 空白；空状态是通用虚线框；左边缘对不齐 |
| 2 调音台 | shots/gm-music/poc-b-* | 5 | 5/5/5（桌面 6 / 移动 5） | POLISH | 强调色没有只留给“正在发声”（CTA、选中条、计数都是 sage）；通道条是带 8px 间隙的卡片，左 50px、中 350px 死区；静态 LED 条像骨架屏；SE 垫只有两块像存根卡；移动端播放条折行、丢掉 LED |

### 方向取舍（gm-music）
两者中位数打平（5）。选 **提示单** 为底：可撑到上百首（台账行 vs 随数量变散的音效垫），且“点编号即播、行内进度线”是两边评审都点名保留的最好点子。吸收调音台的：分段标尺（`BGM ── 循环 · 一次只放一首` / `SE ── 点一下播一次`），因此逐行类型徽标取消；强调色只留给“正在发声”与唯一主操作，模组选中改中性条。
两边评审一致、必改：①试听条改为贴边通栏（无圆角卡、顶部发丝线），与行内读数不重复（行内只留已播时间+进度线，条里才有 `02:14 / 05:12`）；②取消“来源”列，来源并入副行（`艺术家 · 专辑 · 网易云`；上传只写“上传”，去掉文件大小与时间）；③移动端播放条两行、进度发丝线、保留编号；④所有左边缘对齐同一内容边；⑤空状态画出“空的提示单”（表头 + 虚影行 + 三个添加动作），不用虚线盒；⑥头部去掉“提示单”眉标，统计用等宽数字，空模组不显示 0；⑦桌面静止态就看得出可播（常驻播放键），行菜单常驻低对比而非仅悬停；⑧触控目标 ≥44px。
评审建议“所有控件改 4–6px 小圆角”：属全站设计系统（MD3 胶囊按钮/输入框）的决定，不在本页范围内改；本页的台账行、试听条、徽标按“方角/发丝线”处理。

## Critic rounds (gm-music，原型 music-cuesheet)
| Round | Date | Screenshots | Median (spread) | Verdict | Top gaps | Changes next |
|---|---|---|---|---|---|---|
| r0 | 2026-11-21 | shots/gm-music/r0-* | 4 (4-4-4) | RETHINK: structure ×3 | 选择器压过内容；无播放态/搜索；红色删除逐行；桌面空白 | 进入方向探索 |
| r1 | 2026-11-21 | shots/gm-music/r1-* | 6 (6-6-6；桌面 7/6/7，移动 5/5/6) | POLISH ×3 | 空状态像骨架屏；筛选分段高亮用了 sage；计数重复 4 处；每行 36px 描边圆圈太响；移动端标题被截成 9 字；全部视图的“模组”列重复且远离标题；试听条与台账列不对齐；“上传”副行是噪音；头部在视图间跳动 | 空的提示单（分段标尺+空行）；筛选分段改中性；计数只留分段标尺与侧栏；播放键静止态无描边；移动端时长并入副行；去掉列头行与模组列（模组名并入副行）；试听条对齐台账列、时间去斜杠；上传行不写副行；锁定头部高度 |
| r2 | 2026-11-21 | shots/gm-music/r2-* | 6 (6-6-6；桌面 6/7/6，移动 6/6/6) | POLISH ×3 | 行还是播放列表而非台账：单行也 56px、中间 600–800px 空白、副行“上传”是填充；桌面静止态播放键只有 8px 三角无命中区；空状态仍重复入口（顶栏添加 + 三个胶囊）、说明排在虚影表下面、移动端写“拖到这里”；头部在视图间跳动 7px；全部曲目视图连续编号 01–16 且模组名逐行重复；移动端丢了右对齐时长列；右缘不对齐 | 见下 |

### r2 → 移植时一并落实（不再单做 r3 原型）
- 行：单行 44px；播放键 28px 圆形命中区（静止 40% 描边，悬停全显，发声时实心 sage 同直径）；整行标题区也可点击试听；平台曲目的“艺术家 · 专辑”放在中间列、上传曲目该列留空（不写“上传”）；来源只对平台曲目写；行菜单常驻低对比（悬停/聚焦全显）。
- 全部曲目：每幕内按模组分组，组头为等宽小标尺 `雾港疑案 · 5`，编号按组重置，行内不再写模组名。
- 空状态：幕标尺 + 两行 `--:--` 虚影行（同样的实线、方角），说明与唯一入口文案放在虚影表上方；顶栏的“添加曲目”是唯一入口，不再有三个胶囊；移动端文案不写“拖”。
- 头部高度锁定：全部曲目视图保留“添加曲目”占位；统计行用 tabular-nums 的无衬线（不再整行等宽）；侧栏计数用 tabular-nums；选中项只留一种标记。
- 移动端：时长保持右对齐的等宽列，副行仅在有平台信息时出现，类型分段铺满一行；试听条两行 + 顶部进度发丝线（保留）。
- 试听条：左侧空位写 `BGM 03` 之类的等宽幕号，与台账同列；顶部一条与幕标尺同权重的发丝线。
- 记录：前后两轮评审对“来源列”意见相反（r1 嫌重复、r2 要真正的列）；取舍——来源只在平台曲目上出现，作为中间列内容，不为上传曲目写占位。

## Ported app (gm-music)
- 页面 `apps/client/src/routes/gm/music.tsx`；业务组件 `apps/client/src/features/gm-music/`：`music-library-model.ts`（筛选/排序/分幕/统计/试听地址，纯函数）、`use-audition.ts`（单实例 Howl 试听）、`use-upload-queue.ts`（多文件上传队列）、`module-nav.tsx`（侧栏 + 移动端选择器）、`music-toolbar.tsx`（搜索/类型/排序/批量条）、`track-ledger.tsx` + `track-row.tsx`（提示单）、`audition-bar.tsx`、`add-tracks-dialog.tsx`（上传 + 复用开团工作台的 `MusicSourcePanel` 平台搜索/单曲/歌单）。
- 全站通用件优先：Button、SegmentedControl、Checkbox、Slider、DropdownMenu、Dialog、Tabs、ConfirmDialog、EmptyState、InputGroup、Popover；没有新增 CSS，全部 Tailwind + 语义 token。`uploadMediaAsset` 抽到 `lib/media-upload.ts`，模组页复用。
- 服务端：`GET /api/v1/gm/modules/tracks`（跨模组曲库，`GmTrackLibraryItemDto`）；修复软删除曲目仍出现在列表/计数/流代理里的缺陷（`drizzle-catalog-repository.ts`、`drizzle-music-track-access-repository.ts`）。
- 测试：`apps/client/tests/music-library-model.test.ts`（18）、`music-ledger.test.tsx`（13）、`music-page.test.tsx`（15，覆盖加载/切换/记忆模组/搜索筛选/全部曲目/删除/改名/改类型/批量/试听/平台流/上传队列/拖入）；服务端 `catalog.test.ts` 新增软删除回归与曲库列表。客户端全量 548 通过，服务端全量 465 通过，typecheck、check:boundaries、biome 均通过。
- 实现中发现并修复的缺陷：从行菜单进入“重命名”时，Radix 菜单的焦点管理让输入框立刻失焦并提交，改名模式一闪而过——改为菜单完全关闭后再进入改名（`onCloseAutoFocus`）。

## Lighthouse (gm-music)
- 桌面：Accessibility 100 · Best Practices 96；移动：Accessibility 98（修复前）→ 修复后同桌面。首轮 98 的两处问题已修：标题层级跳级（侧栏小标题与幕标尺改为 h1 → h2 结构）、两个按钮可访问名称与可见文字不一致（排序按钮、模组选择器）。
- Performance 为 dev server（未压缩）结果，桌面 40 / 移动 35，不具参考意义；按规则只报告不设门槛。
- 报告：`design/audits/gm-music/lighthouse-*.report.{json,html}`（已 gitignore）。
| gate (real app) | 2026-11-21 | shots/gm-music/p3-* | 6 (6-6-6；桌面 6/6/7，移动 5/5/6) | POLISH ×3 | 时间码不是等宽（行内时长/总时长/统计/侧栏计数用了比例字体）；数字列前 44px 空槽（给悬停复选框预留）破坏左缘；试听条不在台账列上、进度条只有 120px 且“BGM”出现两次；行内进度条在 0% 附近像渲染故障；移动端标题被截到 5–8 字；sage 外泄（取消链接、勾选框、批量删除实心红圆、分段高亮）；全部曲目分组顺序与侧栏不一致；幕标尺与行分隔线几乎同权重；移动端批量动作只有图标；空状态提示“添加曲目”但移动端按钮只有“+” | 见下 |

### gate 后修复（同一轮内完成，随后再评一次）
时间码与计数全部等宽；数字与复选框同一格互换（左缘成一条脊）；试听条改为 `幕 · 暂停 · 曲名 · 进度(拉满) · 音量 · 停止`；行内进度条画满整行底线（0% 也有轨道）；移动端时长并入副行、播放键去描边；来源用窄标签、艺术家先截断；取消/勾选/批量删除去 sage 与实心红；全部曲目分组按侧栏顺序，组头加发丝线；幕标尺 2px 全强度；移动端批量条带文字标签；“添加曲目”在移动端也显示文字。
说明：评审对“分段控件高亮是 sage”“滑块粗”的意见属全站设计系统，不改。截图脚本在选择态下点击串位（选择态会多渲染一个仅移动端可见的复选框），已修脚本；真实浏览器里桌面选择功能正常（已验证出现“已选 N 首”条并勾选）。

| final (real app, after fixes) | 2026-11-21 | shots/gm-music/p6-* | 6 (6-6-6；桌面 7/7/7，移动 6/6/6) | POLISH ×3 | 无列头行、艺术家列“浮”在行中间；全部曲目的模组分组仍偏弱、编号每组重置；移动端序号+播放键占 ~76px 致标题仍被截；试听条滑块较粗（全站 Slider）；分段控件/对话框页签高亮是 sage（全站）；空状态应让虚影行本身成为投放区；移动端命中区 36px | 停止（见下） |

## Stopping note (gm-music)
r1/r2/gate/final 四轮中位数都是 6（桌面最后一轮升到 7/7/7）。按规则“两轮没有整分提升即停”收尾，没有再开新一轮。基线 4 → 6：桌面 5 → 7，移动 3 → 6。继续提分需要动全站设计系统（分段控件高亮色、Slider 粗细、胶囊控件）或为移动端重做导航壳——超出本页范围。

## Remaining gaps (not fixed, with reason)
- 评审意见互相矛盾：r1 要求取消“来源列”与列头行（嫌重复/双线），r2 之后要求真正的列与列头行。保持“平台曲目才有说明列、无列头行”，避免为上传曲目写占位。
- 分段控件、对话框页签的 sage 高亮，Slider 的粗滑块与高拇指，胶囊按钮与输入框：全站设计系统（MD3 Expressive），不在本页改。
- 移动端 96px 全站导航栏占去四分之一宽度，是标题被截的最大原因；属于壳层，需单独处理（底部标签栏或抽屉）。
- 移动端命中区：播放键与菜单键是 36px（评审建议 44px）；行高已 56px，进一步放大需要牺牲标题宽度，未改。
- 空状态让虚影行本身成为投放区、列头行、每幕运行时：留待后续迭代（整页已是投放区，拖入时有虚线遮罩）。
- Lighthouse Performance 为 dev server 结果，未做生产构建的性能评估。

## States (gm-music)
- 已设计并截图：默认、试听中（行内进度线 + 贴边试听条）、空模组（空白提示单）、全部曲目（按模组分组）、添加对话框（上传 / 音乐平台）、多选（批量条）、模组选择器（移动）、无匹配结果、加载骨架。
- 未单独设计：加载失败（用 toast）、上传队列失败重试的细节视觉、平台歌单导入的进度（复用开团工作台面板）。

## Handoff (gm-music)
- 页面 `apps/client/src/routes/gm/music.tsx`；业务组件 `apps/client/src/features/gm-music/`；服务端 `GET /api/v1/gm/modules/tracks`、软删除修复、媒体 `Range` 支持；文档 `docs/product.md`（音乐库页）、`docs/architecture.md`（曲库列表、Range）。
- 原型与评审素材：`design/explorations/music-cuesheet*`、`music-console`、`_shared`；截图 `design/shots/gm-music/`（r0 基线、poc-a/b、r1、r2、p0–p6 真实页面；评审用副本在 `.critic/`，已忽略）。
- 未提交：工作区改动尚未 commit（用户未要求）。
