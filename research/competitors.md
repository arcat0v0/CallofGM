# 竞品功能调研：CCFOLIA（ココフォリア）与回声岛

调研日期：2026-10-31
调研对象：CCFOLIA（ccfolia.com，当日线上版本 1.37.6）、回声岛（跑团.cn / 跑团.com / echois.fun，当日前端版本 v3.2.4）
参照：本仓库 `docs/product.md`（CoGM v1 产品需求）

---

## 0. 调研方法与来源可信度

### 0.1 来源渠道

**CCFOLIA**：官方文档站提供 `llms.txt` / `llms-full.txt` 全文索引，本次调研直接读取官方全文（5005 行），逐条落到对应文档页 URL；价格与版本取自官网 `/plans` 与首页；骰点规则细节回到 BCDice 官方源码核对（因为 CCFOLIA 的骰点行为完全由 BCDice 定义）。

**回声岛**：官方没有成体系的公开手册，采用三条官方渠道交叉印证：

1. **官网/站内文案**：`https://跑团.cn/`（SPA，前端语言包 `https://echois.fun/assets/ggf76k2e.js` 内含全部界面文案与功能开关）；`https://go.echois.fun/`（官方多域名导航页）；`https://跑团.cn/about`、`/rule`（用户条款，生效日 2026-08-22）、`/privacy`。
2. **官方静态文档**：`https://跑团.cn/doc/rule-authoring.md`、`/doc/backpack-items.md`、`/doc/bagitem-text-format.md`、`/doc/external-creator-protocol.md`、`/doc/rulescript-ai-prompt.md`、`/doc/code-frame-ai-prompt.md`、`/doc/sandbox/1-basics.md`、`/doc/sandbox/4-variables.md`（站内入口为 `/docs?doc=...`）。
3. **官方视频**：B 站 BV1ix4D6rE4w《【回声岛】爆肝三年，我做了一个线上跑团平台！》（UP：摸鱼の七海，2026-08-26，简介明确 v3.0 结束公测正式上线，入口 跑团.cn，2 个分 P：宣传正片 165s + 实机演示 755s）；BV1Ay1dYnEG4《【回声岛】一个伟大的跑团平台诞生了！》（UP：枫梨糖，2024-10-06，52:05，含「手机端预览效果」分 P）。

### 0.2 标注约定

- 未加标注 = 有官方来源直接支持，URL 附在条目后。
- `[未证实]` = 只有玩家侧描述、界面文案的间接证据，或无法从官方渠道确认。
- `[推断]` = 由已确认事实推导（例如由「bcdice-js 版本升级」推导掷骰在前端执行），标注推导依据。

### 0.3 三条需要先纠正的常见误解

1. **`CCB` 不是 CoC 7e 命令**。`CCB` 属于 BCDice 的 **6 版**《クトゥルフ神話TRPG》（Cthulhu）骰点，规则是 c=5% / f=96% 的「5% 规则」；7 版《新クトゥルフ神話TRPG》（Cthulhu7th）只有 `CC`（1% 规则，fumble 随目标值在 96/100 间切换）。选错骰点 bot 会得到不同判定。（https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu7th.rb 、https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu.rb ）
2. **CCFOLIA 没有房间密码**。「ルームパスワード」在官方开发状态表里是 `draft`（仅构想），进入房间靠「邀请 URL / 房间 ID」，权益控制靠成员权限与「工事中モード」。（https://docs.ccfolia.com/information/development-status 、https://docs.ccfolia.com/setup/room-settings ）
3. **CCFOLIA 没有录像 / Replay**。官方只提供 HTML / JSON 聊天记录导出；「録画」「リプレイ」在两份官方文档全文与开发状态表中均无对应条目。回放/录像能力是回声岛的结构性优势。（https://docs.ccfolia.com/pl-tutorial/room-chat/chat-menu 、https://docs.ccfolia.com/update/v1.37 、https://docs.ccfolia.com/information/development-status ）

---

## 1. 房间创建与邀请（链接 / 密码 / 权限）

### 1.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 账号 | 创建房间必须登录；支持邮箱密码、X（Twitter）、Google；改邮箱/密码需重新认证 | https://docs.ccfolia.com/setup/settings |
| 游客入室 | 无账号可通过邀请 URL 或房间 ID 直接进房游玩（「ゲストモード」） | https://docs.ccfolia.com/tutorial/pl-rta |
| 建房 | 我的房间列表 → ＋ → 只填「房间名」+「骰点 bot」两项即可开房 | https://docs.ccfolia.com/setup/room-settings |
| 邀请方式 | ① 邀请 URL（一键复制）② 房间 ID（在首页输入框进入） | https://docs.ccfolia.com/setup/room-settings |
| 密码 | **无**（`draft` 状态，未实现） | https://docs.ccfolia.com/information/development-status |
| 入室门槛 | 「工事中モード」开启后，玩家及以下权限无法进房；GM 可先布场再放人 | https://docs.ccfolia.com/gm-only/room-option/room-settings |
| 成员权限 | ルームマスター / サブルームマスター / プレイヤー / 見学 / アクセス不可 五档；可设默认权限与逐个调整；可拉黑（アクセス不可）、从成员列表移除 | https://docs.ccfolia.com/update/v1.28/permissions-management 、https://docs.ccfolia.com/gm-only/room-option/room-settings/member-list |
| 副 GM | サブルームマスター 可用几乎全部 GM 功能（切场景、房间设置、建/删聊天标签页、GM 斜杠命令），但不能管成员权限、不能导出房间、不能应用扩展包；游客不能当副 GM | https://ccfolia.com/plans （权限说明弹窗）、https://docs.ccfolia.com/update/v1.28/permissions-management |
| 观战 | 「見学」权限：可看盘面与全部聊天，不可操作盘面/不可点击动作/不可发言 | https://ccfolia.com/plans |
| 踢人 | 成员列表三点菜单移除；被移除者失去自动进房资格 | https://docs.ccfolia.com/gm-only/room-option/room-settings/member-list |
| 房间容量 / 数量 | 官方 FAQ：房间数量当前无限制，未来可能调整 | https://docs.ccfolia.com/information/faq |
| 公开分发 | 「ルームデータ公開リンク」：任何人打开链接→登录→一键生成同配置的新房间（PRO）；可选择是否允许对方导出/复制 | https://docs.ccfolia.com/gm-only/room-option/room-settings/room-data 、https://docs.ccfolia.com/update/v1.37 |
| 房间复制 | PRO 可整房复制 | https://docs.ccfolia.com/gm-only/room-option/room-settings/room |
| 断线/离房 | 退出房间回我的房间列表；数据随账号保存 | https://docs.ccfolia.com/setup/room-settings |

### 1.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 账号 | 手机号注册（条款明确「需通过手机号码注册」，一号一账号）；也支持邮箱/密码（`user` 文案含邮箱注册与验证码） | https://跑团.cn/rule 、https://echois.fun/assets/ggf76k2e.js |
| 房间号 | **10 位字母或数字**；可粘贴 GM 给的房间链接自动识别；房间号与「预设游戏 ID」是两回事，误填会提示 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`join.*`） |
| 邀请方式 | ① 房间号 ② 房间链接 ③ 观众链接（`ob-link`，观众用） | [站内文案] 同上（`peer.ob-link`、`join.invalid-room-id`） |
| 入场审批 | **两条路径二选一**：房主提前设了房间密码→输密码直接进；未设密码→必须房主在线点同意（「选项1：等待房主在线同意」/「选项2：密码加入房间」） | [站内文案] 同上（`roomPassword.*`、`peer.waiting-kp-*`） |
| 房间密码 | 至少 4 位，可改、可停用；停用后所有人改为在线审批 | [站内文案] 同上（`roomPassword.passwordPlaceholder` 等） |
| 成员权限 | 房主 / 副房主（中级及以上可用）/ 玩家 / 观众；另有「助手」权限（可用任意角色身份发言、切资源，辅助演出） | [站内文案] 同上（`game.confirm-grant-helper`、`peer.helper-hint`、`subscribe.plan-medium-feature-3`） |
| 踢人 | 踢出并移出成员名单，取消自动进房资格；玩家角色与发言数据保留 | [站内文案] 同上（`game.confirm-kick`、`peer.room-size-tip`） |
| 观战 | 「以观众身份加入」，独立观众链接；观众不计入房间人数 | [站内文案] 同上（`game.ober`、`peer.room-size-tip`） |
| 一人多角 | 同一账号可在同一房间用多张角色卡多次加入 | [站内文案] 同上（`join.multi-pc-hint`） |
| 房间容量 | 受用户等级限制（`var-gm-players` 为变量占位，具体数值随等级动态下发）；房主/玩家各自有「同时活跃房间数」上限，超限需删除或结团旧房间 | [站内文案] 同上（`pl.enter-game-hint`、`bbs.max-room-hint`）、https://跑团.cn/rule |
| 房间状态 | 活跃 / 休眠（长期未启动自动休眠，不占配额；唤醒需房主确认）/ 结团归档 | [站内文案] 同上（`badge.sleep`、`bbs.confirmWakeUp`） |
| 招募 | 可开启「新团招募」，房间出现在首页「新团招募」，显示缺口人数，玩家可在评论区/私信联系 | [站内文案] 同上（`roomRecruiting.*`） |
| 预设游戏 | 「预设游戏（可复用剧本与配置）→ 房间（实际游玩）」两层结构；一个预设游戏可反复开多个房间；支持「覆盖式更新」把房间数据同步回预设游戏或反向同步 | [站内文案] 同上（`concept.gm-summary`、`rm.confirm6`、`bbs.overwriteRoom`） |
| 房间删除 | 删除房间会连带删除由其生成的排版记录与公开链接，不可恢复 | [站内文案] 同上（`rm.confirm3`） |

### 1.3 对照要点

- **密码**：回声岛有（密码或在线审批二选一）；CCFOLIA 没有，只有 URL 保密 + 权限 + 工事中模式。
- **游客**：CCFOLIA 允许无账号游玩；回声岛强制注册（手机号）。
- **复用**：两者都有「模板→实例」两层：CCFOLIA 是「房间数据 / 公开链接 / 房间复制（PRO）」，回声岛是「预设游戏→房间」且是核心概念。
- **人数与配额**：CCFOLIA 目前无房间数限制；回声岛用等级/付费控制房间数与房间内人数。

---

## 2. 地图与棋子（マップ / 駒）

### 2.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 盘面结构 | 「前景（グリッド线区域）」+「背景（整屏）」两层；前景可显示网格，可设格距；支持自动裁剪（保持比例裁切）而非拉伸 | https://docs.ccfolia.com/gm-tutorial/screen-setting 、https://docs.ccfolia.com/update/v1.28/trimming 、https://docs.ccfolia.com/update/v1.31/show_grid |
| 视角 | 每个客户端独立拖动/缩放盘面（滚轮、右下放大镜 ± 滑杆），互不影响 | https://docs.ccfolia.com/setup/show-screen |
| 棋子 | 角色即棋子：拖动移动，尺寸以「格」为单位设长边（1 格 = 24px，官方上限 30 格）；可设角度；可「しまう」收起，再「盤面に追加」回到原位 | https://docs.ccfolia.com/pl-tutorial/character-edit/basic 、https://docs.ccfolia.com/update/v1.31 |
| 层级 | 面板有「重なり優先度」数值控制前后（可设负值沉到前景之下）；角色以最近操作为准置顶 | https://docs.ccfolia.com/gm-tutorial/screen-panel |
| 布局模式 | 默认网格吸附；「自由配置モード」可像素级自由摆放（房间级开关，PRO 前后均可用） | https://docs.ccfolia.com/gm-only/room-option/room-settings/free-layout |
| 固定 | 面板/牌堆可「配置固定」「サイズ固定」，防止玩家误拖；「地形パネルとして扱う」可屏蔽快捷键操作 | https://docs.ccfolia.com/gm-tutorial/screen-panel |
| 多选 | v1.35：Shift 点选 / 框选，批量移动与删除 | https://docs.ccfolia.com/update/v1.35/multi-select |
| 撤销 | v1.31：Undo / Redo（Ctrl+Z / Ctrl+Y），盘面操作可回退 | https://docs.ccfolia.com/update/v1.31/undoredo |
| 桌牌/标记 | スクリーンパネル（跨场景常驻：房规、共享笔记、小地图）、マーカーパネル（仅当前场景：地图图标、战斗装饰），可加备注（悬停显示）、可设背面图 | https://docs.ccfolia.com/gm-tutorial/screen-panel 、https://docs.ccfolia.com/gm-tutorial/marker-panel |
| 上下翻面/私看 | 面板可「全体に公開」「自分だけ見る」「非公開にする」「自分以外に公開する」，私看时在背面显示操作者名字 | https://docs.ccfolia.com/pl-tutorial/panels/panels 、https://docs.ccfolia.com/update/v1.31/panel_publish_to_others |
| 点击动作 | 面板可设「クリックアクション」：点击即向当前聊天标签发送指定文本（可放骰点命令、`/scene`、`/pdf`），做成可点按钮 | https://docs.ccfolia.com/gm-tutorial/screen-panel |
| 骰子符号 | ダイスシンボル：D4/D6/D8/D10/D12/D20/D0，可改点数、可隐藏，隐藏/改点时向聊天发日志；v1.32 起可直接点掷 | https://docs.ccfolia.com/gm-tutorial/dice-symbol 、https://docs.ccfolia.com/update/v1.32 |
| 棋子复用 | 角色棋子可 Ctrl+C / Ctrl+V 跨房间复制（含属性与立绘配置） | https://docs.ccfolia.com/update/v1.31/character_copy |
| 地图能力边界 | 无迷雾、无动态光照、无测距工具、无 AOE 范围模板（官方开发状态表中也无对应条目） | https://docs.ccfolia.com/information/development-status |

### 2.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 舞台 | 房间由可自由增删/切分/悬浮的「面板」组成；「舞台面板」承载场景、立绘、遮罩；也可关掉舞台进入纯文字模式 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`layout.*`、`driver.use-scene-panel`） |
| 场景 | 场景 = 背景图 + 可选绑定的沙盒/遮罩/音乐/镜头动画；切场景即整套切换 | [站内文案] 同上（`lib.scene-bind-hint`、`scene-setting.res-*`） |
| 战斗地图 | 以「沙盒」形式提供：网格（方形/六边形）、迷雾（笔刷/擦除/透视）、动态光照（固定/跟随光源、火把闪烁）、测距（线段/圆形）、AOE 模板（圆/锥/线/矩形，可常显尺寸）、角色节点开启「棋子模式」后玩家可拖自己棋子 | [站内文案] 同上（`vtt.*`、`sandbox.battle-map-*`）、https://跑团.cn/doc/sandbox/1-basics.md |
| 层级与布局 | 节点层级（上移/下移/置顶/置底）、图层分组、锁定、隐藏、锚定到场景框（贴边/铺满/点击穿透）、自由画布、网格吸附 | https://跑团.cn/doc/sandbox/1-basics.md 、[站内文案] 同上（`sandbox.layer.*`、`sandbox.anchor.*`） |
| 3D 视差 | 上传一张场景图，用深度估计模型自动生成 3D 视差场景；低配设备可禁用 | [站内文案] 同上（`lib.create-3d-scene*`、`game-setting.disable-3d-scene`）、https://echois.fun/assets/g8aljg6b.js （`depthOnnxPath`） |
| 地图作为 UI | 地图/白板/计分板/时钟都是沙盒，可发布到社区、可被引用复用 | [站内文案] 同上（`sandbox.*`）、https://跑团.cn/doc/sandbox/7-sandbox-nodes.md |

### 2.3 对照要点

- CCFOLIA 的「地图」是**图片面板 + 网格**，够用但不动；回声岛的「地图」是**沙盒节点系统**，能做迷雾、光照、测距、AOE，代价是学习成本（需要理解节点/变量）。
- 棋子拖动与尺寸：两者都有；层级控制 CCFOLIA 是「面板优先级 + 最近操作置顶」，回声岛是显式图层。
- 回声岛有迷雾/光照/测距/AOE，CCFOLIA 完全没有（也未见路线图）。

---

## 3. 立绘与表情差分

### 3.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 图像 | JPG/PNG/GIF/APNG；一次可多张上传；ROOM / ALL / Unsplash 三个来源页签；ALL 页签可跨房间复用 | https://docs.ccfolia.com/pl-tutorial/character-edit/basic |
| 表情差分 | 角色可挂多张「立ち絵・差分」，每张设**标签**；编辑页勾选即切换；勾选同时决定盘面显示 | https://docs.ccfolia.com/pl-tutorial/character-edit/character-icon |
| 聊天内切差分 | 聊天栏选中角色后，发送差分标签即切换；标签只切图不发言（`@标签` 单独发送时聊天栏无输出） | 同上 |
| 与骰点联动 | 差分按「聊天末尾文本」匹配，可把 `成功` / `失敗` / `致命的失敗` 设成标签，骰点结束自动换表情 | 同上 |
| 标签优先级 | 多个标签同时命中取**最长**者（`致命的失敗` 优先于 `失敗`） | 同上 |
| 说话不显示立绘 | 角色可设「発言時キャラクターを表示しない」，消息窗不显示头像 | https://docs.ccfolia.com/pl-tutorial/character-edit/visibility-setting |
| 立绘形态 | 盘面上就是棋子：放大棋子=大立绘；无「大/小/头像」三态，也无立绘入场动画 | https://docs.ccfolia.com/pl-tutorial/character-edit/basic |
| 表情与状态耦合 | 无 HP/SAN 驱动的表情自动切换（只能靠骰点结果文本匹配） | https://docs.ccfolia.com/pl-tutorial/character-edit/character-icon |

### 3.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 三态立绘 | 头像 / 小立绘 / 大立绘，三种模式各自独立的位置、缩放、翻转；可「应用到全部差分」「应用到全部角色」 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`npc.img-mode-*`、`npc.pos-*`） |
| 差分 | 每角色多差分（数量受用户等级限制）；差分可设出场动画、可锁定左右排布顺序、可起假名 | [站内文案] 同上（`npc.anim-settings*`、`npc.fix-idx*`、`game.npc-fakename-help`） |
| 批量差分上传 | 「上传表情差分」：一次最多 50 张同构图，自动检测并合并脸部差异区，可调检测强度/覆盖率，支持手动框选 | [站内文案] 同上（`lib.add-diff-img*`、`lib-diffImg.*`） |
| 发言指定差分 | `%角色名%差分名%台词` 三段语法带表情发言，发言同时唤起立绘 | [站内文案] 同上（`tutorial.111`） |
| 立绘唤起/关闭 | `/art` 指令开/关立绘；每频道可设「最大立绘数量」 | [站内文案] 同上（`cmd.art.*`、`ch.max-npc-num`） |
| 悬浮边框 | 小立绘模式下可加边框并悬浮于画面上层（适配非透明背景立绘） | [站内文案] 同上（`npc.border-mode*`） |
| 入场动画 | 差分可配动画（呼吸/漂浮/震动/失焦等，可多段叠加、可设强度与循环） | [站内文案] 同上（`animation.*`、`npc.anim-settings`） |
| 朗读 | 角色可绑音色（预设 700+ / 自建音色 / 多情绪），发言时 TTS 朗读；剧场/Replay 也可朗读 | [站内文案] 同上（`tts.*`、`subscribe.plan-premium-feature-1`） |

### 3.3 对照要点

- CCFOLIA 的差分切换**完全靠聊天文本后缀**，实现简单、玩家零学习成本，但只能「按标签切」；回声岛是显式角色状态 + 语法 + 动画 + 三态尺寸，演出表现力明显更强。
- CoGM 规划里的「立绘多张对应表情/状态 + 放行时同步表情」与回声岛思路同源；CCFOLIA 的「骰点结果自动切差分」是低成本高收益技巧。

---

## 4. 角色卡管理与聊天面板（chat palette）

### 4.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 角色数据 | 图像、名字、イニシアティブ、角色备注（悬停显示）、棋子尺寸、参照 URL（可放外部角色卡链接） | https://docs.ccfolia.com/pl-tutorial/character-edit/basic |
| ステータス | 可变数值，带当前值/最大值，最多 8 项显示在左侧角色一览；低于上限 80% 时数字变红 | https://docs.ccfolia.com/pl-tutorial/character-edit/status-setting |
| パラメータ | 近似不变值，可写文字（如 POW/CON/APP），不进一览 | 同上 |
| 改值方式 | 一览上下按钮 ±1、拖动白色进度条、编辑页直接改、命令 `:HP-10` / `:侵蚀率+12` / `:幸运=999`（`:initiative` 改先攻，v1.29） | 同上、https://docs.ccfolia.com/update/v1.29 |
| 变量引用 | `{HP}`、`{SAN}` 在聊天/骰点命令里替换为当前值；查找优先级：房间变量 > ステータス > パラメータ | 同上、https://docs.ccfolia.com/gm-only/room-variable |
| 聊天面板 | 固定 3 个默认页签（メイン / 情報 / 雑談）+ 自建页签；每个页签独立消息流与未读红点；可拖拽排序（v1.36，仅自己可见） | https://docs.ccfolia.com/pl-tutorial/room-chat/chat-tab 、https://docs.ccfolia.com/update/v1.36 |
| chat palette | 角色卡内编辑，**换行即分条**；浮窗展示，可拖动；聊天框输入片段可模糊匹配补全（↑↓ 选择 + Enter） | https://docs.ccfolia.com/pl-tutorial/character-edit/chat-pallet |
| palette 扩展 | v1.34：棋子右键菜单、盘面角色一览均可直接调出该角色 palette 发送，并自动把发言角色切换过去；支持 `\n` 换行符 | https://docs.ccfolia.com/update/v1.34 、https://docs.ccfolia.com/update/v1.34/chatpalette |
| 快速骰按钮 | 输入框上方 D4/D6… 按钮点选拼表达式 | https://docs.ccfolia.com/pl-tutorial/room-chat/dice-roll |
| 导入 | 无官方角色卡 Excel/JSON 导入；靠第三方骰点 bot 生成 palette 文本粘贴；剪贴板 API 支持以 JSON 粘贴整只角色 | https://docs.ccfolia.com/developer-api/clipboard-api |
| 可见性 | 角色级开关：ステータス非公开（他人看不到数值与先攻，编辑页也锁）、发言不显示头像、不进盘面角色一览 | https://docs.ccfolia.com/pl-tutorial/character-edit/visibility-setting |
| 所有权 | 新建者为所有者；「自分のものにする」可夺取；所有者变化记录在角色上 | https://docs.ccfolia.com/pl-tutorial/character-edit |

### 4.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 角色卡 | 属性（数值/文本/公式派生/骰子表达式）、置顶与状态栏显示、颜色、排序、多选删除、属性导入、补充信息（Markdown）、标签筛选、可见性（默认仅 GM 与自己） | [站内文案] https://echois.fun/assets/ggf76k2e.js （`pl.*`、`attr.*`） |
| 派生属性 | 上限公式/取值公式（`floor((体质+体型)/10)`），支持循环引用检测、依赖深度上限、条件表达式 | [站内文案] 同上（`attr.formula-*`） |
| 状态栏 | HP/MP/SAN 等属性可置顶显示，带颜色与进度；80% 以下变红（与 CCFOLIA 同思路） | [站内文案] 同上（`pl.showInStatusBar`、`npc`/`game-setting` 文案） |
| 快速骰 | 角色卡内自定义掷骰表达式（武器伤害等），聊天框可选「快速骰」 | [站内文案] 同上（`pl.quick-dice-desc`） |
| 车卡模板 | 站内车卡模板（内嵌 HTML / 外部 URL 两种创建器），支持数据文件（技能表 JSON）、数据源、分步表单、审卡链接、审核状态、AI 提示词生成 | https://跑团.cn/doc/external-creator-protocol.md 、[站内文案] 同上（`charTemplate.*`） |
| 审卡 | 模板创建的角色有「未审核/待审核/已通过/已拒绝」，可复制审卡链接给 GM；GM 可在创建器中查看只读快照 | [站内文案] 同上（`charTemplate.status-*`、`charTemplate.review-*`） |
| 属性导入 | `.st 侦查60` 批量导入/修改；支持从「自动角色卡 Excel」粘贴 `.st` 开头文本；COC7 重复技能名过滤开关 | [站内文案] 同上（`game.attr-str-help`、`game-setting.merge-coc7-props`） |
| 公开 NPC 库 | 可把常用怪物/NPC 整卡提交到公开库，所有使用同规则的人可一键加进房间 | [站内文案] 同上（`charCard.lib-*`、`npc.submit-to-lib*`） |
| 角色改名限制 | 开团后角色名不可改（关系消息归属与 Replay）；可用「假名」改对外显示 | [站内文案] 同上（`pl.name-locked-ingame`、`game.npc-fakename-help`） |
| 聊天面板 | 输入区带命令补全（属性/差分/频道/技能/角色/规则表）、Markdown 模式、表情包、输入历史（10 条）、消息搜索、多选、拖拽排序、朗读开关、跑团总结 | [站内文案] 同上（`chat.*`、`msgEdit.*`） |

### 4.3 对照要点

- CCFOLIA 的 chat palette 是**纯文本命令收藏夹**，胜在零门槛、可被第三方工具批量生成；回声岛是**结构化角色卡 + 指令系统 + 补全**，表达力强但依赖规则配置。
- 状态管理：CCFOLIA 是「自由 label + 数值」无规则语义；回声岛有派生公式与规则绑定（COC7 属性名硬编码）。
- 导入：CoGM 规划的 Excel 导入，两家都不是一等公民：CCFOLIA 无官方导入，回声岛靠 `.st` 文本/模板创建器。

---

## 5. 骰子系统

### 5.1 CCFOLIA：BCDice 全量

| 能力 | 细节 | 来源 |
|---|---|---|
| 引擎 | BCDice（日本事实标准），随前端分发 `bcdice-js`（v1.31 升级至 4.7.0 ≈ BCDice 3.14.0，v1.36.3 升至 3.17 相当） | https://docs.ccfolia.com/setup/room-settings 、https://docs.ccfolia.com/update/v1.31 、https://docs.ccfolia.com/update/v1.36 |
| 规则数量 | 创建房间时选「ダイスボット」，官方称 200 种以上 TRPG 系统；BCDice 官方系统表 100+ 条目 | https://docs.ccfolia.com/setup/room-settings 、https://bcdice.org/systems/ |
| 基本语法 | `XdY` 及四则运算、`2d20kh1` 类取高、B 骰/reroll/upper/tally/D66/choice/repeat/calc 等通用命令 | https://docs.bcdice.org/ |
| 判定 | `1d100<=50` 目标值判定，成功蓝/失败红 | https://docs.ccfolia.com/pl-tutorial/room-chat/dice-roll |
| 暗骰 | 前缀 `s`（`s1d100`），他人只见 `Secret dice 🎲`；可事后一键公开 | 同上 |
| 原创随机表 | v1.33 `/roll-table`，按 BCDice 原创表语法现场定义表并投掷 | https://docs.ccfolia.com/update/v1.33/roll-table |
| 骰点演出 | 默认在盘面掷 3D 骰；可切「旧ダイス演出」让骰子出现在消息窗上方；部分系统有专用 3D 骰模型；可按角色设骰子皮肤 | https://docs.ccfolia.com/gm-only/room-option/room-settings 、https://docs.ccfolia.com/update/v1.31 |
| 暗骰与权限 | 暗骰结果仅掷骰者可见；GM 可用監視者モード 看穿被隐藏的数值（不含暗骰内容） | https://docs.ccfolia.com/gm-only/room-option/room-settings/monitoring |
| 架构推断 | 引擎作为 JS 包在前端运行 → 掷骰在客户端本地完成，结果由客户端上报；不存在服务端权威掷骰 `[推断]`（依据：发布说明只提及 bcdice-js 版本升级，未出现服务端裁决相关描述） | https://docs.ccfolia.com/update/v1.31 |

### 5.2 CCFOLIA 的 CoC 7e 支持细节（BCDice `Cthulhu7th`）

| 能力 | 细节 | 来源 |
|---|---|---|
| 技能检定 | `CC(x)<=目标值`，x 为奖励/惩罚骰个数，可写 `CC1<=65`、`CC+1<=65`、`CC-1<=50`、`CC(2)<=50`；不写目标值也会出 1D100 | https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu7th.rb |
| 判定等级 | 自动输出：クリティカル / イクストリーム成功 / ハード成功 / レギュラー成功 / 成功 / 失敗 / ファンブル | 同上 |
| 大成功/大失败阈值 | 出目 1 = クリティカル；目标值 < 50 时 ≥96 为ファンブル，目标值 ≥ 50 时仅 100 为ファンブル | 同上 |
| 奖励/惩罚骰实现 | 多投十位骰，奖励取小、惩罚取大（`CC(2)` / `CC-2`） | 同上 |
| 难度指定 | 目标值后缀 `r`（レギュラー）/`h`（ハード）/`e`（イクストリーム）/`c`（クリティカル），如 `CC1<=60h` | 同上 |
| 组合判定 | `CBR(50,20)` 双目标同时判定 | 同上 |
| 自动武器 | `FAR(弹数,技能,故障值,奖惩骰,难度,每轮弹数)` 结算命中/贯穿/残弹（不结算伤害） | 同上 |
| 疯狂/恐惧相关表 | `BMR`（即时疯狂发作）、`BMS`（总结发作）、`PH`（恐惧症）、`MA`（躁狂）、`FCL`/`FCM`（施法失败表） | 同上 |
| SAN 检定 | **无专用命令**。官方文档的做法是把 SAN 当普通目标值：`CCB<={SAN}【SAN値チェック】`（注意此例用的是 6 版 `CCB`，7 版 bot 应写 `CC<={SAN}`）；**不会自动掷损失骰、不会自动扣 SAN** | https://docs.ccfolia.com/pl-tutorial/character-edit/status-setting |
| 成长判定 | **无**。BCDice 的 7 版/6 版 bot 均无成长命令，成长需玩家手动投 `1d100` 对比技能值并手改数值 | https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu7th.rb |
| 6 版命令（易混淆） | `CCB<=55`（c=5%/f=96%）、`CC<=80`（c=1%/f=100）、`RES(x-y)` 抵抗表、`CBRB` 组合、`CC(x)` 故障值 | https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu.rb |
| 对手/对抗 | 无对抗检定命令（`CBR` 是双目标同掷，不是双方对抗） | https://github.com/bcdice/bcdice/blob/master/lib/bcdice/game_system/Cthulhu7th.rb |

### 5.3 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 投骰 | `.r 1d100`、`.r 3d6+2`、`.r (1d6+1)*2`、`.r 武器伤害+db`（属性名/快速骰名代入）、`.r #3 1d6` 连投（≤10） | [站内文案] https://echois.fun/assets/ggf76k2e.js （`chat.ruleCmd.rollDoc`） |
| 取高/取低 | `2d20kh1` / `2d20kl1` / `4d6dl1` / `4d6k3` / `q` 取低 | 同上 |
| 奖励/惩罚骰 | `.r d100b1`（奖励 1）、`.r d100p2`（惩罚 2） | 同上 |
| 骰池系统 | `6d10a7`（成功线）、`10a10`（爆炸骰 + 成功线）、`5c10`（双重十字）、`6f`（命运骰） | 同上 |
| 暗骰 | `.rh 1d100`（结果仅自己与 GM 可见），检定也可 `.rah` | 同上 |
| 改属性 | `.st 侦查60` / `.st 侦查+10` / `.st hp-1d6`，一次多改 | 同上（`chat.ruleCmd.stDoc`） |
| COC7 技能检定 | `.ra 侦查`（读卡上技能值）、`.ra 侦查50`（临时目标值）、`.ra 力量+10`（表达式）、`.ra 侦查 b1` / `p1`（奖惩骰）、`.rah 侦查`（暗骰）；按规则书给出大成功/极难/困难/成功/失败/大失败 | [站内文案] 同上（`builtin:coc7:ra`） |
| COC7 理智检定 | `.sc 1/1d6`：对当前 SAN 掷 d100，成功扣「/」前、失败扣「/」后，**自动掷损失并写回 SAN**；大成功/大失败阈值可按房间参数调 | [站内文案] 同上（`builtin:coc7:sc`、`coc7` 规则参数） |
| COC7 成长检定 | `.en 侦查 [1d6]`：d100 高于技能值（或 >95）即成长，默认加 1d10（房间规则可改），**自动写回** | [站内文案] 同上（`builtin:coc7:en`） |
| COC7 对抗检定 | `.opposed 闪避 困难成功 23 60`：与对方已出成功等级比较（较高/同级/较低），供闪避、反击类物品调用 | [站内文案] 同上（`builtin:coc7:opposed`） |
| COC7 自动武器 | `.burst 冲锋枪 4发 第2组 困难 惩罚1`：自动按组数叠惩罚骰、超额惩罚转「难度升一级」，结算命中/贯穿 | [站内文案] 同上（`builtin:coc7:burst`） |
| COC7 先攻 | `.init` 取敏捷；开战时系统据此排序 | [站内文案] 同上（`builtin:coc7:init`） |
| 内置规则 | 7 套：COC 第七版 / 绿色三角洲 / 通用直接比较 / 检定值−技能值 / 技能值−检定值 / 检定值+技能值(DnD) / 狩魂者；每套带可调参数（大成功区间、标记、DC 档等） | [站内文案] 同上（`diceRule.*`、`ruleScript.rule-builtin-desc`） |
| DnD 系 | `.ra`、`.atk ... ac15`、`.conc 22`（专注）、`.init`（先攻）、优势 `2d20kh1` | [站内文案] 同上（`builtin:rollPlusSkill:*`） |
| 自定义指令 | RuleScript：QuickJS 沙盒内 JS，可定义命令名/参数/正则补全/检定结果展示/副作用（改属性、发消息、放音效）；带审核与冲突检测 | https://跑团.cn/doc/rulescript-ai-prompt.md 、[站内文案] 同上（`ruleScript.*`） |
| 规则表 | `/draw 规则 表名`、`/q` 查表（仅自己可见）、`echo-tables.json` 表索引、`/draw 数据源 变量名` | https://跑团.cn/doc/rule-authoring.md 、[站内文案] 同上（`cmd.draw.*`、`rule-table.*`） |
| 骰点表现 | 3D 骰子动画（可全局关闭）、按角色定制骰子皮肤（材质/图案） | [站内文案] 同上（`game-setting.3d-dice`、`npc.dice-style`） |

### 5.4 对照要点

- **规则广度**：CCFOLIA（BCDice 200+ 系统）远胜回声岛（7 内置 + 自定义脚本）。
- **CoC 7e 深度**：CCFOLIA 强在表（疯狂/恐惧/躁狂/施法失败）、自动武器、难度后缀；**弱在状态联动**（SAN 不自动扣、成长不自动、不能对卡发检定请求）。回声岛反过来：SAN/成长自动写回、对抗检定、按组惩罚骰、战斗排序，但没有疯狂表/恐惧症表。
- **权威性**：CCFOLIA 在前端掷骰 `[推断]`；回声岛的判定与写回由服务端指令系统完成 `[未证实：未找到架构说明]`。CoGM 规划的服务端权威掷骰在两家都难直接对标。

---

## 6. 聊天

### 6.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 标签页 | メイン / 情報 / 雑談 默认三个，不可删；可自建「全体公開」或「プライベート」标签；未读红点；可拖拽排序（只影响自己） | https://docs.ccfolia.com/gm-only/chattab-edit 、https://docs.ccfolia.com/update/v1.36 |
| 私聊 | 悬停他人发言→回复图标→生成秘匿标签，仅两人可见，标签名为对方玩家名 | https://docs.ccfolia.com/pl-tutorial/room-chat/chat-tab |
| 群聊 | v1.30：建标签时选「プライベート」并勾选成员（3 人以上）；仅登录用户可被加入；标签带锁图标 | https://docs.ccfolia.com/update/v1.30/groupchat |
| 秘匿的真实性 | 官方明示：秘匿不是严格隐藏，**房间主人可导出全日志看到内容**；不要在上面传真正敏感的信息 | https://docs.ccfolia.com/pl-tutorial/room-chat/chat-tab |
| 发言形式 | 选角色发言，显示角色名+角色色（可自定义颜色/色号）；消息窗（消息在下方以文字流形式逐字出现，可关） | https://docs.ccfolia.com/setup/show-screen |
| 消息编辑 | 自己的消息可编辑，末尾标 `[編集済]`；超过一定条数后旧消息不可编辑并逐步淘汰 | https://docs.ccfolia.com/pl-tutorial/room-chat 、https://docs.ccfolia.com/information/faq |
| 日志导出 | 「ログ出力」单标签 HTML、「全ログ出力」全部标签按时序合并 HTML（仅房间主人）；上限 1 万条 / PRO 10 万条（v1.37 起 PRO 无上限）；v1.37 新增带角色图的 HTML（zip）与 JSON 导出 | https://docs.ccfolia.com/pl-tutorial/room-chat/chat-menu 、https://docs.ccfolia.com/update/v1.37 、https://docs.ccfolia.com/developer-api/message-logs-json |
| 日志格式 | JSON 含 name/color/text/type(`text`\|`note`\|`system`)/extend.roll(结果、骰子数组、成败标记)/channel/时间戳/角色图引用 | https://docs.ccfolia.com/developer-api/message-logs-json |
| 场景文本 | シナリオテキスト：预存长文，一键发到当前标签（从列表发时以文本标题署名，从聊天框发时以当前角色署名）；聊天框模糊匹配可召回 | https://docs.ccfolia.com/gm-only/scenario-text |
| 聊天框便利 | 别窗显示（beta）、宽屏模式、聊天记录删除、输入建议 | https://docs.ccfolia.com/pl-tutorial/room-chat/chat-menu |
| 无 | 无消息撤回、无引用、无消息重排、无站内搜索、无收藏、无个人笔记 | https://docs.ccfolia.com/llms-full.txt （全文无对应条目） |

### 6.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 频道 | 每个频道有独立场景、音乐、立绘、聊天记录，相当于「多个舞台」；可设「不让谁看」、改名、限制立绘数、清空消息 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`ch.*`、`tutorial.101/108`） |
| 场内/场外 | 消息分「场内」「场外」，场外可作弹幕展示；场外带专属徽标 | [站内文案] 同上（`chat.ooc-badge`、`game-setting.show-danmaku`） |
| 私聊 | 发送对象可切「私聊」，仅指定人可见（`private-band=仅 {names} 可见`） | [站内文案] 同上（`chat.private*`） |
| 实况频道 | 记录玩家进入/离开时间，玩家只能看到自己在场期间的记录（仅守灯人可开） | [站内文案] 同上（`ch.live-mode*`、`subscribe.plan-premium-feature-5`） |
| 消息操作 | 编辑、撤回（显示「撤回了一条消息」）、引用、收藏（带标签与批注，可看他人共享）、拖拽排序、多选、跳转、搜索（按人/类型/文本） | [站内文案] 同上（`chat.*`、`msgEdit.*`、`bookmark.*`、`msgSearch.*`） |
| 富文本 | Markdown 模式（标题/表格/折叠块/视频/图表/PDF 阅读器/思维导图等）、表情包、彩色文字、内嵌投骰 | [站内文案] 同上（`md.*`、`comp-lib.*`） |
| 输入辅助 | 命令补全（属性/差分/频道/技能/角色/规则表）、输入历史 10 条、输入状态显示（可关） | [站内文案] 同上（`chat.popupTitle*`、`chat.history*`） |
| 跑团总结 | 统计每角色发言量/检定次数/成功率/大成功大失败/谁欧谁非，并按成功技能一键做成长检定 | [站内文案] 同上（`chat-report.*`、`btn.report`） |
| 日志 | 导出聊天记录、LogBook 排版（见 §14） | [站内文案] 同上（`export.*`、`logbook.*`） |

---

## 7. BGM / SE 同步播放与音量

### 7.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 双 BGM 槽 | BGM01 / BGM02 两路可同时播放（一路音乐、一路环境音） | https://docs.ccfolia.com/gm-tutorial/bgm-settings |
| 音量 | ① BGM 条的音量与静音**只影响本人**；② 单文件详细设置里的音量**影响所有人**；③ 可试听（只自己听） | 同上 |
| 循环 | 每文件可切循环开/关；切歌可关其它音乐 | 同上 |
| 交叉淡化 | 房间设置「BGMクロスフェード (Beta)」切歌平滑过渡 | https://docs.ccfolia.com/gm-only/room-option/room-settings |
| 文件管理 | 上传本地文件、外部 URL（限可外链服务）、最多 10 个页签、拖拽整理、批量删除/移动（v1.33） | https://docs.ccfolia.com/gm-tutorial/bgm-settings 、https://docs.ccfolia.com/update/v1.33 |
| 场景绑定 | 每个场景保存自己的 BGM；切场景可「无 BGM 反映」 | https://docs.ccfolia.com/gm-only/scene-setting |
| SE | 无独立 SE 通道；官方推荐用「カットイン + NOIMAGE 图片」实现一次性音效；v1.32 起 BGM 音量会作用于骰点 SE | https://docs.ccfolia.com/gm-only/cutin 、https://docs.ccfolia.com/update/v1.29 |
| 官方音源库 | SOUND MASTER 提供 50 万点以上高质量音源，可在工具内直接选用；退订后设置保留但音源不可播 | https://ccfolia.com/plans |
| 命令 | `/bgm URL [volume:0.5] [slot:bgm01\|bgm02] [loop:false]`、`/bgm-stop` | https://ccfolia.com/static/js/main.0f872b7d.js （前端实现） |
| 视频 | `/play URL` 角落小窗播放（YouTube 全员可用；云盘视频文件 PRO） | https://docs.ccfolia.com/update/v1.28 、https://ccfolia.com/static/js/main.0f872b7d.js |

### 7.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 多轨同时播放 | 可同时播放多个音频，状态栏显示「N 个音频正在播放」；每个音频独立音量（0~1，影响所有人） | [站内文案] https://echois.fun/assets/ggf76k2e.js （`bgm.*`） |
| 音乐/音效区分 | 音频可标「音乐」或「音效」；音效默认不循环、播完自动关闭 | [站内文案] 同上（`bgm.effect-only`、`bgm.toggle-loop*`） |
| 场景绑定 | 场景可绑定音乐（进入自动播）与音效（进入播一次）；解绑需房主权限；停止时若含场景绑定音会提示 | [站内文案] 同上（`bgm.bind-scenes-hint`、`scene.bind-hint`） |
| 个人音量 | 游戏设置里调 音乐音量 / 通知音量 / 朗读音量；静音时播放提示 | [站内文案] 同上（`game-setting.bgm-volume`、`bgm.noVolumeTip`） |
| 素材来源 | 本地上传；直链；网易云/耳聆网链接自动解析为直链 | [站内文案] 同上（`lib.add-from-link-desc-audio`、`mp3.*`） |
| 无 | 未提供 BGM 交叉淡化；未提供「全员同步进度」的显式保证 `[未证实]`（场景绑定 + 多端同时播放，进度对齐方式未在公开文档说明） | [站内文案] 同上 |

### 7.3 对照要点

- CoGM 规划的两通道（BGM 需全员进度同步 / SE 广播即播）与两家形态都不同：CCFOLIA 是两路 BGM + 无 SE 通道（用 cut-in 变通）；回声岛是「音频条目 + 音乐/音效标记 + 场景绑定」。
- 「玩家本地可静音、不影响他人」两家都有；CCFOLIA 还额外区分「文件级音量（影响所有人）」与「个人音量」——这个双轨设计值得抄。

---

## 8. 演出功能（カットイン / 效果音 / 遮罩 / 转场）

### 8.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| シーン | 场景 = 前景 + 背景 + BGM + マーカーパネル；可存标题与「切场景时自动发到主聊天」的文本；可覆盖保存；可只应用部分要素（无 BGM / 无文本）；可拖拽排序 | https://docs.ccfolia.com/gm-only/scene-setting |
| カットイン | 图片 + 音源 + 音量三件套；三种触发：列表播放、编辑页播放、聊天末尾写标题自动播放（秘匿标签不触发）；点任意处立即结束；配了音源则播完自动消失，否则常驻 | https://docs.ccfolia.com/gm-only/cutin |
| カットイン联动 | 标题设为「成功」等即可在骰点成功时自动播放；「大成功！」特效同理 | 同上 |
| 特效音 | 用 NOIMAGE + 音源做 SE | 同上 |
| 遮罩 | 无独立遮罩层；靠前景图、スクリーンパネル、カットイン 组合 | https://docs.ccfolia.com/llms-full.txt |
| 转场 | 无场景切换动画/转场文字（仅 BGM 交叉淡化 beta） | https://docs.ccfolia.com/gm-only/room-option/room-settings |
| 面板动画 | 无节点动画；仅「前景上显示网格」等静态能力 | https://docs.ccfolia.com/update/v1.31 |
| 剧本演出脚本 | 无内置脚本系统；v2.0 beta 的 Custom Scripts 仅能读消息并回消息（随机表、关键词查信息、自定义骰点），不含舞台控制 | https://docs.ccfolia.com/developer-api/scripts-2.0-v |

### 8.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 场景动画 | 呼吸缩放 / 缓慢缩放 / 缓慢上下左右平移 / 镜头晃动 / 震动 / 失焦；可自定义动画 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`scene-setting.ani-*`） |
| 转场 | 淡入淡出 / 数字故障 / 水墨光圈 / 推远拉近；可配「转场文字」（标题+副标题+音效） | [站内文案] 同上（`scene-transition.fx-*`、`lib.field-setting-scenes-ani*`） |
| 遮罩 | 独立遮罩层：图片/GIF/视频/沙盒；可设颜色混合（叠加/滤色/正片叠底等）、缩放模式、对齐位置、播放秒数、单次播放、是否盖在立绘之上、是否允许鼠标穿透、是否允许拖拽画布 | [站内文案] 同上（`scene.edit-layer-*`、`lib.mask-tip`） |
| 触发器 | 条件（消息关键词/正则、检定结果等级、属性阈值）× 动作（播放一次音效、播放瞬时遮罩），可设冷却、次数上限、频道范围、角色筛选、延迟 | [站内文案] 同上（`trigger.*`） |
| 沙盒 UI | 类 PPT 节点系统（文本/图片/按钮/角色/字幕/镜头/代码/规则表/视频/嵌套沙盒），可绑场景或作遮罩，可发社区并版本化管理 | https://跑团.cn/doc/sandbox/1-basics.md 、[站内文案] 同上（`sandbox.*`、`mdv3.name`） |
| 代码节点 | iframe 内 HTML/JS，通过 `window.EI` 读写沙盒变量、订阅数据、发消息；有超时/内存/消息配额限制 | https://跑团.cn/doc/code-frame-ai-prompt.md |
| 场景滤镜 | 滤镜与调色曲线（Keeper 权益），可做电影感调色 | [站内文案] 同上（`pay-desc.scene-fx`、`curve-editor.*`） |
| 视频播放 | 视频节点（YouTube / Bilibili）与 MP4 场景/遮罩（Keeper 可上传 MP4/GIF） | [站内文案] 同上（`sandbox.V3Video`、`subscribe.plan-premium-feature-2`） |

### 8.3 对照要点

- CCFOLIA 的演出是**轻量、零学习成本**（场景=一套图+曲，cut-in=一张图+一个音）；回声岛的演出是**重装备**（场景动画、转场、遮罩混合、触发器、沙盒 UI）。
- CoGM 的「强制 CG / 场景切换带转场 / 立绘表情演出」处在两者之间：不需要沙盒，但需要比 CCFOLIA 更强的转场与立绘控制。CCFOLIA 的「cut-in 由聊天文本触发」是极低成本实现「剧情指定特效」的范式。

---

## 9. 手帐 / 笔记 / 便签 / 情报

### 9.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 角色备注 | 角色メモ：悬停角色显示 | https://docs.ccfolia.com/pl-tutorial/character-edit/basic |
| 面板备注 | 面板设 memo，悬停显示（私密面板期间不显示） | https://docs.ccfolia.com/gm-tutorial/screen-panel |
| 共享笔记 | 用スクリーンパネル放「共享备忘 / 房规 / 小地图」——图片形式，非文本编辑器 | https://docs.ccfolia.com/gm-tutorial/marker-panel |
| GM 长文 | シナリオテキスト（见 §6） | https://docs.ccfolia.com/gm-only/scenario-text |
| 房间变量 | 16 个键值（label ≤16 字、值 ≤64 字），`{label}` 取用，`/var` 改 | https://docs.ccfolia.com/gm-only/room-variable |
| 个人笔记 | 无 | https://docs.ccfolia.com/llms-full.txt |
| 情报/线索发放 | 无专门「线索卡」系统；用屏幕面板翻面（全体公开/私看）模拟 | https://docs.ccfolia.com/pl-tutorial/panels/panels |

### 9.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 个人笔记 | 云同步 Markdown 笔记，可按玩家设可见性（`仅自己可见` / 指定人），无刷新生效规则明确 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`note.*`） |
| 消息收藏 | 收藏消息并可加标签、批注，可看他人共享的收藏 | [站内文案] 同上（`bookmark.*`） |
| 线索（handout） | 素材库中的「线索」素材（图片+Markdown 文本+布局/字体设置），按频道解锁/上锁；玩家解锁后才能看到内容；可全局一键上锁 | [站内文案] 同上（`lib.desc-materials`、`lib.unlock-clues`、`sandbox.V3Ref.lock`） |
| 白板 | 沙盒形态的白板：玩家可添加文档节点、引用线索/消息（可开关），各自只能改自己创建的节点 | [站内文案] 同上（`sandbox.allow-player-notes*`、`sandbox.clue-board-title`） |
| 公开知识库 | 房间可关联公开帖子（所有人可见可编辑），用于规则/世界观/情报跨房间共享 | [站内文案] 同上（`game.knowledge-base*`） |
| 便签/贴纸 | 无独立便签系统，用沙盒文档节点代替 | [站内文案] 同上 |

### 9.3 对照要点

- 两家都没有 CoGM 规划的「秘密情报（仅指定 PC 可见、可追加对象、服务端权威可见性）」这一完整形态：
  - CCFOLIA 靠「私看面板 + 秘匿标签」，且官方自己声明秘匿不严格；
  - 回声岛线索有「按频道解锁」，但**频道是舞台级可见性，不是人级**；人级只能靠私聊。
- 回声岛的「个人笔记 + 消息收藏 + 白板」组合最接近 CoGM 的「情报面板 + 回看」。

---

## 10. 房间数据导入 / 导出

### 10.1 CCFOLIA

| 能力 | 细节 | 来源 |
|---|---|---|
| 导出 | ルームデータのエクスポート → ZIP（可选导出内容）；**不含音频文件** | https://docs.ccfolia.com/gm-only/room-option/room-settings/room-data |
| 导入 | ZIP 拖到盘面或走「ルームデータのインポート」；ZIP 从房间数据不能含其它文件、不能先解压 | 同上、https://docs.ccfolia.com/information/problems |
| 公开链接 | 生成「打开即建同配置新房」的链接（PRO）；可随时更新/删除公开数据；从公开链接建的房间默认禁止再导出/复制（v1.37 可显式放开） | https://docs.ccfolia.com/gm-only/room-option/room-settings/room-data 、https://docs.ccfolia.com/update/v1.37 |
| 整房复制 | PRO：复制房间（含所有配置） | https://docs.ccfolia.com/gm-only/room-option/room-settings/room |
| 存档 | セーブ/ロード：3 个槽位，保存盘面（含 BGM 与角色）；`/save`、`/load`；`/reset` 回到建房初态 | https://docs.ccfolia.com/gm-only/room-option/save-load |
| 聊天记录 | HTML（单标签/全标签）、JSON（含骰点细节与角色图 base64） | https://docs.ccfolia.com/update/v1.37 |
| 角色搬运 | 棋子 Ctrl+C/V 跨房间 | https://docs.ccfolia.com/update/v1.31 |

### 10.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 预设游戏导出 | 「导出 .echois 文件」；可导入预设游戏 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`btn.exportData`、`btn.uploadData`） |
| 覆盖式双向同步 | 房间→预设游戏（覆盖原始游戏）/ 预设游戏→房间（只覆盖场景、立绘、线索、沙盒、遮罩、触发器），用于反复开团与内容更新 | [站内文案] 同上（`rm.confirm5`、`rm.confirm6`） |
| 结团归档 | 归档为「文字 Log」或「交互式 Replay」；仅守灯人可存 Replay；归档后房间不可再进、不可逆 | [站内文案] 同上（`rm.confirm-replay`、`rm.confirm4`） |
| 聊天记录 | 导出聊天记录（文件名「聊天记录」） | [站内文案] 同上（`export.chat_log_filename`） |
| 排版导出 | LogBook：PDF（打印对话框另存）、长图/分页长图、分享链接、视频渲染（见 §14） | [站内文案] 同上（`logbook.exportPdf*`、`render.*`、`work.share-*`） |

---

## 11. 先攻表与战斗轮

### 11.1 CCFOLIA

- 只有**先攻排序**：角色属性 `イニシアティブ`（数值大者在前），左侧「盘面キャラクター一覧」按此排序；可用 `:initiative` 命令改。（https://docs.ccfolia.com/pl-tutorial/character-edit/basic 、https://docs.ccfolia.com/update/v1.29 ）
- 无回合数、无当前行动者高亮、无「轮到你了」提示、无战斗结束事件、无行动记录——这些需要 GM 口头维护。（官方文档全文无对应条目：https://docs.ccfolia.com/llms-full.txt ）

### 11.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| 先攻 | 开战时按先攻值排序（可重掷/按先攻重排/不排序手动拖）；支持拖动调序 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`combat.*`） |
| 回合 | 显示「第 N 轮」「{name} 的回合」，结束回合推进，可跳过、可指定当前回合；「轮到你了」只对本人提示 | [站内文案] 同上 |
| 回合事件 | 回合开始/结束时触发物品规则（自动反应/被动物品），失败可手动在背包处理 | [站内文案] 同上（`combat.event-*`） |
| 结束 | 广播「战斗结束 · 共 N 轮」，所有参与者收到事件 | [站内文案] 同上 |
| 上限 | 单场参战人数上限、每人只能在一个频道的战斗中 | [站内文案] 同上（`combat.too-many`、`combat.in-other-combat`） |

---

## 12. 卡牌手札

### 12.1 CCFOLIA（能力完整）

| 能力 | 细节 | 来源 |
|---|---|---|
| 建牌堆 | 同尺寸スクリーンパネル完全重叠 → 右键「山札を作る」；设背面图 | https://docs.ccfolia.com/gm-tutorial/decks |
| 抽牌 | 1 张、10 张、任意 1–10 张（v1.30）、背面抽 1 张、背面抽 1–10 张（v1.31）；双击牌堆抽 1 张，再双击公开/翻回 | https://docs.ccfolia.com/pl-tutorial/panels/card-decks 、https://docs.ccfolia.com/update/v1.30/drow_x_cards 、https://docs.ccfolia.com/update/v1.31/draw_x_back_cards |
| 收牌 | 拖回牌堆 / 右键「山札に戻す」；「全て集める」一键回收 | 同上 |
| 合并牌堆 | 同尺寸牌堆重叠 →「山札を合わせる」 | https://docs.ccfolia.com/gm-tutorial/decks |
| 加牌 | 背面图与尺寸一致的卡叠到牌堆上即加入（v1.30） | https://docs.ccfolia.com/update/v1.30/add_card |
| 扑克 | 一键加 54 张标准扑克牌堆 | https://docs.ccfolia.com/gm-tutorial/decks |
| 固定 | v1.29 起牌堆可「配置固定/サイズ固定」；v1.34 起可设重なり優先度 | https://docs.ccfolia.com/update/v1.29/deck-update 、https://docs.ccfolia.com/update/v1.34 |
| 手牌私看 | 抽出的卡可「全体に公開/自分だけ見る/非公開/自分以外に公開」 | https://docs.ccfolia.com/pl-tutorial/panels/panels |
| 限制 | 官方开发状态：牌序指定/排序/任意取牌 仍是 `draft`（即当前不能指定顺序抽） | https://docs.ccfolia.com/information/development-status |

### 12.2 回声岛

- 无卡牌/牌堆系统。相同诉求用「背包物品（带规则与数量）」「表格变量 + `/draw` 随机抽取」「沙盒卡片节点」实现。（[站内文案] https://echois.fun/assets/ggf76k2e.js （`backpack.*`、`cmd.draw.*`、`mdv3.name.V3Card`）、https://跑团.cn/doc/backpack-items.md ）

---

## 13. 移动端适配

### 13.1 CCFOLIA

- 官方推荐环境覆盖 Windows/macOS 最新两版、iOS/iPadOS 最新两版（Safari/Chrome）、Android 最新两版（系统浏览器/Chrome）。（https://docs.ccfolia.com/information/recommendation ）
- 小屏幕时聊天区改为全屏显示；盘面独立缩放。（https://docs.ccfolia.com/pl-tutorial/room-chat ）
- FAQ 明确移动端已知问题：部分情况下拖不动牌堆/面板、BGM 添加或播放异常、ZIP 导入失败、角色状态条不显示（宽度不足）等。（https://docs.ccfolia.com/information/problems ）
- 无 PWA 安装引导、无横屏引导、无专用 App。`[未证实：未见官方 PWA/APK]`

### 13.2 回声岛

| 能力 | 细节 | 来源 |
|---|---|---|
| PWA | 可「添加到主屏幕」全屏运行，iOS 有专门引导文案 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`app.iosInstall*`）、https://echois.fun/manifest.webmanifest |
| 布局 | 手机端竖屏/横屏各有布局；横屏提示；聊天框可调高度/拖拽/重置位置；键盘弹起自动收起舞台 | [站内文案] 同上（`game.landscapeHint`、`game-setting.collapse-scene-on-typing`、`layout.*`） |
| 触控优化 | 立绘位置单指拖/双指缩放；节点长按菜单；右下工具入口 | [站内文案] 同上（`npc.img-gesture-hint-mobile`） |
| 客户端 | 有 Android APK（含版本校验与更新提示），网页版可继续用 | [站内文案] https://echois.fun/assets/index-kk77oasc.js （`下载新版 APK`、`使用网页版`） |
| 兼容性坑 | iOS 安全区/状态栏样式专门处理（源码注释记录过真机问题）；不支持夸克浏览器；安卓 App 部分浏览器不支持朗读 | https://跑团.cn/ （index.html 源码注释与 meta）、[站内文案] 同上（`app.quarkNotSupported`、`chat.replaySettingTip`） |

---

## 14. 录像 / Replay

### 14.1 CCFOLIA

- 无录像、无 Replay、无操作录制。只有聊天记录导出（HTML/JSON），且导出为「静态文本 + 骰点结果」，不含盘面状态与场景切换。（https://docs.ccfolia.com/pl-tutorial/room-chat/chat-menu 、https://docs.ccfolia.com/update/v1.37 、https://docs.ccfolia.com/information/development-status ）
- 官方也未在开发状态表列出「リプレイ/録画」条目。（同上）

### 14.2 回声岛（结构性优势）

| 能力 | 细节 | 来源 |
|---|---|---|
| 留声机 | 房间首次发言后自动开始记录「一切操作」（场景、遮罩、立绘、骰点、消息），生成可交互 Replay；仅守灯人有效期内启动 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`driver.timemachine-desc`） |
| 回放器 | 单步/自动播放、字幕区可缩放、字号/字速/自动播放间隔可调、可隐藏场外/操作记录、可开关朗读 | [站内文案] 同上（`replay.*`、`game-setting.replay-*`） |
| 回放内编辑 | 在「留声机起点」之后可停在此刻改差分/场景，改动写为紫色「留声机」条目，可删条目撤销；有「时间悖论」保护提示 | [站内文案] 同上（`replay.edit-*`） |
| 结团归档 | 归档为交互式 Replay（Keeper）或纯文字 Log（免费）；归档不可逆，之后不可再进房 | [站内文案] 同上（`rm.confirm-replay`、`rm.confirm4`） |
| 视频导出 | 本地渲染 1920×1080（Chrome/Edge 148+，需启用 Canvas Draw Element），可混入 TTS 语音、可设字幕大小与主题；不上传服务器 | [站内文案] 同上（`render.*`） |
| 排版（LogBook） | 将聊天记录排版成印刷品：封面/目录/插页、按频道/角色/类型/关键词设样式规则、HTML 模板、纸张尺寸、PDF 导出、公开只读链接（免登录）、社区模板复用 | [站内文案] 同上（`logbook.*`） |
| 分享 | 长图/分页长图/海报（含扫码）、公开房间 Log 浏览、作品货架 | [站内文案] 同上（`work.share-*`、`bbs.publicLogs`） |

---

## 15. 收费模式

### 15.1 CCFOLIA（订阅 + 自带商店）

| 档位 | 价格 | 内容 | 来源 |
|---|---|---|---|
| BASIC | 免费 | 基本功能、房间无限、日志导出上限 1 万条 | https://ccfolia.com/plans |
| PRO | ¥500/月（税込） | 房间数据复制/导出、公开链接、计时器、日志导出无上限（v1.37 起）、ターボモード、高画质图片上传、告知枠隐藏、`/omikuji`、云盘视频 `/play` | 同上、https://docs.ccfolia.com/update/v1.37 |
| PRO + SOUND MASTER | ¥500 + ¥880/月（活动价见站内） | 追加 50 万点以上高质量音源库、音源设置继承、音源跨房间沿用 | https://ccfolia.com/plans |
| CCFOLIA GAMES | 单作品买断 | 站内商店购买模组/游戏，购买后进「ライブラリ」，一键开房；支持追加/扩展包 | https://docs.ccfolia.com/ccfolia-games/purchase 、https://docs.ccfolia.com/update/v1.29/games-store |
| 其他 | — | 官方素材（BGM/图片）库、Unsplash 直连 | https://docs.ccfolia.com/gm-tutorial/bgm-settings |

### 15.2 回声岛（免费 + 社区点数 + 赞助 + 交易市场）

| 档位 | 价格 | 内容 | 来源 |
|---|---|---|---|
| 免费 | ¥0 | 房间/角色/指令/物品/沙盒等主体功能；房间数、频道数、素材数、差分数、同时在线人数受等级配额限制 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`subscribe.var-*`）、https://跑团.cn/rule |
| 社区点数 | 免费获取为主 | 签到、发帖、被赞、被收藏、素材被使用、沙盒被使用、游戏被使用、邀请码、兑换码、活动奖励、赞助赠送；可兑「守灯人 1 个月（200 点）」、扩私密素材额度、站内 AI 消耗 | [站内文案] 同上（`credit.*`、`mat-quota.*`）、https://跑团.cn/rule （六、社区点数与高级用户） |
| 守灯人（Keeper） | 爱发电赞助 / 200 点兑换 1 个月 | 700+ 音色与多情绪、GIF 立绘 / MP4 场景遮罩、留声机 Replay 录制、结团后 Replay 二次编辑、实况频道、实验功能、更高配额 | [站内文案] 同上（`subscribe.plan-premium-feature-*`）、https://跑团.cn/rule |
| 中级（赞助档 1） | 见爱发电 | 加入房间不受房间容量限制、可设副房主 | [站内文案] 同上（`subscribe.plan-medium-feature-*`） |
| 交易市场 | 人民币，平台抽成 | 上架模组 / 预设游戏 / 素材集；卖家自配「面包多 Pay」收款，平台按比例分账；买家获得独立副本；有授权协议、禁止转售、试读、订单与退款状态 | [站内文案] 同上（`market.*`） |
| 站内 AI | 扣社区点数 | 生成沙盒代码 / 物品 YAML / 车卡模板；模型可选 | [站内文案] 同上（`ai.*`） |

---

## 16. 回声岛特有功能（CCFOLIA 无对应）

| 功能 | 说明 | 来源 |
|---|---|---|
| 预设游戏（可复用剧本） | 「模板→房间」两层，一个预设游戏反复开团；房间可反向覆盖原始游戏 | [站内文案] https://echois.fun/assets/ggf76k2e.js （`concept.*`、`rm.confirm5/6`） |
| 沙盒系统 | 类 PPT 的自定义 UI 引擎：节点、变量、条件显示、自我复制（表格循环）、嵌套沙盒、代码节点（QuickJS/iframe）、社区发布与版本化、风险标记 | https://跑团.cn/doc/sandbox/1-basics.md 、https://跑团.cn/doc/sandbox/4-variables.md 、[站内文案] 同上（`sandbox.publish*`、`riskTag.*`） |
| 自定义指令（RuleScript） | 玩家输入 `.xxx` 触发 JS，可 `roll`/`getAttr`/`getData`/`defineJudge`，副作用限 10 条；有审核、冲突检测、房间级参数覆盖 | https://跑团.cn/doc/rulescript-ai-prompt.md |
| 规则体系 | 社区规则可挂数据文件（JSON）、表索引（echo-tables.json）、维护者/审核组、角色模板、物品、指令；内置 7 套规则 | https://跑团.cn/doc/rule-authoring.md 、[站内文案] 同上（`rule-home.*`、`crew.*`） |
| 背包物品规则引擎 | 物品 = 触发条件 + 动作（改属性/加标签/投骰/发消息/播音效/改数量/设变量/使动作失效），支持装备持续加成、模板派生、参数化、AOE 施法范围与特效；有「试验台」跑真实引擎调试 | https://跑团.cn/doc/backpack-items.md 、https://跑团.cn/doc/bagitem-text-format.md |
| 车卡模板（创建器） | 内嵌 HTML / 外部 URL 两种创建器，`postMessage` 协议回传角色数据，支持数据文件、分步表单、草稿、审卡、版本兼容策略 | https://跑团.cn/doc/external-creator-protocol.md |
| 触发器 | 关键词/正则、检定结果、属性阈值 → 音效/瞬时遮罩 | [站内文案] 同上（`trigger.*`） |
| 遮罩系统 | 图片/GIF/视频/沙盒，混合模式、穿透、单次播放、盖在立绘之上 | [站内文案] 同上（`scene.edit-layer-*`） |
| 频道即舞台 | 每频道独立场景/音乐/立绘/记录；实况频道按在场时间裁剪可见消息 | [站内文案] 同上（`ch.*`） |
| 立绘三态 + 批量差分裁切 | 头像/小/大立绘、自动脸部差分合并、逐差分动画 | [站内文案] 同上（`npc.*`、`lib-diffImg.*`） |
| TTS 角色朗读 | 预设音色、自建音色（AI 音色设计，10 点/个）、多情绪、按角色绑定，游戏与 Replay 均可朗读 | [站内文案] 同上（`tts.*`、`speech.*`）、https://echois.fun/assets/el933eqn.js |
| Replay / LogBook / 视频导出 | 见 §14 | 同上 |
| 跑团总结 | 发言与检定统计 + 一键成长检定 | [站内文案] 同上（`chat-report.*`） |
| 交易市场 | 真实货币买卖模组/游戏/素材集 | [站内文案] 同上（`market.*`） |
| 社区体系 | 论坛分区（游戏讨论/挂团找团/攻略/模组/骰子酒馆安科/物品仓库/沙盒社区/自定义指令/车卡模板/冒险大厅）、招募、工单（含权利人通知）、拉黑、成就与头衔 | [站内文案] 同上（`bbs.*`、`sidebar.*`、`ticket.*`、`badge.*`） |
| AI 辅助 | 站内 AI 生成沙盒代码 / 物品 YAML / 车卡模板（扣社区点数）；3D 视差场景（深度估计）；AI 音色设计；外部 AI 提示词一键复制 | [站内文案] 同上（`ai.*`、`lib.create-3d-scene*`）、https://跑团.cn/doc/rulescript-ai-prompt.md 、https://跑团.cn/doc/bagitem-text-format.md 、https://跑团.cn/doc/external-creator-protocol.md |
| 桌面客户端 | PWA + Android APK | [站内文案] https://echois.fun/assets/index-kk77oasc.js |

**关于「AI 立绘」**：官方渠道（站内文案、官方文档、官方视频简介）**未发现**「AI 生成立绘」功能；存在的是 AIGC 内容标识（`tag-aigc`、`isAI` 声明、AI 内容默认不携带版权信息）、AI 辅助生成代码/物品/车卡、深度图 3D 视差、AI 音色设计。市面上的「AI 立绘」说法来自玩家侧素材制作流程 `[未证实]`。（[站内文案] https://echois.fun/assets/ggf76k2e.js （`lib.isAI`、`lib.ai-no-license`、`charTemplate.badge-aigc`）、https://echois.fun/assets/ben8iokr.js ）

**关于「素材市场」**：确认存在真实货币交易市场（模组/预设游戏/素材集），并带授权协议与禁止转售条款；CCFOLIA 只有站内 GAMES 商店（模组/游戏），没有用户间素材交易市场。（[站内文案] 同上（`market.*`）、https://ccfolia.com/plans ）

---

## 17. 跨产品能力速查表

| 能力域 | CCFOLIA | 回声岛 |
|---|---|---|
| 房间密码 | 无（draft） | 有（≥4 位，或在线审批） |
| 游客免注册进房 | 有 | 无（强制注册） |
| 副 GM | 有（サブルームマスター） | 有（副房主，中级权益）+ 助手权限 |
| 房间模板复用 | 房间数据 ZIP / 公开链接（PRO） | 预设游戏 → 房间（核心模型） |
| 骰点规则宽度 | 200+ 系统（BCDice） | 7 内置 + 自定义脚本 |
| CoC7 SAN 自动扣减 | 无 | 有（`.sc`） |
| CoC7 成长自动 | 无 | 有（`.en`） |
| CoC7 疯狂/恐惧表 | 有（BMR/BMS/PH/MA） | 无 |
| 服务端权威掷骰 | 否 `[推断]` | `[未证实]` |
| 检定请求（GM→玩家一键） | 无 | 无（仅玩家自己投） |
| 地图迷雾/光照/测距/AOE | 无 | 有（沙盒战斗地图） |
| 卡牌牌堆 | 完整 | 无 |
| 先攻表 | 仅排序 | 完整战斗轮 |
| 场景转场/动画 | 无 | 有（4 种转场 + 7 种镜头动画 + 滤镜） |
| 遮罩层 | 无（用面板/cut-in 变通） | 有（含混合模式/穿透/沙盒遮罩） |
| 演出触发自动化 | 聊天末尾文本触发 cut-in / 差分 | 触发器（关键词/检定结果/属性阈值） |
| TTS 朗读 | 无 | 有（Keeper） |
| Replay / 录像 | 无 | 有（Keeper，可编辑，可导视频） |
| 日志排版 / PDF / 分享页 | 无（仅 HTML/JSON） | 有（LogBook） |
| 素材市场 | 无（站内 GAMES 商店） | 有（真实货币） |
| 移动端形态 | 响应式网页 | PWA + Android APK |
| 收费 | 订阅（¥500 / ¥1380） | 免费 + 点数 + 赞助（守灯人）+ 市场抽成 |

---

## 18. 对 CoGM 的启示

1. **CoGM 的差异化定位没错，但要守住三条刚需**：CoC 7e 骰点判定、人物卡/团内状态、立绘演出。两家竞品在这三条上都不是完整答案——CCFOLIA 有最广的规则但无状态联动，回声岛有状态联动但规则窄、学习成本高。CoGM 以「服务端权威 + CoC 7e 深度」切入，正好卡在中间。
2. **「演绎放行队列」是真正的独占能力**。两家都没有「GM 审核后才上屏」的概念：CCFOLIA 是全员自由发言 + 秘匿标签，回声岛的场外/场内只是标记，不改变可见时序。CoGM 把它做成「玩家无感」，这是沉浸式文字演出最关键的护城河，应优先做实（队列顺序调整、丢弃静默、表情随消息生效）。
3. **骰点要抄 CCFOLIA 的「表」，抄回声岛的「写回」**：
   - 必抄：奖励/惩罚骰语法与难度档（CC/h/e/r）、成功等级六档、暗骰、`/roll-table` 式原创随机表、疯狂/恐惧/躁狂表（CoC 7e 实际带团高频）。
   - 必抄：SAN 检定自动掷损失并扣减（CoGM 已规划）、成长标记自动记录（已规划）。
   - 需要补：对抗检定、自动武器/连发、按组惩罚骰、先攻自动排序。这些在 `docs/product.md` 里是「v1 不自动化」，但回声岛已证明可实现且对 CoC 带团价值高。
4. **聊天面板的「可复用命令」必须做**。CCFOLIA 的 chat palette 之所以是事实标准，是因为它把「复杂命令」压成一次点击，并且换行即分条、可被第三方工具生成。CoGM 的骰点面板 + 技能点击检定已经覆盖一半；建议再加「角色级快捷片段」（含表情、常用台词、技能检定、SAN 检定、成长检定），并让 GM 能批量导入。
5. **音频要抄 CCFOLIA 的双轨音量**：文件级音量（影响所有人，GM 调）与个人音量/静音（只影响自己）分离；再加「场景绑定 BGM/SE」与「SE 独立通道」。CoGM 规划的 BGM/SE 双通道方向正确，需明确「中途加入者同步进度」的实现（CCFOLIA 未提供显式保证，回声岛亦未说明，这是可以做出差异的点）。
6. **演出层不必造沙盒，但要给「触发器」**。回声岛的触发器（关键词/检定结果/属性阈值 → 音效/遮罩）是低成本高回报的演出自动化；CCFOLIA 的「聊天末尾文本触发 cut-in / 切差分」是更轻的版本。CoGM 可先做「骰点结果 → 立绘表情/音效」「关键词 → 场景特效」两条规则，不做通用脚本引擎。
7. **不要做地图棋子**（与定位冲突），但要做「场景 = 背景 + BGM + 特效绑定」的一键切换；CCFOLIA 的「场景覆盖保存 + 可只应用部分要素（无 BGM/无文本）」是很好的运维细节。
8. **情报（handout）是 CoGM 相对两家的优势项，务必把可见性做在服务端**。CCFOLIA 官方自己承认秘匿「并非严格隐藏，房主可导出全日志查看」；回声岛的线索按频道解锁，粒度是舞台不是人。CoGM 规划的「秘密情报只推送给可见者、禁止广播后前端隐藏」在两家都没有对标实现，是可信度卖点。
9. **日志/复盘是留客能力**：CCFOLIA 只有静态 HTML/JSON；回声岛做到排版书、PDF、视频。CoGM v1 不必做视频，但应保证「消息 + 骰点 + 场景切换 + 表情切换」结构化落库（宁可先不做导出），否则后期无法补录。
10. **入场体验要压到最低摩擦**：两家都证明「链接即进房」是刚需（CCFOLIA 甚至允许免注册）。CoGM 的「匿名认领 PC / OB」比两家都轻，但要补两个缺口：① 房间密码/口令（防链接外泄），② GM 不在线时的等待态提示（回声岛的「等待房主在线同意」文案可直接借鉴）。

---

## 附：调研中确认的关键事实清单（供后续引用）

- CCFOLIA 当日版本 1.37.6；PRO ¥500/月；PRO+SOUND MASTER 通常 ¥1380/月。（https://ccfolia.com/ 、https://ccfolia.com/plans ）
- CCFOLIA 房间变量上限 16 个；label ≤16 字、值 ≤64 字。（https://docs.ccfolia.com/gm-only/room-variable ）
- CCFOLIA 存档槽 3 个；房间数据导出不含音频。（https://docs.ccfolia.com/gm-only/room-option/save-load 、https://docs.ccfolia.com/gm-only/room-option/room-settings/room-data ）
- CCFOLIA 日志上限：BASIC 1 万条；PRO v1.37 起无上限。（https://docs.ccfolia.com/pl-tutorial/room-chat/chat-menu 、https://docs.ccfolia.com/update/v1.37 ）
- CCFOLIA 秘匿标签参与人数上限 2；加入者被移出成员列表后内容消失；房主可用「全ログ出力」看到未参与的秘匿内容。（https://docs.ccfolia.com/information/faq ）
- 回声岛前端版本 v3.2.4；官方自述「个人独立开发运营」；社区点数兑换守灯人为 200 点/月（以站内公示为准）。（https://echois.fun/assets/g8aljg6b.js 、https://跑团.cn/about 、https://跑团.cn/rule ）
- 回声岛房间号为 10 位字母或数字；房间密码至少 4 位。（[站内文案] https://echois.fun/assets/ggf76k2e.js ）
- 回声岛批量差分上传上限 50 张/次；消息上限 1000 字；单文件上限 10MB。（[站内文案] 同上、https://echois.fun/assets/g8aljg6b.js ）
- 回声岛 Replay 仅守灯人可录制；文字房间不能存 Replay，只能存文字 Log。（[站内文案] 同上（`rm.confirm4`、`driver.timemachine-desc`））
- 回声岛视频导出需桌面版 Chrome/Edge 148+，并手动开启 Canvas Draw Element。（[站内文案] 同上（`render.*`））
