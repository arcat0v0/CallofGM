# CoGM 后端完整工程计划

> 状态：实施中（Phase 0–9 已完成，Phase 10 待实施）
>
> 范围：CoGM v1（CoC 7e）
>
> 基线：`docs/product.md`、`docs/tech-stack.md`、`docs/architecture.md`
>
> 技术栈：Bun + Elysia + Eden Treaty + Bun WebSocket + Drizzle + `bun:sqlite` + zod + SheetJS
>
> 当前进度备注：
> - Phase 0–5（工程基线/身份授权/模组资源/规则系统/团与席位/WS 核心）已完成。
> - Phase 6–9（聊天与演绎队列/骰点鉴定与团内状态/场景表情音频/情报在线黑名单）已完成，
>   WS 命令经 `SessionCommandExecutor` 统一分发到各模块 CommandHandler，
>   快照与补发按请求者可见性过滤（秘密情报/暗骰/NPC 状态不出现在无权限字节流中）。
> - Phase 10（生产化：静态托管、Docker、备份演练、全量回归）待实施。

## 1. 目标

本计划的目标不是尽快堆出一组接口，而是建立一个能够持续扩展规则、实时玩法和后台管理能力的后端工程基线。

后端必须满足以下质量目标：

- **服务端权威**：身份、发言权限、团状态机、规则判定、随机数、角色团内状态、情报可见性都由服务端裁决。
- **边界清晰**：HTTP、WebSocket、数据库和文件系统是适配器；业务规则不依赖 Elysia、Drizzle 或 Bun WebSocket 上下文。
- **规则可扩展**：通用业务只依赖 `RuleSystem`，不得硬编码 CoC 7e 的人物卡、判级、状态或命令。
- **一致性可靠**：同一个团的实时指令按确定顺序执行；数据库提交成功后才允许广播事件。
- **隐私默认安全**：秘密情报、暗骰、NPC 状态和待呈现队列从查询、快照、补发到实时推送共用同一套服务端可见性策略。
- **可测试**：时钟、随机数、ID、存储和事件发布均可替换；核心用例不需要启动监听端口即可测试。
- **适度抽象**：只为真实变化点建立端口，不创建无业务语义的万能 Controller、Service 或 Repository。
- **可演进**：v1 保持单 Bun 进程和 SQLite；代码边界允许未来替换存储或实时基础设施，但不提前引入 Redis、消息队列和微服务。

## 2. 非目标

- v1 不拆分微服务，不引入分布式事务。
- v1 不引入 Socket.IO、React Router、Next.js、Nuxt 或其他已否决方案。
- v1 不自动化对抗鉴定和成长鉴定。
- v1 不支持撤回已发放情报。
- v1 不假设浏览器指纹是可靠身份；玩家匿名 token 才是会话身份主依据。
- 转场动画、玩家本地立绘预览、浏览器音频解锁手势和本地静音属于客户端职责；后端只提供所需素材、权威状态和事件。
- 不为了“看起来分层”给每个简单函数创建 interface/class。

## 3. 总体架构：模块化单体

采用**按业务模块组织的模块化单体**。所有模块部署在一个 Bun 进程内，共用 SQLite，但必须遵守显式依赖边界。

```text
HTTP / WebSocket transport
            |
            v
Application use cases  ----->  Ports
            |                    ^
            v                    |
Domain / policies        Infrastructure adapters
                                  |
                         Drizzle / WS / filesystem
```

### 3.1 四类代码职责

| 层 | 职责 | 禁止事项 |
|---|---|---|
| `domain` | 实体、值对象、状态机、业务策略、领域错误 | 不导入 Elysia、Drizzle、Bun WebSocket，不读环境变量 |
| `application` | 编排用例、权限检查、事务边界、调用规则系统和端口 | 不直接写 SQL，不构造 HTTP Response，不直接操作 socket |
| `infrastructure` | Drizzle 仓储、文件存储、token/hash、事件发布等端口实现 | 不决定业务权限，不复制领域规则 |
| `transport` | zod 校验、身份上下文解析、调用用例、DTO 映射 | 不写业务分支，不直接访问数据库 |

依赖只能向内：`transport` 和 `infrastructure` 可以依赖 `application/domain`，反向依赖禁止。所有实现由 composition root 注入。

### 3.2 模块边界

| 模块 | 负责内容 |
|---|---|
| `identity` | GM 登录会话、匿名玩家 token、身份上下文 |
| `catalog` | 模组、场景、音乐、情报元数据、媒体关联 |
| `characters` | PC/NPC、人物卡、立绘、表情、Excel 导入确认 |
| `sessions` | 团创建、参与人物、认领、团状态机、阶段、快照基础 |
| `chat` | OOC/RP 发言、演绎队列、放行排序、聊天记录 |
| `gameplay` | 普通骰点、技能鉴定、鉴定请求、理智检定、团内状态 |
| `handouts` | 情报发放记录、追加可见者、可见列表 |
| `moderation` | 在线列表、踢人、黑名单 |
| `rules` | `RuleSystem` 抽象、注册表、CoC 7e 实现 |
| `realtime` | 连接注册、团 topic、事件序号、补发、快照协调、定向投递 |
| `media` | 本地文件存储、类型/大小校验、授权读取、清理 |

`realtime` 和 `media` 是后端平台能力，但仍通过端口服务于业务模块。它们不能成为放置任意业务逻辑的“公共杂物间”。

## 4. 推荐目录结构

```text
apps/server/
├── drizzle.config.ts
├── migrations/
├── src/
│   ├── index.ts                     # 仅启动、监听、优雅退出
│   ├── app.ts                       # createApp，组装 Elysia，不 listen
│   ├── bootstrap/
│   │   ├── container.ts             # composition root，显式构造依赖
│   │   └── startup.ts               # 迁移检查、恢复 outbox、启动任务
│   ├── config/
│   │   ├── env.ts                   # zod 校验环境变量
│   │   └── types.ts
│   ├── platform/
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── transaction.ts
│   │   │   └── schema/              # 按模块拆分 Drizzle table
│   │   ├── errors/
│   │   ├── logging/
│   │   ├── security/
│   │   └── observability/
│   ├── modules/
│   │   ├── identity/
│   │   ├── catalog/
│   │   ├── characters/
│   │   ├── sessions/
│   │   ├── chat/
│   │   ├── gameplay/
│   │   ├── handouts/
│   │   ├── moderation/
│   │   ├── realtime/
│   │   └── media/
│   └── rules/
│       ├── rule-system.ts
│       ├── registry.ts
│       └── coc7e/
└── tests/
    ├── helpers/
    ├── integration/
    ├── contract/
    └── e2e/
```

业务模块按实际复杂度使用以下子目录，不强制为空模块创建无意义文件：

```text
modules/chat/
├── domain/
│   ├── message-policy.ts
│   └── errors.ts
├── application/
│   ├── ports.ts
│   ├── send-message.ts
│   ├── release-message.ts
│   └── discard-message.ts
├── infrastructure/
│   └── drizzle-chat-repository.ts
├── transport/
│   └── ws-chat-handlers.ts
└── index.ts                         # 仅公开模块 API
```

每个模块外部只能从模块 `index.ts` 导入。增加一个轻量边界检查脚本，禁止跨模块导入内部路径。

## 5. 核心工程约定

### 5.1 用例而不是胖 Service

每个写操作对应一个带业务名称的用例，例如：

- `CreateSession`
- `TransitionSessionStatus`
- `ClaimCharacterSeat`
- `SendChatMessage`
- `ReleaseQueuedMessage`
- `RespondToCheckRequest`
- `GrantHandout`
- `UpdateBgmState`
- `BanFingerprint`

用例输入必须是经过 transport 校验后的普通对象，并显式携带 `ActorContext`。用例返回领域结果或明确的输出 DTO，不返回 Elysia `Context`/`Response`。

查询与写入分开命名：写操作使用命令型用例，读取使用 `Get/List/Build` 查询服务。无需引入完整 CQRS 框架。

### 5.2 显式端口

只为外部副作用或需要替换的依赖定义端口：

- `Clock`
- `IdGenerator`
- `RandomSource`
- `TransactionRunner`
- 各业务命名的 Repository
- `MediaStorage`
- `SessionEventPublisher`
- `ConnectionRegistry`
- `PasswordVerifier` / `TokenHasher`

禁止创建 `BaseRepository<T>`、`GenericCrudService<T>` 或全局 service locator。仓储接口必须表达业务查询，例如 `findPendingBySession`、`claimSeatIfAvailable`，而不是把任意 SQL 能力泄露给 application 层。

### 5.3 错误模型

定义稳定的应用错误码：

```text
AUTH_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
VALIDATION_FAILED
SESSION_STATE_INVALID
SESSION_PHASE_FORBIDS_ACTION
SEAT_ALREADY_CLAIMED
CHECK_REQUEST_ALREADY_RESOLVED
RULE_ACTION_UNSUPPORTED
RATE_LIMITED
```

- domain/application 抛出带 `code`、安全消息和必要 metadata 的受控错误。
- HTTP 适配器统一映射为 4xx/5xx 响应。
- WS 适配器统一映射为仅发给发起者的 `command:rejected`。
- 内部异常记录完整日志，对客户端只返回稳定错误码和 request/command ID。
- 禁止把数据库错误、文件路径、堆栈或 zod 内部结构直接暴露到生产响应。

### 5.4 时间、ID 与随机数

- 业务代码禁止直接调用 `Date.now()`、`Math.random()` 或到处生成 UUID。
- 注入 `Clock`、`IdGenerator`、`RandomSource`。
- 骰点生产实现使用密码学安全随机源；测试使用确定序列。
- 数据库存 UTC epoch milliseconds；API 输出 ISO 8601。

## 6. `packages/shared` 边界

`packages/shared` 是客户端与服务端协议的单一事实来源，只放：

- HTTP 请求/响应 zod schema
- WS command/event/snapshot zod schema
- 通用枚举和 DTO
- 规则专属的传输 schema，置于 `rules/{ruleId}/`
- 从 schema 推导的 TypeScript 类型

禁止放：

- Drizzle 表或数据库行类型
- Repository、数据库连接、文件系统代码
- 服务端密钥或内部错误详情
- 需要数据库才能执行的业务逻辑

所有外部输入在 transport 边界验证一次；人物卡 JSON 和团内状态 JSON 在写库前及读库后再由对应 `RuleSystem` 验证，防止历史数据漂移。

## 7. 规则系统设计

### 7.1 抽象职责

服务端建立真正的 `RuleSystem` 抽象和注册表。示意接口如下，最终签名以测试驱动调整：

```ts
abstract class RuleSystem<TSheet, TSessionState> {
  abstract readonly id: RuleId;
  abstract readonly characterSheetSchema: z.ZodType<TSheet>;
  abstract readonly sessionStateSchema: z.ZodType<TSessionState>;

  abstract parseCharacterSheet(input: ArrayBuffer): Promise<CharacterSheetPreview<TSheet>>;
  abstract initializeSessionState(sheet: TSheet): TSessionState;
  abstract evaluateSkillCheck(input: SkillCheckInput, random: RandomSource): SkillCheckResult;
  abstract executeSpecialAction(input: RuleActionInput, deps: RuleActionDependencies): RuleActionResult;
  abstract getChatCommands(): readonly RuleCommandDefinition[];
}
```

边界要求：

- `RuleSystem` 只处理规则逻辑，不查询数据库、不鉴权、不广播。
- application 用例负责加载人物卡/团内状态、验证操作者、调用规则系统、持久化和生成事件。
- `RuleRegistry.get(ruleId)` 是通用业务取得规则实现的唯一入口。
- 模组记录 `ruleId`，团从模组继承并在创建后不可静默改变。
- 普通骰点表达式属于通用 `DiceEngine`；`.ra`、`.sc` 等命令由 CoC 7e 注册。
- 规则 JSON 携带 `schemaVersion`，未来升级由对应规则实现负责迁移。

### 7.2 CoC 7e 实现清单

- 完整人物卡 schema 与技能键标准化
- Excel 模板识别、字段映射、错误定位、预览
- HP/MP/SAN 初始值推导
- 普通、困难、极难、大成功、大失败判级
- 0–2 奖励骰/惩罚骰
- GM 指定难度
- SAN 检定及成功/失败损失表达式
- 成长标记写入意图
- `.ra`、`.sc` 等命令解析
- 所有边界值的确定性单元测试

## 8. 数据持久化设计

### 8.1 SQLite 与迁移策略

- Drizzle schema 是数据库结构的代码事实来源，SQL migration 必须入库。
- 开发通过 `bunx drizzle-kit generate` 生成迁移并人工审阅。
- 生产只允许执行已提交的 `migrate`，禁止 `push`。
- 启动时检查 migration 状态；生产环境不应在未知 schema 上继续提供写服务。
- 启用 `foreign_keys`、WAL 和合理的 `busy_timeout`；事务保持短小，不在事务内解析 Excel、写大文件或等待网络。
- 每次生产迁移前先备份 SQLite 文件；破坏性迁移需要独立回滚/恢复说明。

### 8.2 概念数据表

最终字段以 migration 和用例测试为准，以下是必须覆盖的实体边界。

#### 身份与管理

- `gm_login_sessions`：GM 登录 token hash、过期时间、撤销时间
- `anonymous_players`：匿名玩家 ID、指纹 hash、首次/最后活动时间
- `player_tokens`：玩家 opaque token hash、过期/撤销状态
- `blacklist_entries`：指纹 hash、原因、过期时间、创建时间

v1 使用单 GM 密码配置，数据库只保存登录会话，不保存明文密码或原始 token。

#### 模组资源

- `modules`：名称、说明、`rule_id`
- `media_assets`：用途、storage key、MIME、大小、hash、元数据
- `scenes`：模组、背景资源、名称、排序
- `tracks`：模组、音频资源、BGM/SE、时长、元数据
- `handouts`：模组、标题、正文、可选图片资源

#### 人物

- `characters`：人物名、PC/NPC、`rule_id`、版本化人物卡 JSON
- `character_portraits`：人物、表情 key、立绘资源、是否默认
- `module_characters`：模组与可用人物关联，支持人物复用

#### 团与认领

- `sessions`：模组、状态、阶段、当前场景、最后 eventId、时间戳
- `session_characters`：团内人物、PC/NPC、当前表情、版本化状态 JSON
- `session_claims`：匿名玩家、PC/OB 身份、认领人物、释放时间
- `session_audio_state`：权威 BGM 状态和版本

唯一约束必须保证同一 PC 同时只能被一个有效 claim 认领；断线不自动释放 claim，以 token 允许原玩家恢复。

#### 聊天、规则动作与情报

- `session_messages`：作者、频道、正文、状态、队列排序、表情、eventId、呈现时间
- `check_requests`：目标 PC、技能、难度、奖惩骰、暗骰、待处理/已处理状态
- `handout_grants`：团、情报、公开/秘密、发放时间
- `handout_grant_recipients`：秘密情报可见 PC

#### 可靠事件投递

- `session_outbox`：事务内生成但尚未确认发布的实时事件

事件 ring buffer 仍位于内存；`sessions.last_event_id` 保证进程重启后序号不倒退。进程重启导致内存日志缺失时，客户端走全量快照。outbox 只解决“数据库已提交但进程尚未广播即崩溃”的窗口，不把系统改造成永久事件溯源。

### 8.3 JSON 规则

- 只有规则高度可变的数据使用 JSON：人物卡、团内状态、少量媒体 metadata。
- 可查询、有关联或需要约束的数据必须正常建表，不能全部塞进 JSON。
- 每个 JSON 都有 `schemaVersion`，写入和读取都经规则 schema 校验。
- JSON 迁移必须可重复执行并有旧版本 fixture 测试。

## 9. HTTP API 设计

API 统一放在 `/api/v1`，Elysia route 只做 schema、身份解析、调用用例和响应映射。Eden Treaty 从完整 app 类型生成客户端类型。

### 9.1 路由分组

| 路由组 | 能力 |
|---|---|
| `/health/live`、`/health/ready` | 进程存活、数据库与 migration 就绪 |
| `/gm/auth/*` | 登录、当前身份、退出 |
| `/player/identity` | 签发/恢复匿名玩家身份 |
| `/public/sessions/:id/join-info` | 可认领席位、团的公开信息 |
| `/sessions/:id/claim` | 认领 PC 或 OB，返回加入凭据 |
| `/gm/modules/*` | 模组 CRUD |
| `/gm/modules/:id/scenes/*` | 场景管理 |
| `/gm/modules/:id/tracks/*` | 音乐管理 |
| `/gm/modules/:id/handouts/*` | 情报管理 |
| `/gm/characters/*` | 人物和立绘管理 |
| `/gm/characters/import/*` | Excel 解析预览与确认入库 |
| `/gm/sessions/*` | 团创建、配置、查询和结束 |
| `/media/:id` | 经过身份与可见性检查的媒体读取 |

实时控场动作统一走 WS command；管理后台 CRUD 走 HTTP。两种 transport 必须调用同一个 application 用例，禁止各实现一套逻辑。

### 9.2 API 约定

- 所有列表使用稳定排序和 cursor pagination；后台小列表也不返回无界数据。
- mutation 返回最新资源版本或明确结果，不依赖前端猜测。
- 使用 `requestId` 串联响应和日志。
- 冲突返回 `409`，权限不足返回 `403`，身份缺失返回 `401`。
- 上传先校验大小，再检测实际文件类型，不信任扩展名和客户端 MIME。
- 导入流程使用短期 `importToken` 或 staging 记录绑定 GM 会话，确认时不接受前端回传后可任意篡改的人物卡 JSON。

## 10. WebSocket 协议与实时一致性

### 10.1 协议信封

在 `packages/shared` 定义可判别联合。可补发的团事件、命令回执、快照和非持久化控制消息必须是不同信封，避免给并不属于团事件流的消息伪造 eventId：

```ts
type ClientCommand = {
  protocolVersion: 1;
  commandId: string;
  type: string;
  payload: unknown;
};

type SessionEvent = {
  protocolVersion: 1;
  eventId: number;
  type: string;
  occurredAt: string;
  payload: unknown;
};

type CommandReply = {
  protocolVersion: 1;
  commandId: string;
  type: "command:accepted" | "command:rejected";
  payload: unknown;
};

type ServerMessage = SessionEvent | CommandReply | SessionSnapshot | DirectControlMessage;
```

- 每个 command 都有客户端生成的 `commandId`，服务端短期去重，避免重连重发造成重复消息、重复掷骰或重复发放。
- 只有已呈现或已经生效的事件分配 `eventId`。
- command 的确认或拒绝只定向回复发起连接，不进入 ring buffer。
- 待呈现队列和在线列表更新属于 GM 专用 `DirectControlMessage`，不分配 eventId；GM 重连时以快照恢复。
- 客户端按 eventId 幂等应用团事件；相同 eventId 重复到达时必须忽略。
- 业务事件按可见范围投递；outbox/event publisher 按至少一次语义设计，因此消费者幂等是协议要求。
- 协议不接受未注册的 `type`，payload 必须由对应 zod schema 验证。

### 10.2 连接流程

1. WS upgrade 携带 sessionId、GM cookie 或玩家 token、fingerprint、`lastEventId`。
2. 校验黑名单、身份、claim 和团状态。
3. 建立 `ViewerContext`，登记到 `ConnectionRegistry`。
4. socket 订阅 `session:{id}`；秘密事件仍逐连接定向发送。
5. 如果内存 ring buffer 能覆盖 `lastEventId`，按可见性补发。
6. 如果缺口不可覆盖或首次加入，构建可见性过滤后的全量快照。
7. 连接关闭后更新在线列表；claim 保留供同一 token 重连。

### 10.3 按团串行执行

建立 `SessionCommandExecutor`，同一 sessionId 的状态变更按进入顺序串行执行，不同团可以并发。它负责：

1. 验证 command 和权限。
2. 在短事务中读取/锁定逻辑版本、执行写入、递增 eventId、写 outbox。
3. 提交事务。
4. 将事件加入带可见范围的 ring buffer。
5. 使用 topic 或定向连接发布。
6. 标记 outbox 已投递。

禁止在数据库提交前广播。一个命令生成多个事件时，在同一事务中分配连续 eventId，例如理智检定先产生 `check:resolved`，再产生 `state:changed`。

### 10.4 无竞态快照

快照构建必须避免“查询快照期间漏掉新事件”：

1. 新连接先进入 `hydrating` 状态并缓冲后续可见事件。
2. 通过该团的串行执行器读取一致快照和 watermark eventId。
3. 发送快照。
4. 刷出所有 `eventId > watermark` 的缓冲事件。
5. 将连接切为 `active`。

全量快照包含：当前团状态/阶段、场景、人物及表情、音频、可见情报、可见人物团内状态、最近聊天、待响应鉴定请求；GM 额外收到待呈现队列和在线列表。

### 10.5 事件可见性

统一定义：

```text
VisibilityScope =
  | public
  | gmOnly
  | selectedPcIds
  | connectionOnly
```

所有查询、实时事件、ring buffer 补发和快照都调用同一个 `VisibilityPolicy`/projection。严禁先向全团广播秘密数据再让客户端隐藏。

## 11. 身份、授权与安全

### 11.1 GM

- v1 单 GM 密码配置值必须是强密码 hash；不允许把明文密码写入仓库、数据库或日志。
- 登录成功签发高熵 opaque session token，数据库只保存 hash。
- Cookie 使用 `HttpOnly`、`Secure`（生产）、`SameSite=Strict/Lax`、明确 Path 和短期过期。
- 登录接口限速并记录失败审计事件，响应不泄露密码是否存在等内部信息。
- 所有基于 Cookie 的写接口校验 Origin/同源策略；生产环境只开放明确 CORS 来源。

### 11.2 玩家

- 服务端首次签发 opaque token，客户端 localStorage 持久化。
- 数据库只保存 token hash；token 是恢复身份和 claim 的主凭据。
- 指纹仅用于黑名单和风险辅助，不把指纹当作不可伪造的认证。
- PC 操作必须同时验证 player、session claim、characterId 三者关系。
- 对加入、聊天、骰点、上传和 WS command 分别设置基于身份/IP 的限速及消息体上限。

### 11.3 统一授权

transport 解析出不可伪造的 `ActorContext`：

```text
ActorContext = GM | Player(playerId)
SessionActorContext = GM | SessionPlayer(playerId, sessionId, seatRole, characterId?)
```

每个写用例调用明确 policy，例如：

- `SessionControlPolicy`
- `MessagePermissionPolicy`
- `CharacterControlPolicy`
- `StateVisibilityPolicy`
- `HandoutVisibilityPolicy`

路由/UI 上的“GM 专用”标记不能替代用例内授权。

### 11.4 文件安全

- 使用随机 storage key，不使用用户文件名作为磁盘路径。
- 限制图片、Excel、音频的体积和允许类型，检查 magic bytes。
- 临时文件写完并验证后原子移动；失败要清理临时文件。
- 媒体读取经过资源归属和查看者可见性检查，尤其不能让秘密情报图片通过可猜 URL 公开访问。
- 日志不记录 cookie、token、完整指纹、人物卡原文件或秘密情报正文。

## 12. 各业务域实施规则

### 12.1 团状态机

状态转换由纯领域对象实现并测试：

```text
waiting -> preparing -> active -> ended
```

- 默认只允许前进；若产品需要回退，必须作为显式规则和审计事件增加，不能由通用 update API 任意改状态。
- phase 仅在 `active` 状态存在并可切换。
- GM command 产生 `session:status-changed` 或 `session:phase-changed`。
- 已结团数据保留，只拒绝新的实时玩法写入。

### 12.2 发言权限矩阵

将阶段、身份、席位、消息 channel 和是否响应 GM 请求组成表驱动策略并做参数化测试：

| 阶段 | PC | OB | GM |
|---|---|---|---|
| 自由讨论 | 仅 OOC，立即呈现 | OOC，进入 GM 队列 | 按 GM 控场能力发言 |
| 演绎时间 | 仅 RP，进入 GM 队列 | 禁止 OOC | 按 GM 控场能力发言 |
| 强制 CG | 禁言 | 禁言 | 单方面推进 |
| 自由演绎 | OOC 立即；RP 入队 | OOC 入队 | 按 GM 控场能力发言 |

玩家自主骰点按 OOC 权限判断；响应有效的 GM 鉴定请求绕过阶段限制。GM 在任何阶段可掷骰。

### 12.3 演绎队列

- `pending` 消息不分配 eventId、不进 ring buffer、不发给玩家。
- GM 快照和实时队列更新能看到 pending 消息。
- 排序操作使用稳定 queue rank/version，防止并发覆盖。
- 放行事务内校验消息仍为 pending、校验表情控制权、更新当前表情、设置 presented、分配 eventId。
- 丢弃对玩家无通知；可保留最小 GM 审计记录，但不进入玩家事件流。
- GM 重连从 SQLite 恢复队列；服务重启不能丢 pending 消息。

### 12.4 骰点、鉴定与状态

- `DiceExpressionParser` 只接受受限 `XdY±Z`，限制骰子数、面数、修正值和表达式长度；命令适配器安全拆分可选说明文字。
- 服务端生成所有随机数，客户端不能传 roll 或 targetValue。
- 技能鉴定从数据库人物卡按 skillKey 读取目标值。
- 暗骰事件 visibility 为 `gmOnly`；玩家仅收到不含结果的确认。
- 鉴定请求采用 compare-and-set 从 pending 改为 resolved，确保只能响应一次。
- 成功成长标记、SAN 扣减和 GM 状态编辑共用 `CharacterStateMutationService`。
- GM 状态编辑覆盖当前值/上限、增减伤、预置状态标记和自定义标签；玩家没有直接写入口。
- 状态更新顺序固定为：校验规则 state → 写库 → 生成事件 → 提交 → 按 PC/NPC 可见性发布。
- 阈值只产生 GM 提示，不自动添加重伤/濒死/疯狂状态。

### 12.5 场景与表情

- 团保存当前 sceneId；只能切换到所属模组场景。
- session character 保存当前 expressionId；只能引用该人物已有立绘。
- GM 可控制所有团内人物；玩家只能通过自己的 RP 消息提出自己的 expressionId，并在消息放行时生效。
- 场景和表情都进入快照与补发事件。

### 12.6 音频

服务端持久化权威 BGM 状态：

```text
trackId, playing, volume, loop, seekOffsetMs, startedAtMs, version
```

- 所有指令携带 expected/current version，防止陈旧控制覆盖新状态。
- 播放中位置由服务器时钟推导；暂停时固化 seekOffset。
- 切歌、seek、音量、循环、淡入淡出均由 GM 用例校验并广播。
- BGM 进入快照；SE 是 fire-and-forget，不进入快照，掉线期间不补播。
- 只能播放当前模组拥有且类型正确的音轨。
- 播放中重连位置按 `seekOffset + (serverNow - startedAt)` 推导；循环音轨再按已知时长取模。玩家本地静音不回写权威音量。

### 12.7 情报

- 发放事务写 `handout_grants` 和 recipients，再产生事件。
- 公开情报使用 `public`；秘密情报使用 `selectedPcIds`。
- 追加发放对象只计算新增 PC，避免已有玩家重复弹窗。
- REST 列表、实时推送、补发、快照和图片读取全部复用相同可见性查询。
- v1 没有撤回 API。

### 12.8 在线、踢出与黑名单

- 在线列表来自 `ConnectionRegistry`，不以数据库 lastSeen 冒充实时在线。
- 同一玩家多连接需要稳定聚合并显示连接数/最新状态。
- 踢出关闭当前连接但不自动永久拉黑。
- 拉黑写库后立即关闭匹配连接；HTTP 和 WS handshake 都检查未过期记录。
- 过期黑名单读取时视为无效，并由周期任务清理。

## 13. 可观测性与运行保障

- 使用结构化日志，至少包含 `requestId`、`commandId`、`connectionId`、`sessionId`、`eventId` 和错误码。
- 对登录失败、GM 控场、踢人/拉黑、情报发放、暗骰等敏感管理动作写审计日志；不记录秘密正文和骰点隐藏结果正文。
- `/health/live` 只表示进程存活；`/health/ready` 检查数据库、migration 和关键启动恢复任务。
- 记录 WS 连接数、command 处理耗时、拒绝数、补发/快照次数、outbox backlog、上传失败数。
- 优雅退出：停止接受新连接，完成正在执行的短命令，关闭 socket，停止后台任务，关闭数据库。
- SQLite 与 `data/` 媒体目录必须有可验证的备份/恢复流程；定期做恢复演练，而非只验证备份文件存在。

## 14. 测试策略

每个工作包先写可执行验收条件，再写生产实现。测试分层如下。

### 14.1 单元测试

- 团状态机和阶段权限矩阵
- `RuleSystem` 和 CoC 7e 所有边界值
- 骰点表达式 parser
- 奖励/惩罚骰选择
- SAN 损失和提示
- visibility policy
- BGM 时间推导
- token/hash、过期时间等纯逻辑

随机数、时钟、ID 使用 fake，禁止依赖真实时间和概率通过。

### 14.2 Application 用例测试

使用内存 fake repository/publisher 验证：

- 权限拒绝发生在副作用前
- 事务失败不发布事件
- 正常流程写入和事件顺序正确
- 重复 command/check response 幂等
- 秘密事件只产生正确 visibility

### 14.3 数据库集成测试

- 对临时 SQLite 数据库运行真实 migrations
- 测试唯一约束、外键、事务回滚、JSON 校验和关键查询
- 测试座位并发认领、鉴定请求只处理一次、eventId 不重复
- Repository 测试不 mock Drizzle

### 14.4 HTTP contract 测试

通过 `createApp()` 和 Elysia `app.handle/app.fetch` 直接发 Web Standard Request，无需监听端口：

- zod 验证
- Cookie/token 身份解析
- 状态码和稳定错误码
- Eden 类型契约
- 媒体授权读取

### 14.5 WebSocket 集成测试

启动随机端口真实连接多个 GM/PC/OB 客户端，验证：

- topic 广播与定向推送
- 演绎队列的玩家无感
- 暗骰、秘密情报和 NPC 状态不泄漏
- eventId 顺序
- 断线补发与快照 fallback
- hydrating 期间无事件缺口
- 踢出、拉黑和重连拒绝

### 14.6 关键验收矩阵

以下场景必须是发布阻断测试：

- 四阶段 × PC/OB/GM × OOC/RP/自主骰点
- 普通/秘密情报 × GM/目标 PC/非目标 PC/OB
- 普通/暗骰 × GM/发起玩家/其他玩家
- PC/NPC 状态 × GM/PC/OB
- 首次加入/短线重连/日志缺口/进程重启后的快照
- 同一 command 重发、同一鉴定请求双击、两个玩家同时认领同一 PC

## 15. 质量门禁

每个 PR 至少执行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:client
bun audit --audit-level=high
```

后端基线还需增加：

- `bun run db:generate`：只用于开发生成 migration
- `bun run db:migrate`：应用已提交 migration
- `bun run db:check`：检查 migration 冲突/漂移
- `bun run check:boundaries`：检查跨模块内部导入和规则硬编码
- `bun run test:integration`
- `bun run test:e2e`

合并要求：

- 生产代码、测试、shared contract、migration 同一个功能包提交。
- 任何数据库结构变化必须包含 migration 和迁移后 repository 测试。
- 任何 WS 协议变化必须同步 shared schema、兼容性说明和补发/快照测试。
- 规则变化必须在 `rules/{ruleId}` 内，并有确定性测试。
- 对关键权限和隐私代码要求分支覆盖；不以整体覆盖率数字代替场景矩阵。
- 禁止提交 `.env`、SQLite 数据文件、上传媒体、token 或真实人物卡。

## 16. 分阶段实施路线

阶段按依赖顺序执行。每个阶段必须通过自己的验收门禁后再进入下一阶段，避免 UI mock 与不稳定后端同时扩散。

### Phase 0：工程基线

任务：

- 拆分 `createApp()` 与 `listen()`
- 配置 zod 校验、结构化日志、request ID、错误映射
- Drizzle + `bun:sqlite`、migration、WAL、测试数据库 helper
- composition root、Clock/ID/Random/Transaction 端口
- 模块边界检查
- live/ready health endpoint
- CI 质量命令

验收：服务可在无端口模式被测试；空数据库可从零迁移；非法配置启动失败；typecheck 和测试门禁可重复运行。

### Phase 1：身份、授权与媒体底座

任务：

- GM 登录、Cookie 会话、退出和限速
- 玩家匿名 token 签发/恢复
- `ActorContext` 和 Elysia auth macro/resolve
- 本地 `MediaStorage`、上传验证、授权读取
- 初始审计日志

验收：GM/玩家/匿名请求权限隔离；数据库和日志中没有原始 token；未授权用户不能读取媒体。

### Phase 2：模组与资源后台

任务：

- 模组 CRUD 与 `ruleId`
- 场景、音乐、情报 CRUD
- 媒体关联、引用检查和安全删除
- cursor pagination

验收：后台能完整建立一个模组资源容器；跨模组引用被拒绝；删除被引用资源不会留下坏数据。

### Phase 3：规则系统、人物与 Excel 导入

任务：

- `RuleSystem`、注册表、CoC 7e 实现骨架
- CoC 人物卡 schema、状态初始化、鉴定纯逻辑
- 人物和立绘 CRUD
- Excel 解析预览与确认入库
- 规则 JSON schemaVersion 与迁移机制

验收：服务端按 module ruleId 解析人物卡；错误单元格可定位；确认入库前不能篡改预览；CoC 判级边界测试完整。

### Phase 4：团、席位与状态机

任务：

- 创建团并选择 PC/NPC
- 初始化团内状态
- 加入信息、PC/OB 认领和 token 重连
- 团状态机、phase、GM 控制用例
- 基础 snapshot query

验收：同一人物可参加多个团且状态隔离；PC 不会被双重认领；非法状态流转和非 GM 控制被服务端拒绝。

### Phase 5：WebSocket 核心与重连

任务：

- shared WS discriminated union
- upgrade 认证、ConnectionRegistry、topic 订阅
- `SessionCommandExecutor`
- eventId、ring buffer、visibility、outbox
- lastEventId 补发、hydrating 快照、心跳

验收：多客户端事件顺序一致；短线可补发；日志缺口和进程重启走快照；秘密测试数据永不出现在无权限 socket 字节流中。

### Phase 6：聊天与演绎队列

任务：

- 发言权限矩阵
- OOC 即时消息与最近聊天
- RP/OB pending 队列
- GM 排序、放行、丢弃
- 放行时表情切换
- 队列持久化和 GM 快照

验收：四阶段权限矩阵全通过；玩家看不到 pending/discard；服务重启不丢队列；放行顺序就是 eventId 顺序。

### Phase 7：骰点、鉴定与团内状态

任务：

- 通用 DiceEngine 与 `.r`
- CoC `.ra`、奖惩骰、难度
- GM 鉴定请求和响应
- 暗骰
- SAN 检定、状态统一变更入口、成长标记、GM 提示
- GM 状态编辑和 PC/NPC 可见性

验收：客户端传入伪造 targetValue/roll 无效；响应请求不受阶段限制且只能一次；暗骰/NPC 状态不泄漏；状态变化可补发和快照恢复。

### Phase 8：场景、表情与音频控场

任务：

- 当前场景切换
- GM 任意人物表情控制
- BGM 权威状态、版本和时钟同步
- SE 事件
- snapshot/reconnect 恢复

验收：只能引用当前模组资源；陈旧音频 command 不覆盖新状态；中途加入者得到正确 BGM 进度；SE 不补播。

### Phase 9：情报、在线与黑名单

任务：

- 公开/秘密情报发放和追加对象
- 可见情报列表与图片授权
- 在线列表
- 踢出
- 临时/永久黑名单、握手拦截和过期清理

验收：非目标客户端完全感知不到秘密发放；追加对象不重复通知旧对象；被拉黑连接立即关闭且无法重新握手。

### Phase 10：生产化与完整回归

任务：

- Elysia 托管 Vite 产物
- Docker 单进程镜像和 data volume
- 优雅退出、备份恢复脚本、运行手册
- 负载/长连接/大文件限制测试
- 全量安全回归和隐私字节流检查
- 移除前端业务 mock，完成真实端到端验收

验收：全新环境可用一条 Bun/Docker 流程部署；备份可恢复；所有发布阻断矩阵通过；重启和断线不破坏权威状态。

## 17. 功能完成定义（Definition of Done）

一个后端功能只有同时满足以下条件才算完成：

1. 产品行为和权限边界有可执行验收测试。
2. shared 请求/响应或 WS schema 已定义，客户端不需要手写重复类型。
3. transport 仅做适配，业务逻辑位于 application/domain。
4. 所有写操作经过授权和事务边界。
5. 如产生实时变化，事件只在提交后发布并支持补发/快照。
6. 可见性经过 GM、目标 PC、非目标 PC、OB 四类身份测试。
7. 数据库变化包含 migration、约束和 repository 集成测试。
8. 错误码、日志和审计信息足够定位问题且不泄露秘密。
9. typecheck、测试、依赖审计和构建通过。
10. 对应文档、接口说明和运行配置已更新。

## 18. 实施时必须避免的反模式

- 在 Elysia route 或 WS `message` 回调中直接写大段业务逻辑。
- route 直接调用 Drizzle。
- application 接收完整 Elysia `Context` 或原始 socket。
- 通用模块出现 `if (ruleId === "coc7e")`。
- 服务端和客户端分别定义同一 WS payload。
- 所有表都用一个“万能 Repository”。
- 数据库提交前广播，或广播失败后假装成功。
- 为秘密数据先全员广播再由前端隐藏。
- 用 FingerprintJS 替代真正的 token 身份。
- 用 `Math.random()` 生成骰点。
- import `index.ts` 时自动 listen，导致测试必须抢占端口。
- 在 SQLite 事务里解析 Excel、读取大媒体或等待网络。
- 为未来可能出现的多进程提前引入 Redis/Kafka；先保持端口可替换并完成 v1。

## 19. 开工前的固定默认决策

为避免开发过程中反复摇摆，v1 默认采用：

- 单 GM 密码、多个短期 GM 登录会话。
- 人物为可复用实体，通过 `module_characters` 和 `session_characters` 关联，团内状态永远独立。
- 玩家 claim 在断线后保留，只有 GM、主动退出或明确超时策略释放。
- 聊天和已发放情报随团持久保存；ring buffer 只负责近期实时补发。
- 本地磁盘是唯一媒体实现，但 application 只依赖 `MediaStorage`。
- 单进程内存连接注册和 per-session executor；未来多进程扩展必须先写 ADR，不能破坏现有用例接口。
- 所有新增功能从验收矩阵和测试开始，再补实现。

如产品方向改变这些默认项，应先更新 `docs/product.md` / `docs/architecture.md` 并记录 ADR，再修改代码。

## 20. 官方实现参考

- [Elysia Best Practice](https://elysiajs.com/essential/best-practice)：transport 与非 HTTP 业务逻辑解耦、避免传递完整 Context。
- [Elysia Unit Test](https://elysiajs.com/tutorial/features/unit-test/)：通过 `app.fetch`/Web Standard Request 测试应用而不启动监听端口。
- [Bun WebSockets](https://bun.com/docs/runtime/http/websockets)：原生 WebSocket、连接身份数据和 topic pub/sub。
- [Drizzle with Bun SQLite](https://orm.drizzle.team/docs/get-started/bun-sqlite-new)：`bun:sqlite` 驱动、schema 与 migration 配置。
- [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)：code-first migration 生成、审阅和应用流程。
