# 架构设计

## Monorepo 结构（Bun workspaces）

```
CallofGM/
├── package.json          # workspaces: ["apps/*", "packages/*"]
├── packages/
│   └── shared/           # zod schema：WS 消息协议、团状态枚举、通用骰点；规则专属 schema 在 src/rules/{ruleId}/
├── apps/
│   ├── client/           # React 19 + Vite + TanStack Router + Zustand + Tailwind v4 + shadcn/ui
│   └── server/           # Elysia + Drizzle + bun:sqlite
├── data/                 # SQLite 文件 + 上传媒体（立绘/背景/音乐/情报图片），不入库存磁盘
└── docs/                 # 本目录
```

`packages/shared` 是协议的单一事实来源：服务端用 zod 做运行时校验，客户端用 `z.infer` 拿类型。改协议 → 两端编译期报错。

## 服务端权威原则

以下判定一律在服务端执行，前端只渲染结果、禁用输入：

- 团状态机流转（等待开始/准备中/进行中/已结团）与团内阶段（自由讨论/演绎时间/强制CG/自由演绎）
- 每条消息"是否允许发出、记为场外还是角色扮演"的裁决，以及演绎发言的放行（GM 待呈现队列）
- 掷骰与技能鉴定（服务端生成随机数、从库中人物卡读取目标值并判级，前端不传任何数值）
- 角色团内状态变更（HP/MP/SAN、状态标记；仅 GM 指令与理智检定自动扣减两个入口）
- 情报可见性（秘密情报只推送给可见者，禁止全员广播后前端隐藏）
- 团级可见性设置（公开队友人物卡 / OB 可见 PC 数值）对快照与事件的过滤，按查看者席位逐连接裁剪

发言与自主掷骰的权限矩阵定义在 `packages/shared` 的 `policy.ts`（`decideChatMessage` / `canPlayerInitiateDiceRoll`）：服务端据此拒绝命令，前端用同一函数只做输入禁用，避免两套规则漂移；席位（PC/OB）由快照的 `viewer.seatRole` 下发，前端不自行推断。
- 踢人、黑名单校验（WS 握手时校验指纹）

## WebSocket 设计

- 每个团一个 topic：`session:{id}`。连接加入团即 `ws.subscribe`，广播用 `server.publish`。
- **定向消息**（如秘密情报）不走 topic，服务端按连接注册表向可见者逐连接推送。
- 消息信封：`{ eventId: number, type: string, payload: T }`，eventId 为团内单调递增序号。
- 事件可见范围 `visibility` 四种以上：`public`（全员）、`gmOnly`（仅 GM）、`pcPlayers`（GM + 有 PC 席位的玩家，用于 OB 不可见但 PC 可见的状态同步）、`selectedPcIds`（指定 PC）与 `connectionOnly`（单连接）。投递、补发与快照共用同一套 `checkVisibility` 判定。
- **断线补发**：服务端为每个进行中的团在内存维护一个环形事件日志（近 N 条），日志条目带可见范围（全体 / 指定 PC 集合 / GM + PC 席位）。客户端（partysocket 自动重连）重连时携带 `lastEventId`，服务端按请求者身份过滤后补发缺失事件；缺口超出日志范围则下发全量快照（团名与可见性设置、请求者身份 `viewer`（是否 GM、席位 PC/OB）、当前场景、在场立绘及表情、阶段、音频状态、对该玩家可见的情报及其已读状态、对该玩家可见的各角色团内状态与人物卡、待其响应的鉴定请求、最近聊天区时间线及回看游标）。
- 新加入者直接走全量快照路径。
- **聊天区时间线**：快照与回看共用同一条时间线——已呈现的聊天消息与骰点/鉴定记录按 `eventId` 升序合并（`packages/shared` 的 `HistoryItem`）。快照下发最近 50 条，并附游标 `history: { beforeEventId, hasMore }`。
- **历史回看分页**：客户端以命令 `history:page`（`HistoryPageQuery { beforeEventId?, limit? }`，limit 默认 50、上限 100）请求更早的记录，回执在 `command:accepted` 的 `payload.history` 中返回 `{ items, hasMore, beforeEventId }`。`beforeEventId` 为排他上界，`hasMore=false` 时为 null。分页与实时事件共用同一套按请求者身份的可见性过滤（秘密/暗骰事件永不外泄，待呈现与已丢弃消息不进入时间线），因此 OB/GM/PC 各自看到同一位置的不同切片；结团后该命令仍可用（只读回看）。

## 演绎发言队列（隐式审核）

- 生命周期：玩家发送演绎消息 → 服务端写入该团的**待呈现队列**（不广播、不进事件日志、不分配 eventId）→ GM 控制台实时看到队列，可排序、放行、丢弃 → **放行时才分配 eventId**、写入事件日志并广播进场景；丢弃则静默移除。
- eventId 只在放行时分配，保证事件日志与断线补发的顺序即"呈现顺序"，与队列内部状态无关。
- 玩家端对队列零感知：发送即完成，无待审/驳回状态展示；玩家自己的消息也只在放行后出现在场景中。
- 演绎消息可携带表情切换 `expressionId`（服务端校验只能操作发言者自己的 PC），放行时随消息一并广播，场景立绘同步切换；表情**预览**为纯前端功能（玩家浏览自己 PC 的各表情立绘素材），无服务端交互。
- PC 玩家与 GM 的场外（OOC）消息绕过队列，即时分配 eventId 并广播；**OB 的所有发言一律入队**，经 GM 放行后才上公屏。
- 队列本身只对 GM 可见：随 GM 端快照下发，GM 重连不丢队列；队列持久化到 SQLite，服务端重启不丢失未放行的发言。

## 规则系统抽象

v1 只实现 CoC 7e，但**所有规则相关逻辑必须通过统一的规则系统接口接入，通用业务代码禁止硬编码任何具体规则的判定**——这是永久原则（同见 `CLAUDE.md` / `AGENTS.md`）。

- 服务端以面向对象组织：`RuleSystem` 抽象类，每种规则一个实现类（`apps/server/src/rules/{ruleId}/`）。职责边界：
  - 人物卡 schema 与 Excel 解析器
  - 技能鉴定判级（输入目标值/难度/奖惩骰 + 注入的 RNG，输出结果等级——RNG 注入以便 `bun test` 断言）
  - 规则特有检定（如 CoC 的理智检定）以规则自有动作暴露
  - 团内状态的 schema 定义与从人物卡的初始化推导（HP/MP/SAN 属于 CoC 7e 实现，不属于通用层）
  - 供结构化 UI 调用的规则动作定义（技能鉴定、理智检定等）；v1 不解析聊天文本命令
- 服务端维护规则注册表 `ruleId → RuleSystem 实例`；模组记录 `ruleId`，团继承模组的规则。
- 通用层只保留规则无关能力：普通骰点表达式、事件广播与可见性、演绎队列、团状态机。
- `packages/shared` 按规则命名空间组织：通用 schema 在 `src/` 顶层，规则专属 schema 在 `src/rules/{ruleId}/` 下，以 `export * as coc7e` 命名空间导出，避免跨规则命名冲突。
- WS 消息中规则相关 payload 携带 `ruleId`，由对应规则模块的 zod schema 校验。
- 骰点与鉴定入口统一使用 `packages/shared` 定义的结构化 WS command：普通骰点由骰点面板提交表达式，玩家自主鉴定由人物卡提交技能标识，GM 鉴定请求由控制台创建并由目标玩家确认响应。聊天消息只承载文本，不参与规则动作解析。

## 掷骰与鉴定引擎

- 骰点表达式解析、随机数生成（`crypto.getRandomValues`）与判级全部在服务端，结果分配 eventId 广播进聊天区；客户端只提交意图：普通掷骰传表达式，技能鉴定传 `characterId + skillKey + 难度/奖惩骰`，目标值由服务端从库中人物卡查得。
- 判级规则（大成功/极难/困难/常规/失败/大失败、奖励惩罚骰取十位、难度阈值）由 CoC 7e 规则模块实现为纯函数（见"规则系统抽象"），类型定义在 `packages/shared` 的 `rules/coc7e/`，用 `bun test` 全覆盖。
- **暗骰**复用秘密情报的定向推送机制：结果事件进事件日志但可见范围 = 仅 GM，断线补发按同一套过滤；玩家响应暗骰鉴定请求时仅收到"已掷出"回执。
- **鉴定请求**：GM 创建请求（目标 PC、skillKey、难度、奖惩骰、是否暗骰）→ 定向推送目标玩家 → 玩家确认后服务端校验存在待响应请求再掷骰。待响应请求随快照下发，重连不丢。
- **理智检定**：GM 发起时附损失表达式 `成功/失败`（如 `1/1d6`），服务端判定后自动掷损失、经统一的状态变更入口扣减团内 SAN，检定结果与状态变更作为两个事件先后广播。
- 阶段权限复用消息裁决逻辑：玩家自主掷骰按"场外发言"规则判允许与否；响应鉴定请求不受阶段限制。

## 角色团内状态

- 表 `session_character_state`：主键 `(sessionId, characterId)` + `state`（JSON）。`state` 的 schema 由团所属规则模块定义并校验（CoC 7e：`hp/maxHp/mp/maxMp/san/maxSan`、`statuses` 预置标记、`tags` 自定义标签、`growthMarks` 技能名列表）；团创建/PC 进团时由规则模块从人物卡推算初始化。
- 所有变更（GM 编辑、理智检定扣减、鉴定引擎写成长标记）走服务端统一入口：写库 → 生成 `state:changed` 事件（带 eventId，进事件日志）→ 按可见性广播。伤害/损失越阈（重伤线、HP 归零、单次 SAN ≥ 5）时向 GM 附加提示，不自动挂状态。
- 可见性：PC 状态事件默认广播全员；团级设置「OB 可见 PC 数值」关闭后改为 `pcPlayers` 作用域（GM + PC 席位玩家），OB 连接收不到 `state:changed`，快照中的 PC 状态也为 null。NPC 状态事件仅推送 GM（复用定向推送）。全量快照包含对请求者可见的全部角色状态。
- **暗骰作用域贯穿状态变更**：暗骰鉴定成功写入的成长标记记入 `hiddenGrowthMarks`，整次 `state:changed` / `state:hint` 仅发 GM；状态视图由规则模块按观察者裁剪（`viewSessionState`），玩家快照与广播都不含暗骰技能名。非暗骰状态变更保持公开。

## 音频同步（GM 控制）

服务端为每个团维护权威音频状态：

```
BgmState = { trackId, playing, volume, loop, seekOffset, startedAt(服务器时钟) }
```

- GM 发出指令（播放/暂停/切歌/音量/淡入淡出/seek）→ 服务端更新状态并广播 → 各客户端 Howler 执行。
- 中途加入/重连者从快照恢复：播放位置 = `seekOffset + (serverNow - startedAt)`，对 loop 曲目取模时长。
- **SE 音效**为一次性广播（fire-and-forget），不进快照。
- 玩家本地可静音/调本地音量，不影响他人；进团点击作为浏览器音频解锁手势。

## 情报发放

- 情报条目存于模组（标题、正文、可选图片），发放记录存于团：`{ handoutId, sessionId, visibility: 'all' | pcIds[] , grantedAt }`。
- GM 发放/追加对象 → 服务端写入发放记录 → 公开情报走 topic 广播、秘密情报走定向推送 → 玩家端弹出展示并计入情报面板。
- 可见性判定只在服务端：REST 拉取情报列表与 WS 推送/补发共用同一套过滤逻辑。
- 已读状态存于 `handout_reads`（`grantId × playerId` 唯一）：玩家发送 `handout:read` 命令后落库，快照与 REST 返回的 `GrantedHandoutDto` 携带 `read` 字段；自动弹窗只显示未读条目，重连/重进不再重复提示。
- 团名与人卡可见性：`sessions.name`（可空，界面回退模组名）与 `sessions.share_pc_sheets` / `sessions.ob_see_pc_state`（默认开启）。GM 通过 `session:settings` 命令切换可见性并广播 `session:settings-changed`，客户端收到后重新拉取全量快照，使已连接的玩家立即按新规则生效。

## 身份、在线与黑名单

- GM：密码登录 → HttpOnly session cookie。
- 玩家：首次进入由服务端签发匿名 token，仅存于 HttpOnly `player_token` cookie（不落 localStorage），同时上报 FingerprintJS 指纹。
- 在线列表来自 WS 连接注册表（连接 ↔ 团 ↔ 所选 PC/OB）。
- 踢出 = 关闭 socket；拉黑 = 指纹写入黑名单表（含过期时间，NULL 为永久），HTTP 与 WS 握手均校验；已通过 GM cookie 鉴权的请求优先于指纹黑名单。
- GM 写接口（`/api/v1/gm/*` 的 POST/PATCH/PUT/DELETE）校验 Origin/Referer，命中允许来源才放行；GET 不受影响。

## 前端路由（TanStack Router）

| 路径 | 视图 |
|---|---|
| `/` | 入口：输入/选择团 |
| `/join/$sessionId` | 玩家进团：选 PC 或 OB 位（标题优先显示团名，未命名时回退模组名） |
| `/play/$sessionId` | 玩家沉浸视图 |
| `/gm/login` | GM 登录 |
| `/gm` | GM 后台：模组/人物/场景/音乐/情报/团管理 |
| `/gm/session/$sessionId` | GM 控制台：控场、切场景/立绘/音乐、发放情报、演绎队列放行、在线管理 |

选 TanStack Router 而非 React Router：路由参数与 search params 全类型安全，`$sessionId` 这类参数不会出现手写字符串取参的运行时错误，与 Eden Treaty / Drizzle / zod 的端到端类型安全路线一致。

## Excel 人物卡导入

GM 后台上传 `.xlsx` → 服务端 SheetJS 解析 → 按 `packages/shared` 的人物卡 zod schema 校验映射 → 返回预览给 GM 确认 → 入库。解析器按"CoC 7e 人物卡模板"实现为独立模块，未来适配其他规则时新增解析器即可。

## 渲染与部署

- 场景画面用 DOM + CSS 实现（绝对定位立绘 + transition 切换表情/转场），不引入 Canvas/PixiJS；需要更复杂动画时再加 GSAP。
- 生产部署：`vite build` 产物由 Elysia 静态托管，单 Bun 进程提供 HTTP + WS，Docker 镜像基于 `oven/bun`。
