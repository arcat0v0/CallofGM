# 架构设计

## Monorepo 结构（Bun workspaces）

```
CallofGM/
├── package.json          # workspaces: ["apps/*", "packages/*"]
├── packages/
│   ├── shared/           # zod schema：WS 消息协议、团状态枚举、通用骰点；规则专属 schema 在 src/rules/{ruleId}/
│   ├── theme-sdk/        # 主题插槽契约、上下文类型、defineTheme 与运行时 API 声明
│   └── theme-cli/        # cogm-theme：主题脚手架、esbuild 构建、.cogmtheme 打包
├── apps/
│   ├── client/           # React 19 + Vite + TanStack Router + Zustand + Tailwind v4 + shadcn/ui
│   └── server/           # Elysia + Drizzle + bun:sqlite
├── data/                 # 运行时数据（SQLite、上传媒体、已安装主题），本地默认位于 apps/server/data/，不入库存磁盘
└── docs/                 # 本目录
```

`packages/shared` 是协议的单一事实来源：服务端用 zod 做运行时校验，客户端用 `z.infer` 拿类型。改协议 → 两端编译期报错。

## 主题系统（UI 自定义）

自部署者可通过运行时 React 主题插件替换页面布局、视觉与站点文案，核心代码不参与构建。完整格式、SDK、安全与验证流程见 `docs/theme-system.md`；本节只记录架构约束。

- **主题 = 编译产物插件**：`.cogmtheme`（zip）内为 `theme.json` + `bundle.js` + `bundle.css` + 静态资源；服务端不接收/不执行 TSX。作者用 `packages/theme-cli`（esbuild）本地构建，CLI 将 `react`/`react-dom`/`@cogm/theme-sdk` 替换为 `globalThis.__COGM_THEME_SDK__` 代理，主题与核心共享同一份 React。
- **页面级插槽**：核心拥有路由、状态、WS 与服务端权威判定；主题只覆盖 `packages/theme-sdk` 声明的 14 个插槽（进团/玩家视图/GM 控制台/GM 后台）。未覆盖插槽、加载失败或插槽抛错均回退内置 `default` 主题；`?theme=default` 为强制逃生开关。
- **作用域与服务端权威**：玩家进团/沉浸视图使用模组 `themeId`（由快照与进团信息下发，客户端不可自选）；GM 控制台与后台使用实例级 `ui_settings.gmThemeId`，由 admin 在实例设置中写入。入口与登录页固定默认主题。
- **严格版本**：`apiVersion` 必须等于核心 `THEME_API_VERSION`（当前 1）；同一 id 只能安装更高 semver 版本，保留最近 2 个版本，静态文件按 `/themes/:id/versions/:version/*` 长期缓存。
- **文案单一来源**：核心 UI 文案集中在 `apps/client/src/i18n/messages/zh-CN.ts`，主题可通过 `messages` 按 key 覆盖；系统消息使用稳定 `ChatMessage.isSystem` 字段，禁止文案匹配。
- **安全边界**：主题 bundle 是完整权限的浏览器代码，仅 admin 可上传且需同源校验；安装时校验哈希、路径白名单、大小/条目限制并原子落盘。不引入签名校验，admin 上传等同安装可信插件。

## 服务端权威原则

以下判定一律在服务端执行，前端只渲染结果、禁用输入：

- 团状态机流转（等待开始/准备中/进行中/已结团）与团内阶段（自由讨论/演绎时间/强制CG/自由演绎）
- 每条消息"是否允许发出、记为场外还是角色扮演"的裁决，以及演绎发言的放行（GM 待呈现队列）
- 掷骰与技能鉴定（服务端生成随机数、从库中人物卡读取目标值并判级，前端不传任何数值）
- 角色团内状态变更（HP/MP/SAN、状态标记；仅 GM 指令与理智检定自动扣减两个入口）
- 情报可见性（秘密情报只推送给可见者，禁止全员广播后前端隐藏）
- 团级可见性设置（公开队友人物卡 / OB 可见 PC 数值）对快照与事件的过滤，按查看者席位逐连接裁剪
- 账号角色与资源所有权：登录、会话顶替、所有者过滤、管理员越权隔离

发言与自主掷骰的权限矩阵定义在 `packages/shared` 的 `policy.ts`（`decideChatMessage` / `canPlayerInitiateDiceRoll`）：服务端据此拒绝命令，前端用同一函数只做输入禁用，避免两套规则漂移；席位（PC/OB）由快照的 `viewer.seatRole` 下发，前端不自行推断。
- 踢人、黑名单校验（WS 握手时校验指纹）

## WebSocket 设计

- 每个团一个 topic：`session:{id}`。连接加入团即 `ws.subscribe`，广播用 `server.publish`。
- **定向消息**（如秘密情报）不走 topic，服务端按连接注册表向可见者逐连接推送。
- 消息信封：`{ eventId: number, type: string, payload: T }`，eventId 为团内单调递增序号。
- 事件可见范围 `visibility` 四种以上：`public`（全员）、`gmOnly`（仅 GM）、`pcPlayers`（GM + 有 PC 席位的玩家，用于 OB 不可见但 PC 可见的状态同步）、`selectedPcIds`（指定 PC）与 `connectionOnly`（单连接）。投递、补发与快照共用同一套 `checkVisibility` 判定。
- **断线补发**：服务端为每个进行中的团在内存维护一个环形事件日志（近 N 条），日志条目带可见范围（全体 / 指定 PC 集合 / GM + PC 席位）。客户端（partysocket 自动重连）重连时携带 `lastEventId`，服务端按请求者身份过滤后补发缺失事件；缺口超出日志范围则下发全量快照（团名与可见性设置、请求者身份 `viewer`（是否 GM、席位 PC/OB）、当前场景、在场立绘及表情、阶段、音频状态、对该玩家可见的情报及其已读状态、对该玩家可见的各角色团内状态与人物卡、待其响应的鉴定请求、最近聊天区时间线及回看游标、最近一次回溯提示 `lastRewind`）。
- 新加入者直接走全量快照路径。
- 团内 NPC 编组走 REST：`POST /api/v1/gm/sessions/:id/npcs` 校验 GM 所有权、`kind=npc` 与规则一致，未关联模组时自动关联后写入团内人物快照；`DELETE /api/v1/gm/sessions/:id/npcs/:characterId` 只软删该团内快照。两者成功后向全团发送 `session:refresh`，不删除人物本体与历史。
- GM 舞台沿用 `play.stage` 的桌面视口布局，使立绘位置与玩家端一致；「玩家视角预览」复用同一舞台插槽但按模组 `themeId` 建立独立主题上下文，不改变 GM 界面主题。
- **聊天区时间线**：快照与回看共用同一条持久化时间线——已呈现的聊天消息（`session_messages`）与时间线活动事件（`session_history_events`，含掷骰/已完成鉴定、场景切换、阶段变化、情报发放、表情变化与回溯事件）按 `eventId` 升序合并（`packages/shared` 的 `HistoryItem`）。活动事件逐条按 `visibility` 与 `playerVisible` 过滤，状态变更仅 GM 历史可见。快照下发最近 50 条，并附游标 `history: { beforeEventId, hasMore }`。
- **历史回看分页**：客户端以命令 `history:page`（`HistoryPageQuery { beforeEventId?, limit? }`，limit 默认 50、上限 100）请求更早的记录，回执在 `command:accepted` 的 `payload.history` 中返回 `{ items, hasMore, beforeEventId }`。`beforeEventId` 为排他上界，`hasMore=false` 时为 null。分页与实时事件共用同一套按请求者身份的可见性过滤（秘密/暗骰事件永不外泄，待呈现与已丢弃消息不进入时间线），因此 OB/GM/PC 各自看到同一位置的不同切片；玩家历史不按加入时间截断（含加入前的公开记录），不包含自己的待审/未通过发言与因回溯归档的内容；结团后该命令仍可用（只读回看）。

## 演绎发言队列（隐式审核）

- 生命周期：玩家发送演绎消息 → 服务端写入该团的**待呈现队列**（不广播、不进事件日志、不分配 eventId）→ GM 控制台实时看到队列，可排序、放行、拒绝（可附拒绝理由）→ **放行时才分配 eventId**、写入事件日志并广播进场景；拒绝后消息保留在已驳回列表，作者侧收到未通过状态与理由。
- eventId 只在放行时分配，保证事件日志与断线补发的顺序即"呈现顺序"，与队列内部状态无关。
- 玩家端显示自己的待审查/驳回状态：发送后作者连接即时收到 `chat:pending`，拒绝时收到 `chat:rejected`（含理由）；快照额外下发本人 `ownPendingMessages` / `ownRejectedMessages`，刷新或重连后状态不丢。完整队列仍只对 GM 可见。
- 未被放行的消息不出现在公共聊天时间线或历史回看中。
- 演绎消息可携带表情切换 `expressionId`（服务端校验只能操作发言者自己的 PC），放行时随消息一并广播，场景立绘同步切换；表情**预览**为纯前端功能（玩家浏览自己 PC 的各表情立绘素材），无服务端交互。
- PC 玩家与 GM 的场外（OOC）消息绕过队列，即时分配 eventId 并广播；**OB 的所有发言一律入队**，经 GM 放行后才上公屏。
- 完整队列只对 GM 可见：随 GM 端快照下发，GM 重连不丢队列；队列持久化到 SQLite，服务端重启不丢失未放行的发言。玩家只读取自己的队列条目与驳回理由。
- GM 的 `chat:send` 可携带 `characterId` 指定本团 NPC 作为发言者：服务端校验该人物在本团且 `kind=npc`、仅允许 `roleplay` 频道；消息仍标记 `senderType=gm`，即时广播并附 NPC 名称。若同时携带 `expressionKey`，校验立绘存在后随消息写入团内表情并广播 `expression:changed`；该事件携带 `messageId`，客户端从 `ChatMessageDto.expressionKey` 生成表情标签显示在聊天气泡头部与舞台对话名牌附近，且不再把它单独渲染成时间线系统消息（手动切换表情仍保留独立记录）。

## 规则系统抽象

本期只注册 CoC 7e，但**所有规则相关逻辑必须通过统一的规则系统接口接入，通用业务代码禁止硬编码任何具体规则的判定**——这是永久原则（同见 `CLAUDE.md` / `AGENTS.md`）。

- 服务端以面向对象组织：`RuleSystem` 抽象类 + 每种规则一个实现类（`apps/server/src/rules/{ruleId}/`）。职责边界：
  - 不可变元数据：`id`、`name`、实现 `version`、核心兼容 `apiVersion`、`description`、`permanentSheetFields`
  - 人物卡 schema、空卡构造、Excel 解析器与导入器
  - 技能鉴定判级（输入目标值/难度/奖惩骰 + 注入的 RNG，输出结果等级——RNG 注入以便 `bun test` 断言）
  - 规则特有检定（如 CoC 的理智检定）以规则自有动作暴露
  - 团内状态的 schema 定义与从人物卡的初始化推导（HP/MP/SAN 属于 CoC 7e 实现，不属于通用层）
  - 允许扩展项声明：CoC 允许自定义技能（名称/基础值/当前值），不允许自定义属性、公式、成功等级或特殊检定
  - 供结构化 UI 调用的规则动作定义（技能鉴定、理智检定等）；不解析聊天文本命令
- 服务端维护规则注册表 `ruleId → RuleSystem 实例`；模组、团、人物、模板各自记录 `ruleId`，创建时必须显式提交，创建后不可切换。服务端不提供默认规则。
- `GET /api/v1/rules` 暴露已注册且 `apiVersion` 兼容的元数据；前端选择器只消费该接口，不硬编码规则列表。
- 客户端维护规则组件注册表 `apps/client/src/rules/{ruleId}/`：建卡组件、人物卡编辑/展示组件、检定面板与团内状态视图按 `ruleId` 取用。业务页面不得直接 import 具体规则；目前 14 处直接 import `coc7e` 的页面需在实施中清理。
- 通用层只保留规则无关能力：普通骰点表达式、事件广播与可见性、演绎队列、团状态机。
- `packages/shared` 按规则命名空间组织：通用 schema 在 `src/` 顶层，规则专属 schema 在 `src/rules/{ruleId}/` 下，以 `export * as coc7e` 命名空间导出，避免跨规则命名冲突。`RuleId` 协议为受限字符串，具体合法性由服务端注册表校验。
- 快照、日志与 WS 规则相关 payload 携带 `ruleId`，由对应规则模块的 zod schema 校验。
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
- GM 端的发放回执：快照仅对 GM 下发 `handoutGrants`（每笔发放的接收人、当前认领与已读状态，公开发放附受众与已读人数）；`handout:grant` / `handout:append` / `handout:read` 提交后通过定向消息 `handout:grants` 向 GM 推送最新回执，玩家连接不接收该字段。
- 团名与人卡可见性：`sessions.name`（可空，界面回退模组名）与 `sessions.share_pc_sheets` / `sessions.ob_see_pc_state`（默认开启）。GM 通过 `session:settings` 命令切换可见性并广播 `session:settings-changed`，客户端收到后重新拉取全量快照，使已连接的玩家立即按新规则生效。

## 历史时间线与回溯

历史回看、GM 审计与回溯共用持久化时间线，不依赖内存 ring buffer，也不把 `session_outbox` 改造成永久事件溯源——outbox 只保持「数据库已提交但尚未广播」的投递语义。

- `session_history_events`：时间线活动事件，保存 `eventId`、`type`、`payload`、`visibility`、`playerVisible`、`anchorable`、`occurredAt`，`(sessionId, eventId)` 唯一；`archived_at` / `archived_by_rewind_id` 标记被回溯移出活动时间线的条目。
- `session_runtime_checkpoints`：`(sessionId, eventId)` → 完整可回溯运行态 JSON（阶段、当前场景、人物表情与团内状态、鉴定请求、情报发放及接收者/已读）；建团时写入 `eventId = 0` 的基线检查点。
- `session_rewinds`：回溯/撤销操作记录，含 `action`、锚点与锚点时间、回溯前水位 `headEventIdBefore`、本次产生的 `rewindEventId`、撤销目标 `targetRewindId`、`reason`、归档计数与 `undoneAt`。
- `session_messages` 增加 `archived_at` / `archived_by_rewind_id`；已驳回/已丢弃发言不进入时间线，只由 GM 审计查询读取。

写入时机：

- 事件总线在分配 `eventId` 后、事务提交前写历史行。进入时间线的类型为 `dice:rolled`、`check:resolved`、`state:changed`、`session:phase-changed`、`scene:changed`、`expression:changed`、`handout:granted`、`session:rewound`；`state:changed` 标记玩家不可见（只进 GM 历史），`session:rewound` 标记不可作锚点。
- 会改变运行态的事件（`check:requested` / `check:resolved`、`state:changed`、阶段/场景/表情、`handout:granted`、`session:rewound`）在其后写检查点；不产生事件但改变运行态的命令（如 `handout:read`）覆盖当前水位的检查点。
- 不做事后回填；历史功能上线前的旧开发数据不保证可读。

回溯与撤销：

- 仅 GM。`history:preview-rewind` 返回预览（将被撤销的条目与状态变化），`history:rewind` 在二次确认后执行；锚点必须是当前活动时间线中的条目。
- 以锚点之前最近的检查点恢复运行态：团阶段、角色团内状态、场景指针、人物表情、鉴定请求与情报发放/接收者/已读。锚点条目及其之后的时间线内容被标记归档，已呈现消息一并移出活动时间线。
- 不恢复 BGM/SE、舞台布局与缩放、席位认领、踢人/黑名单/在线状态、团可见性设置与团内 NPC 编组。
- 整个待呈现队列清空并通知作者；这些消息不进入时间线。
- 回溯与撤销均产出公共事件 `session:rewound`（payload 含 `action`、`rewindId`、`anchorEventId`、`anchorOccurredAt` 与归档计数；GM 填写的 `reason` 只写入 `session_rewinds` 供归档查看，不下发玩家），同时清空该团内存 ring buffer，并向所有连接发送 `session:refresh` 强制重建快照；`eventId` 继续单调递增，不回收。
- `history:undo-rewind` 仅在团结束前可用，按 LIFO 撤销最近一次回溯；恢复旧时间线与运行态，并把回溯后新产生的已呈现内容移入归档。撤销同样产出 `session:rewound`（`action = "undo"`）。
- 在线玩家直接收到 `session:rewound` 事件与系统提示；离线玩家重连时，快照携带最近一次回溯提示 `lastRewind`。已结团只读，拒绝回溯与撤销。

命令：`history:page` 对所有查看者开放（结团后只读可用）；`history:preview-rewind` / `history:rewind` / `history:undo-rewind` 仅 GM 且团未结束；`history:archive` / `history:archive-items` / `history:audit` 仅 GM，结团后仍可只读查询。`history:archive` 返回回溯/撤销分组，`history:archive-items` 分页返回某次操作移出的条目，`history:audit` 分页返回已驳回/已丢弃发言。

## 账号、所有权与在线

- 统一账号表 `users`：`username_normalized` 全局唯一、`password_hash`、`role`（`admin` / `gm` / `pl`，创建后不可变）、`disabled_at`、`deleted_at`。角色之间无能力继承。
- 统一会话表 `user_sessions`：只存 token 哈希；登录成功撤销该账号全部旧会话并签发新 HttpOnly Cookie `cogm_session`。同浏览器多标签页共享 Cookie；新浏览器登录会顶替并断开旧连接。密码修改保留当前会话、撤销其他会话；admin 重置密码和禁用账号撤销全部会话。
- 无公开注册：`admin` 创建账号；首个 admin 由 `bun run setup:admin` 引导。至少保留一个可用 admin。软删除后用户名继续占用，可恢复。
- 匿名 OB：保留 `anonymous_players` 与 `player_tokens`，指纹签发 30 天 HttpOnly `player_token`；只能认领 OB。PC 席位必须由 `pl` 账号持有。
- 服务端 actor 为判别联合：`{ type: 'user', userId, role } | { type: 'anonymous', anonymousPlayerId }`。
- **所有权**：模组、团、人物、模板、媒体均带 `owner_id`。GM 列表/详情只查自己的资源；他人资源与不存在资源都返回 404。admin 不进入任何 GM/PL 内容路径。PC 人物归 PL（GM 预建后分配时转移所有者），NPC 始终归 GM。
- **软删除**：所有业务表带 `deleted_at`，运行时仓储不执行物理 `DELETE`；外键不使用运行时物理级联。已删除资源停止新引用，但旧团仍可读取当前已引用内容。每个所有者有隔离回收站与恢复接口；admin 回收站只含账号。实际媒体文件保留。
- 在线列表来自 WS 连接注册表（连接 ↔ 团 ↔ 席位持有者）。账号被顶替或禁用时按 userId 关闭全部连接。
- 踢出 = 团内禁入：`player:kick` 写入 `session_kicks`（按 `sessionId × 持有者`，`lifted_at` 为空即生效）并关闭该席位在本团的连接；生效期间认领返回 `SESSION_KICKED`（403），WS 握手直接下发 `session:kicked` 后以 4000 关闭。禁入只作用于该团。
- 拉黑 = 指纹写入黑名单表（含过期时间，NULL 为永久），HTTP 与 WS 握手均校验；无 Origin/Referer 的非浏览器客户端按现有来源策略处理。已通过账号会话鉴权的请求优先于指纹黑名单。
- 所有写接口（`/api/v1/{gm,pl,admin}/*` 的 POST/PATCH/PUT/DELETE）校验 Origin/Referer；GET 不受影响。

## 人物版本、提交与团内快照

- `characters` 保存当前姓名、背景、`sheet_json`、`owner_id`、`kind`、`rule_id`、`sheet_version`、`profile_version`、`version` 与来源字段；`character_versions` 保存追加式完整快照。
- 审核记录绑定 `sheet_version`；规则数值/技能/终生字段变化提升 `sheet_version` 并使旧审核过期，资料/立绘变化只提升 `profile_version`。
- 提交链接 `character_invites`：目标为模组或团，token 哈希存储，默认 7 天，可撤销；PL 登录后提交新建人物或已有同规则人物，生成 `character_reviews`。审核通过只建立模组关联或团内 PC 席位，不自动认领。
- `session_characters` 保存入团快照（姓名、背景、`sheet_json`、`base_sheet_version`、`base_profile_version`），检定与状态初始化读取团内快照而非主卡。主卡变化不自动同步；GM 通过差异预览与显式同步更新所选字段，不覆盖团内状态/成长。
- GM 修改规则声明的终生字段、结团成长确认都写入追加式 `character_audits` / `character_growth_entries`；成长确认对主卡技能做增量累加，历史团保持旧快照。
- 并发更新携带 `expectedVersion`；同字段冲突返回 409 与最新版本，增量成长可累计，禁止整卡静默覆盖。

## 模板

- `templates` 是独立模组快照，含当前内容（`template_scenes` / `template_tracks` / `template_handouts` / 设置 / `template_characters`）与 `current_version`；`template_versions` 保存显式另存后的不可变 JSON 快照。
- 直接编辑只改当前内容；实例化默认当前内容，也可指定历史版本。新建模组/团记录 `source_template_id` 与 `source_template_version`。
- 实例化为源模组创建全新的场景/曲目/情报行与新的 NPC 人物行，媒体资产可复用同一存储但逻辑引用互不影响；NPC 副本记录模板来源。
- “快速开团”在一个事务内创建模组 + 等待开始的团，允许暂无 PC；失败整体回滚。

## 前端路由（TanStack Router）

| 路径 | 视图 |
|---|---|
| `/` | 入口：输入/选择团号或链接；已登录按角色进入对应工作台 |
| `/login` | 统一登录（admin / gm / pl），成功后按角色跳转 |
| `/admin` | admin 控制台：账号、主题包、实例设置 |
| `/pl` | PL 工作台：我的人物、参与的团、提交记录、回收站、账号设置 |
| `/submit/$token` | PL 通过 GM 提交链接建卡或选择已有任务 |
| `/join/$sessionId` | 玩家进团：选 PC 或 OB 位（标题优先显示团名，未命名时回退模组名）；未登录 PC 先跳登录 |
| `/play/$sessionId` | 玩家沉浸视图 |
| `/gm` | GM 后台：模组/人物/团/模板/审核待办/回收站 |
| `/gm/session/$sessionId` | GM 控制台：控场、切场景/立绘/音乐、发放情报、演绎队列放行、历史与回溯、在线管理 |

选 TanStack Router 而非 React Router：路由参数与 search params 全类型安全，`$sessionId` 这类参数不会出现手写字符串取参的运行时错误，与 Eden Treaty / Drizzle / zod 的端到端类型安全路线一致。路由树按角色挂守卫：`/admin/*` 仅 admin，`/gm/*` 仅 gm，`/pl/*` 仅 pl；越权访问重定向到 `/login` 或 404。

## Excel 人物卡导入

GM 后台与 PL 工作台上传 `.xlsx` → 服务端 SheetJS 解析 → 按 `packages/shared` 的人物卡 zod schema 校验映射 → 返回预览确认 → 入库。解析器由 `RuleSystem` 按 `ruleId` 提供，未来适配其他规则时新增实现即可。上传与暂存记录带所有者；暂存记录软删除，不物理清理。

## 渲染与部署

- 场景画面用 DOM + CSS 实现（绝对定位立绘 + transition 切换表情/转场），不引入 Canvas/PixiJS；需要更复杂动画时再加 GSAP。
- 生产部署：`vite build` 产物由 Elysia 静态托管，单 Bun 进程提供 HTTP + WS，Docker 镜像基于 `oven/bun`。
- 已安装主题属于运行时数据，位于 `THEMES_DIR`（默认 `data/themes`），与数据库、上传媒资一并挂载持久卷；不进入镜像。
