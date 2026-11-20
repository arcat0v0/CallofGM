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

## 服务端持久化边界

- HTTP 与 WebSocket 路由通过组合根共享认证插件和无状态仓储。写入型实时命令用当前命令事务建立仓储，使业务写入、历史记录与 outbox 同步提交。
- 实时快照与在线列表共用持有者名称查询。快照与 BGM 控制共用音频读模型。语音广播每次按团一次读取团状态、有效席位与踢出状态，再按各连接的身份投影。
- Tier 3 保留实时事务协调器与多表读模型的直接持久化访问。清单限于 `realtime/session-command-executor.ts`、`realtime/session-event-bus.ts`、`realtime/presence-service.ts`，以及 `realtime/application/` 下的 `build-snapshot.ts`、`session-history.ts`、`history-recorder.ts`、`runtime-snapshot.ts`、`history-rewind-commands.ts`、`chat-message-mapper.ts`、`kicked-players.ts`。情报发放概览位于 `handouts/infrastructure/grant-overview.ts`。

`bun run check:boundaries` 在服务端检查模块公开入口、具体规则隔离与分层导入。检查覆盖静态导入、重新导出和字面量模块加载，并按共享规则目录识别具体规则命名空间。上面的 Tier 3 清单按文件限定，只豁免持久化依赖。客户端检查具体规则导入、规则 ID 硬编码与默认主题读取实时 Store 的边界。

## WebSocket 设计

- 每个团一个 topic：`session:{id}`。连接加入团即 `ws.subscribe`，广播用 `server.publish`。
- **定向消息**（如秘密情报）不走 topic，服务端按连接注册表向可见者逐连接推送。
- 消息信封：`{ eventId: number, type: string, payload: T }`，eventId 为团内单调递增序号。
- 事件可见范围 `visibility` 包括：`public`（全员）、`gmOnly`（仅 GM）、`pcPlayers`（GM + 有 PC 席位的玩家，用于 OB 不可见但 PC 可见的状态同步）、`playerOnly`（所有非 GM 连接，含 PC 与 OB）、`selectedPcIds`（指定 PC）与 `connectionOnly`（单连接）。投递、补发与快照共用同一套 `checkVisibility` 判定。
- **断线补发**：服务端为每个进行中的团在内存维护一个环形事件日志（近 N 条），日志条目带可见范围（全体 / 指定 PC 集合 / GM + PC 席位）。客户端（partysocket 自动重连）重连时携带 `lastEventId`，服务端按请求者身份过滤后补发缺失事件；缺口超出日志范围则下发全量快照（团名与可见性设置、请求者身份 `viewer`（是否 GM、席位 PC/OB）、当前场景、在场立绘及表情、阶段、音频状态、对该玩家可见的情报及其已读状态、对该玩家可见的各角色团内状态与人物卡、待其响应的鉴定请求、最近聊天区时间线及回看游标、最近一次回溯提示 `lastRewind`）。
- 新加入者直接走全量快照路径。
- 团内 NPC 编组走 REST：`POST /api/v1/gm/sessions/:id/npcs` 校验 GM 所有权、`kind=npc` 与规则一致，未关联模组时自动关联后写入团内人物快照；`DELETE /api/v1/gm/sessions/:id/npcs/:characterId` 只软删该团内快照。两者成功后向全团发送 `session:refresh`，不删除人物本体与历史。
- GM 舞台沿用 `play.stage` 的桌面视口布局，使立绘位置与玩家端一致；「玩家视角预览」复用同一舞台插槽但按模组 `themeId` 建立独立主题上下文，不改变 GM 界面主题，NPC 状态使用服务端公开投影。
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

已注册 CoC 7e（`coc7e`）与 D&D 第五版 2024（`dnd5r`）。**所有规则相关逻辑必须通过统一的规则系统接口接入，通用业务代码禁止硬编码任何具体规则的判定**（见 `AGENTS.md`）。

- 服务端以面向对象组织：`RuleSystem` 抽象类 + 每种规则一个实现类（`apps/server/src/rules/{ruleId}/`）。职责边界：
  - 不可变元数据：`id`、`name`、实现 `version`、核心兼容 `apiVersion`、`description`、`permanentSheetFields`、可选的 `permanentFieldRange`（`{ min, max }`）
  - 人物卡 schema、空卡构造、Excel 解析器与导入器
  - 必须实现鉴定选项校验、掷骰判定与同步预览投影。规则使用注入的 `RandomSource` 生成骰点，并返回鉴定引起的状态变更。
  - 理智、幸运与技能成长是独立的可选能力。既有 v1 命令调用对应能力，由规则实现决定鉴定与成长细则。
  - 团内状态的 schema 定义与初始化由规则拥有。初始化接收人物卡及团和人物标识。
  - 允许扩展项声明：CoC 允许自定义技能（名称/基础值/当前值），不允许自定义属性、公式、成功等级或特殊检定
  - 供结构化 UI 调用的规则动作定义（技能鉴定、理智检定等）；不解析聊天文本命令
- 服务端维护规则注册表 `ruleId → RuleSystem 实例`；模组、团、人物、模板各自记录 `ruleId`，创建时必须显式提交，创建后不可切换。服务端不提供默认规则。
- `GET /api/v1/rules` 暴露已注册且 `apiVersion` 兼容的元数据；前端选择器只消费该接口，不硬编码规则列表。
- 客户端由 `apps/client/src/rules/registry.ts` 按 `ruleId` 查找 `RuleComponent`。每个规则负责其人物卡、检定、状态编辑与事件展示，幸运和 Excel 导入等可选能力由组件声明。运行时界面通过注册表取用实现，默认主题通过现有主题 SDK 插槽属性取用数据。
- 通用层只保留规则无关能力：普通骰点表达式、事件广播与可见性、演绎队列、团状态机。
- `packages/shared` 按规则命名空间组织：通用 schema 在 `src/` 顶层，规则专属 schema 在 `src/rules/{ruleId}/` 下，以 `coc7e`、`dnd5r` 等命名空间导出。`RuleId` 协议为受限字符串，具体合法性由服务端注册表校验。
- 快照、日志与 WS 规则相关 payload 携带 `ruleId`，由对应规则模块的 zod schema 校验。
- 骰点与鉴定入口统一使用 `packages/shared` 定义的结构化 WS command：普通骰点由骰点面板提交表达式，玩家自主鉴定由人物卡提交技能标识，GM 鉴定请求由控制台创建并由目标玩家确认响应。聊天消息只承载文本，不参与规则动作解析。
- v1 鉴定信封须区分显式 `options` 和顶层难度、奖励骰、惩罚骰。CoC 7e 沿用顶层字段并拒绝显式 `options`，待响应请求继续只保存顶层选项。D&D 使用 `options` 并忽略这三个顶层字段。
- D&D 按 `packages/shared/src/rules/dnd5r/` 定义的人物卡、目录和规则指令运行，服务端实现位于 `apps/server/src/rules/dnd5r/`。普通鉴定沿用 `check:perform` / `check:request` / `check:respond`。可选 `options` 交规则校验，`check_requests.options_json` 保存已校验的请求选项以供重连和回溯。攻击会读取目标团内人物卡，结果省略目标 AC。
- `rule:action` 封装规则专属动作，由团所属 `RuleSystem` 校验和执行。通用层核验团状态、角色席位和阶段并持久化变更。D&D 用该指令处理遭遇、伤害、治疗、状态、资源和休整。遭遇写入 `sessions.rule_state_json`，以 `rule:state-changed` 广播，在快照携带 `ruleState`。迁移 `0008_rule_runtime` 添加这两个可空 JSON 列。
- 游戏指令通过绑定到当前指令事务的 `GameplayRepository` 读写团规则状态及角色团内状态。NPC 状态事件在写入后通过同一仓储读取公开字段配置。

- 客户端实时状态保留 `usePlayStore` 作为公开入口。`apps/client/src/stores/play/` 下的 Zustand 切片管理各业务状态，快照协调器和事件处理器负责路由 WebSocket 更新。页面继续使用现有选择器与 Store 方法，默认主题消费插槽属性。

## 掷骰与鉴定引擎

- 骰点表达式解析、随机数生成（`crypto.getRandomValues`）与判级全部在服务端，结果分配 eventId 广播进聊天区；客户端只提交意图：普通掷骰传表达式，技能鉴定传 `characterId + skillKey + 难度/奖惩骰`，目标值由服务端从库中人物卡查得。
- 公开的实时 `dice:rolled` / `check:resolved` 事件触发客户端舞台上的 3D 骰子动画。客户端使用 `apps/client/public/dice/` 的自包含 glTF 模型与 `orientations/` 四元数表，先翻滚再 slerp 到服务端结果对应朝向；渲染层是覆盖游玩视图/GM 控制台的全屏透明 WebGL 叠层，不套用浮岛卡片或小窗，避免裁切骰子。快照、历史分页与暗骰事件不触发动画。动画层通过主 WS 连接的 `onLiveEvent` 观察实时 `SessionEvent`，不新增第二条连接、不改变在线计数或命令连接，不生成结果，也不把物理模拟结果当作服务端判定。
- 判级规则（大成功/极难/困难/常规/失败/大失败、奖励惩罚骰取十位、难度阈值）由 CoC 7e 规则模块实现为纯函数（见"规则系统抽象"），类型定义在 `packages/shared` 的 `rules/coc7e/`，用 `bun test` 全覆盖。
- **暗骰**复用秘密情报的定向推送机制：结果事件进事件日志但可见范围 = 仅 GM，断线补发按同一套过滤；玩家响应暗骰鉴定请求时仅收到"已掷出"回执。
- **鉴定请求**：GM 创建请求（目标 PC、`skillKey`、规则专属选项、是否暗骰）→ 定向推送目标玩家 → 玩家确认后服务端校验存在待响应请求再掷骰。待响应请求随快照下发，重连不丢。
- **理智检定**：GM 发起时附损失表达式 `成功/失败`（如 `1/1d6`），服务端判定后自动掷损失、经统一的状态变更入口扣减团内 SAN，检定结果与状态变更作为两个事件先后广播。
- 阶段权限复用消息裁决逻辑：玩家自主掷骰按"场外发言"规则判允许与否；响应鉴定请求不受阶段限制。

## 角色团内状态

- `session_characters.state_json` 保存「团 × 角色」状态，由规则模块校验并按入团人物卡初始化。CoC 7e 保存 HP、MP、SAN、状态与成长标记。D&D 保存 HP、临时 HP、条件、力竭、死亡豁免、生命骰、法术位和资源。
- 团内状态经通用入口持久化并生成 `state:changed` 事件，按可见性广播和记录。规则模块计算变更与提示，人物卡同步预览也由规则投影数值。D&D 的 `recalculateStateOnSync` 将当前 HP 限制在新上限内，并按「新上限减去已花费次数，最低为 0」更新生命骰、法术位和仍存在的资源。契约魔法转用更高环阶时仍计入已花费次数。新增资源从满额开始，已移除的资源从团内状态移除。
- 可见性：PC 状态事件默认广播全员；团级设置「OB 可见 PC 数值」关闭后改为 `pcPlayers` 作用域（GM + PC 席位玩家），OB 连接收不到 `state:changed`，快照中的 PC 状态也为 null。
- NPC 状态按团内公开配置投影：GM 的 `state:changed` 保留完整状态并附带 `publicState` / `publicStateFields`；存在公开项时非 GM 连接收 `state:public-changed`（`playerOnly`，内容仅为投影）。快照使用同一投影：GM 附带公开视图，玩家与 OB 的 NPC `state` 为投影或 null。公开配置经 `npc:state-visibility` 修改，产生 GM 配置事件与玩家状态事件；玩家投影不进入历史或检查点，公开配置不参与回溯。全量快照包含对请求者可见的全部角色状态。
- **暗骰作用域贯穿状态变更**：暗骰鉴定成功写入的成长标记记入 `hiddenGrowthMarks`，整次 `state:changed` / `state:hint` 仅发 GM；状态视图由规则模块按观察者裁剪（`viewSessionState`），玩家快照与广播都不含暗骰技能名。非暗骰状态变更保持公开。

## 音频同步（GM 控制）

服务端为每个团维护权威音频状态：

```
BgmState = { trackId, playing, volume, mode: off|single|list|shuffle, seekOffsetMs, startedAtMs(服务器时钟), version }
```

- GM 发出指令（播放/暂停/切歌/音量/淡入淡出/seek）→ 服务端更新状态并广播 → 各客户端 Howler 执行。
- `BgmPlayback` 管理播放状态、时间和版本，指令通过行为方法更新它，写库和广播共用一次值快照。
- 中途加入/重连者从快照恢复：播放位置 = `seekOffsetMs + (serverNow - startedAtMs)`，仅 `single` 模式对曲目时长取模，其余模式限制到曲末。
- `audio:bgm` 的 `mode` 指令切换模式并固化当前进度；`next` / `previous` 由服务端从当前模组未删除 BGM 中选取，列表排序为 `createdAt ASC, id ASC`。随机模式由服务端 `RandomSource` 选择且多首时排除当前曲目；没有候选则停止。
- GM `usePlayAudio` 的 Howler `onend` 回报 `ended + expectedVersion`，不依赖声音面板是否打开。服务端拒绝非 GM、陈旧版本、未到曲末与已暂停的回报，已知时长允许 1 秒结束误差；时长未知时信任 GM 播放器的实际结束。`off` 固化停止，`list`/`shuffle` 从头播放所选曲目，事务写库后通过既有事件总线广播。客户端同版本只回报一次，断线恢复可重试；新版本或重连快照停在曲末时补报。GM 离线期间不运行独立切歌调度器。
- `session_audio_state.mode` 替代旧 `loop` 字段；迁移 `0006_bgm_playback_modes` 先按旧值写入 `single`/`off`，再移除旧列，不保留双轨协议。部署前后端须同时更新；已有团的曲目、音量、进度与版本保留。
- 上传音频的 BGM 快照、事件与 SE 事件附带媒体实际 `audioMimeType`，客户端据此设置 Howler `format`（WAV/MP3/OGG/FLAC/M4A）；平台音频使用 MP3 格式提示，实际解码由 HTML5 Audio 按响应处理。内部媒体/平台代理 URL 无扩展名，不能仅依赖 Howler 从 URL 推断格式。
- **SE 音效**为一次性广播（fire-and-forget），不进快照。
- 玩家本地可静音/调本地音量，不影响他人；进团点击作为浏览器音频解锁手势。

### WebRTC 语音与临时信令

- 语音复用 `/api/v1/sessions/:id/ws`，协议在 `packages/shared/src/voice.ts` 定义，客户端/服务端消息均运行时 zod 校验。信封使用 `protocolVersion: 1` 与 `requestId`，但不使用 `ClientCommand`，不分配 `eventId`，不写 outbox、历史、聊天或补发日志。`voice:join` 携带权威 `voice:state.roomId`，避免状态下发与自动重入之间跨开启竞态；不匹配返回 `VOICE_ROOM_CHANGED`。
- `VoiceService` 在单进程内保存当前开启、连接成员与按席位 claim id 索引的授权/静音。归属 GM 在准备中/进行中开启后，GM 断线不关闭；显式关闭、结团和进程重启清除。成员 UUID 每次加入重新签发，连接注册表的所有注销路径同步撤销成员，目标发送前再次核验来源、目标、团、开启与 active 连接。
- `SessionLifecycle` 统一判断状态转换、阶段变更、席位认领、名单、同步、成长确认和命令的状态限制。语音是否可用、阶段是否允许发言与 GM 对成员的授权和静音分别判定。
- 同一 claim/GM 同时只能有一个媒体连接。准入在同团串行队列中原子完成，GM 保留一个名额，PC/OB 不抢占。`sessions.voice_limit` 仅保存可空单团上限；实例 `VOICE_MAX_PARTICIPANTS` 默认 8，实际取两者较小值。运行时成员、房间 UUID、SDP/ICE 和静音不持久化。
- 服务端先完成普通 WS 快照 hydration，再下发 `voice:state`，之后才接受信令；加入时先更新成员状态再允许后续信令。SDP offer/answer 与 ICE candidate（包括 glare 中双向 candidate）只向同开启的目标成员单播。信令采用独立 5 秒 256 帧突发上限，其他语音控制与无效帧复用普通命令 5 秒 50 帧上限。
- GM 获得完整管理列表，已加入成员获得对等列表，未加入的非 GM 只获得人数与自身可用状态。OB 默认 listen-only，授权与 GM 静音在同一 claim 的重连/主动离开再入间保留；替换、释放、踢出清除。阶段、回溯与撤销通过事件投递后的刷新重算 `canSpeak`，已结束团关闭整个语音开启。
- 浏览器按权威状态在发送端停止/禁用采集与轨道，并在接收端 mute、pause、disable 对应远端轨道。服务端不能约束相互串通的客户端再次转发已经收到的媒体，语音不是对恶意合谋参与者的保密通道。
- `VoiceController` 在本地保存音频偏好并管理采集、麦克风测试及按键说话。采集链读取音轨报告的实际约束，使用 48 kHz AudioWorklet 运行 RNNoise WASM，并支持噪声门与 Web Audio 压限。RNNoise 生效时请求关闭浏览器降噪，增强处理不可用时使用可用的浏览器采集与处理。通话发送与本地测试使用同一套采集处理逻辑，回听仅连接本机音频输出。
- 按键说话由客户端按发言权限及按住状态控制发送轨道。松开按键、窗口失焦或页面隐藏时，发送轨道静音，麦克风采集保持就绪。用户关闭麦克风、离开语音或失去发言权限时，客户端释放采集资源。
- WebRTC 优先协商单声道 Opus。浏览器支持时，RTP 发送端设置 32 kbps 码率上限。DTX（不连续传输）与带内 FEC（前向纠错）取决于浏览器能力和协商结果。
- ICE 配置默认空，浏览器可直接尝试 host candidate。`VOICE_STUN_URLS` 配置逗号分隔 STUN；`VOICE_TURN_URLS` 与 `VOICE_TURN_REST_SECRET` 成对配置独立 TURN，服务端按 `VOICE_TURN_TTL_SECONDS`（默认 600）生成 coturn REST 用户名与 HMAC-SHA1 临时凭据，仅向已加入成员下发。长期 REST secret 仅存在服务端环境，不下发前端。
- 语音弱网、WS-only 中断与切网的隔离 Chromium 复验方法、实测证据和边界见 [WebRTC 语音弱网与切网验证](voice-network-testing.md)。

### 语音诊断与隐私

- `packages/shared/src/voice-diagnostics.ts` 定义严格的同意、样本、事件、批次与 GM 报告 zod 契约。单批样本和事件各最多 256 条，样本 HTTP 请求体上限 512 KiB；候选类型/协议与 RTC 状态使用白名单，额外字段、非有限或负指标、非整数增量均拒绝。
- `PUT /api/v1/sessions/:id/voice-diagnostics/consent`、`POST .../revoke` 与 `POST .../samples` 复用现有 actor、Origin 和版本约定。`VoiceService` 的内存同意表绑定当前开启、active 已加入成员与 `roomId + memberId`；成员离开、连接注销、席位失效、新成员 ID 和新开启都会使旧同意失效。上传还必须匹配已登记的 consentVersion 与 acceptedAt，服务端独立记录 receivedAt，数据库写失败不返回成功。
- `GET /api/v1/gm/sessions/:id/voice-diagnostics?limit=1..200` 仅归属 GM 可读，按 receivedAt 与插入顺序最新优先，返回结构化原始 RTC 指标和事件，不返回 actor 名称、账户 ID 或 IP；admin 没有额外权限。撤销只阻止新批次，历史报告仍可导出。
- 迁移 `0009_flashy_bloodscream` 新增 `voice_diagnostic_reports`：`session_id`、`room_id`、`member_id`、同意版本与时间、接收时间、完整最小化 `payload_json` 和 `deleted_at`。不保存音频、聊天、IP、SDP、ICE 地址、设备名、设备 ID 或浏览器指纹；同意本身不入库，报告遵循软删除，不做自动物理清理。
- 客户端默认不启动诊断计时器或上传；明确同意并注册当前 `roomId + memberId` 后，按 5 秒逐 peer 采样、15 秒批量上报。样本使用 RTP 累计值差分与 transport 选中 candidate pair 的白名单元数据，不读取或保存地址；远端 RMS 复用现有 `VoiceActivityMonitor`。页面隐藏/离开只在同意仍有效时尝试 keepalive flush。
- 样本 HTTP 失败仅在同一 member 内进行有界重试并保留有界队列；member 离开、变化或 room 切换会清空待传队列，不承诺跨 member 保留。WS open 在 socket、成员与同意就绪后只记录一次，WS close 的 `state` 记录 numeric close code，不记录 reason。当前诊断不采集 codec、Opus DTX/FEC 或 sender encoding 细节，这些是后续协议扩展前无法由报告判断的限制。

### 曲目来源与平台接口

- `OfficialMusicService` 按平台选择适配器。适配器解析引用并实现平台 API 和音频主机策略，`MusicHttpClient` 统一执行超时、重定向、Range 和流大小限制。
- `tracks.source` 为 `upload | netease | qq`。上传曲目引用 `audio_asset_id`；平台曲目的该字段为 NULL，并保存 `external_id`、`artists_json`、`album`、`source_url`。临时 CDN URL、vkey、Cookie 与账号凭据不入库。`template_tracks` 和模板 JSON 快照保存同一来源信息，实例化生成新曲目行。
- 搜索：`GET /api/v1/gm/music/search?provider=netease|qq&query=<关键词>&limit=1..20`，返回 `{ items: MusicTrackDto[] }`。搜索结果的 `availability` 为 `unknown`，不把关键词命中当作可播保证。
- 解析：`POST /api/v1/gm/music/resolve`，body 为 `{ provider, reference }`；`reference` 只接受平台歌曲 ID 或严格白名单的官方歌曲页。服务端读取官方元数据并实际读取首字节，成功后返回 `availability=available`。
- 添加：沿用 `POST /api/v1/gm/modules/:id/tracks`。上传 body 保持 `{ source?: "upload", name, audioAssetId, type, duration }`；平台 body 为 `{ source: "netease" | "qq", reference, type, name? }`，名称、艺术家、专辑、时长和 canonical `sourceUrl` 以服务端解析结果为准，显式 `name` 可覆盖曲名。添加前同样验证真实音频首字节。
- 歌单解析：`POST /api/v1/gm/music/playlists/resolve`，body 为 `{ provider, reference, offset?, limit? }`，`offset` 默认 0，`limit` 默认且最大 50；仅接受数字歌单 ID 或严格白名单的官方歌单页。返回 `MusicPlaylistDto { provider, playlistId, name, coverUrl, description, creator, sourceUrl, totalCount, items, nextOffset }`，`totalCount` 与 `nextOffset` 可空，曲目可播性一律为 `unknown`，不请求逐首音频流。空歌单、不可公开访问/不存在歌单和非法引用分别返回 `MUSIC_PLAYLIST_EMPTY`、`MUSIC_PLAYLIST_NOT_FOUND`、`MUSIC_PLAYLIST_REFERENCE_INVALID`。
- 网易云歌单通过官方 `v6/playlist/detail` 的完整 `trackIds` 与每页 `song/detail` 分块获取，按 ID 列表重排；QQ 音乐通过官方 `CgiGetDiss` 的 `song_begin/song_num` 分块获取。客户端可按 `nextOffset` 串行连续加载并跨页保留选择；整份导入必须加载至 `nextOffset=null` 且选择全部，部分导入只能包含当前已加载并勾选的歌曲且须明确标示范围，不能只导入第一页却宣称完整。客户端先在所选歌曲内按官方歌曲 ID 去重，再按模组内 `provider + externalId` 去重，最后逐首调用现有 `POST /api/v1/gm/modules/:id/tracks`，以获得真实进度与部分失败；没有歌单持久化实体、持续同步或批量长事务，数据库结构不变。
- `TrackDto` 增加 `source`、`externalId`、`artists`、`album`、`sourceUrl`，`audioAssetId` 对平台曲目为 null。BGM 快照/事件与 SE 事件增加内部 `playbackUrl`：上传曲目为 `/api/v1/media/:assetId`，平台曲目为 `/api/v1/music/tracks/:trackId/stream`。客户端不接触临时官方直链。
- 平台流接口仅允许曲目所属模组的 GM 或在该模组团内持有效席位的玩家/OB 读取，其他 GM 的资源统一 404。接口接受单个 `Range: bytes=start-end`（也支持开放尾部/后缀范围），转发官方 200/206、Content-Length、Content-Range 与 Accept-Ranges；多重 Range 返回 416。
- 代理只从代码内官方端点构造目标：网易云 `music.163.com` 与 `*.music.126.net`，QQ 音乐 `*.stream.qqmusic.qq.com` / `aqqmusic.tc.qq.com`。每次重定向重新校验 hostname，禁止凭据、端口、非 HTTPS 与非白名单目标；官方返回的 HTTP CDN 地址仅升级 HTTPS 后读取。没有任意 URL 代理入口。
- 请求/流空闲超时 10 秒，最多 5 次目标校验（含初始地址），音频上限 64 MiB，Content-Length、Content-Range 总大小与实际流字节均受限，Content-Type 必须为 `audio/*`。QQ 匿名 vkey 返回合法响应但空 `purl` 时，最多重试 3 次且每次使用新的匿名 guid；仍为空、上游 401/403/404/451、网易云 404 跳转映射为 `MUSIC_UNAVAILABLE`；超时、上游故障、非法响应与超限分别返回稳定错误，不假播放。
- 官方公开接口本身没有稳定性或永久版权保证；搜索、添加与每次播放都可能遇到平台变更。默认确定性测试使用受控 Provider，真实只读网络测试独立为 `bun run --cwd apps/server test:music:network`，不使用任何生产凭据。

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
- `session_runtime_checkpoints`：`(sessionId, eventId)` → 可回溯运行态 JSON（阶段、当前场景、人物表情与团内状态、鉴定请求、规则运行态、情报发放及接收者/已读）。建团时写入 `eventId = 0` 的基线检查点。
- `session_rewinds`：回溯/撤销操作记录，含 `action`、锚点与锚点时间、回溯前水位 `headEventIdBefore`、本次产生的 `rewindEventId`、撤销目标 `targetRewindId`、`reason`、归档计数与 `undoneAt`。
- `session_messages` 增加 `archived_at` / `archived_by_rewind_id`；已驳回/已丢弃发言不进入时间线，只由 GM 审计查询读取。

写入时机：

- 事件总线在分配 `eventId` 后、事务提交前写历史行。常规条目包括掷骰与鉴定、状态变更、规则运行态变更（`rule:state-changed`）、阶段和场景变化、表情、情报和回溯。`state:changed` 仅进入 GM 历史，`session:rewound` 不可作锚点。
- 影响运行态的事件在事务内写检查点，包括未进入常规时间线的 `check:requested`。不产生事件但改变运行态的命令（如 `handout:read`）覆盖当前水位的检查点。
- 不做事后回填；历史功能上线前的旧开发数据不保证可读。

回溯与撤销：

- 仅 GM。`history:preview-rewind` 返回预览（将被撤销的条目与状态变化），`history:rewind` 在二次确认后执行；锚点必须是当前活动时间线中的条目。
- 以锚点之前最近的检查点恢复运行态，包括团阶段、角色团内状态、场景指针、人物表情、鉴定请求、规则运行态与情报发放/接收者/已读。锚点条目及其之后的时间线内容被标记归档，已呈现消息一并移出活动时间线。
- 不恢复 BGM/SE、舞台布局与缩放、席位认领、踢人/黑名单/在线状态、团可见性设置与团内 NPC 编组。
- `RuleSystem.reconcileRuleState` 按当前团内名单修正规则运行态。NPC 移出时同步写入名单与规则运行态，然后发送 `session:refresh`。回溯与撤销按当前名单修正检查点中的规则运行态，避免已移出的 NPC 回到先攻顺序。
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
- 客户端规则组件声明背景来自人物卡时（CoC 7e：`backgroundSource=sheet`），顶层 `background` 是保存时由规则卡派生的展示摘要；服务端仍按请求字段独立存储，不反向推导，客户端不得为该规则提供第二套背景编辑入口。
- 审核记录绑定 `sheet_version`；规则数值/技能/终生字段变化提升 `sheet_version` 并使旧审核过期，资料/立绘变化只提升 `profile_version`。
- 提交链接 `character_invites`：目标为模组或团，token 哈希存储，默认 7 天，可撤销；PL 登录后提交新建人物或已有同规则人物，生成 `character_reviews`。审核通过只建立模组关联或团内 PC 席位，不自动认领。
- `session_characters` 保存入团快照（姓名、背景、`sheet_json`、`base_sheet_version`、`base_profile_version`），检定与状态初始化读取团内快照。主卡变化不会自动同步。GM 通过差异预览与显式同步更新所选字段，规则模块在同步规则卡时按新卡调整团内状态上限。
- GM 修改规则声明的终生字段、结团成长确认都写入追加式 `character_audits` / `character_growth_entries`；成长确认对主卡技能做增量累加，历史团保持旧快照。
- 并发更新携带 `expectedVersion`；同字段冲突返回 409 与最新版本，增量成长可累计，禁止整卡静默覆盖。

## 模板

- `templates` 是独立模组快照，含当前内容（`template_scenes` / `template_tracks` / `template_handouts` / 设置 / `template_characters`）与 `current_version`；`template_versions` 保存显式另存后的不可变 JSON 快照。
- 直接编辑只改当前内容；实例化默认当前内容，也可指定历史版本。新建模组/团记录 `source_template_id` 与 `source_template_version`。
- 实例化为源模组创建全新的场景/曲目/情报行与新的 NPC 人物行，媒体资产可复用同一存储但逻辑引用互不影响；NPC 副本记录模板来源。
- “快速开团”在一个事务内创建模组 + 等待开始的团，允许暂无 PC；失败整体回滚。

## 前端路由（TanStack Router）

| 路径                     | 视图                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `/`                      | 入口：输入/选择团号或链接；已登录按角色进入对应工作台                                |
| `/login`                 | 统一登录（admin / gm / pl），成功后按角色跳转                                        |
| `/admin`                 | admin 控制台：账号、主题包、实例设置                                                 |
| `/pl`                    | PL 工作台：我的人物、参与的团、提交记录、回收站、账号设置                            |
| `/submit/$token`         | PL 通过 GM 提交链接建卡或选择已有任务                                                |
| `/join/$sessionId`       | 玩家进团：选 PC 或 OB 位（标题优先显示团名，未命名时回退模组名）；未登录 PC 先跳登录 |
| `/play/$sessionId`       | 玩家沉浸视图                                                                         |
| `/gm`                    | GM 后台：模组/人物/团/模板/审核待办/回收站                                           |
| `/gm/session/$sessionId` | GM 控制台：控场、切场景/立绘/音乐、发放情报、演绎队列放行、历史与回溯、在线管理      |

选 TanStack Router 而非 React Router：路由参数与 search params 全类型安全，`$sessionId` 这类参数不会出现手写字符串取参的运行时错误，与 Eden Treaty / Drizzle / zod 的端到端类型安全路线一致。路由树按角色挂守卫：`/admin/*` 仅 admin，`/gm/*` 仅 gm，`/pl/*` 仅 pl；未登录访问重定向到 `/login`，已登录但角色不符时重定向到当前角色自己的工作台，不继承其他角色权限。

## Excel 人物卡导入

GM 后台与 PL 工作台上传 `.xlsx` → 服务端 SheetJS 解析 → 按 `packages/shared` 的人物卡 zod schema 校验映射 → 返回预览确认 → 入库。解析器由 `RuleSystem` 按 `ruleId` 提供，未来适配其他规则时新增实现即可。上传与暂存记录带所有者；暂存记录软删除，不物理清理。

## 渲染与部署

- 场景画面用 DOM + CSS 实现（绝对定位立绘 + transition 切换表情/转场），不引入 Canvas/PixiJS；需要更复杂动画时再加 GSAP。
- 生产部署：`vite build` 产物由 Elysia 静态托管，单 Bun 进程提供 HTTP + WS，Docker 镜像基于 `oven/bun`。
- 已安装主题属于运行时数据，位于 `THEMES_DIR`（默认 `data/themes`），与数据库、上传媒资一并挂载持久卷；不进入镜像。
