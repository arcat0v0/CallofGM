# 自定义表情与统一人物资料编辑器 设计文档

日期：2026-11-05
状态：待批准
范围：apps/client、apps/server、packages/shared

## 1. 意图与背景
GM 人物库「上传立绘」的表情下拉写死了 5 个 key（`EXPRESSION_KEYS`：默认/微笑/惊讶/生气/受伤，见 `apps/client/src/lib/format.ts:4-10`），上传只是往固定槽位放图。用户已用 AI 生成 26+ 个自定义表情（如 `toast_glass`、`reading_book`），证明底层能存任意 key，但：

- 没有重命名、排序、设默认的界面；自定义 key 的显示名（`character_portraits.label`）从未被任何 UI 读取。
- PL 玩家完全没有立绘/表情管理入口（PL 人物页只有姓名/背景编辑）。
- 团内展示（composer 表情选择、GM 控制台表情切换、舞台表情切换历史）全部走 `expressionLabel(key)` 翻译固定 key，自定义 key 会原样露出。

`docs/product.md`（人物管理）与 `docs/redesign-multi-ruleset-accounts.md` §5.1 早已约定「表情可增删、命名、排序、设默认；内置预设仅作建卡初始模板」。本设计补齐该欠账，并按用户选择（方案 C）做统一人物资料编辑器，GM 与 PL 共用。

## 2. 目标

- GM 与 PL（自己的人物）都能对任意人物做完整的表情管理：添加（多选文件批量）、改名、设默认、排序、删除。
- 表情名全链路可见：库管理页、GM 控制台人物浮层、玩家 composer 表情选择与预览、表情切换历史。
- 统一人物资料编辑器组件：姓名 + 背景 + 表情管理，GM 与 PL 共用。
- 删除写死的 `EXPRESSION_KEYS` 与旧上传流程，不留兼容层。

## 3. 非目标

- 不做人物卡（数值）编辑的统一化：数值编辑仍是现有 `CharacterSheetEditorDialog`（GM）与导入流程；PL 侧数值编辑维持现状（不在本次范围）。
- 不做拖拽排序（上下移按钮足够 v1）。
- 不迁移存量数据：现有表情 key 原样保留。
- 不做表情的多语言翻译（显示名就是用户填的名字）。
- 不改变团内表情切换的权限模型（GM 可切任意团内人物；玩家仅随自己已放行的演绎发言切换自己的 PC）。

## 4. 反目标（出现即失败）

- 任何用户可见的原始 key 泄漏（如 `expr_a1b2c3` 出现在界面上），除非该表情从未填过名字且是历史数据（此时显示旧 key 是唯一选择）。
- 玩家能操作不属于自己的人物的表情。
- 破坏现有团内 `expression:set` / 演绎发言表情校验（服务端权威不变）。

## 5. 约束

- 技术栈按 `docs/tech-stack.md`；WS/REST 协议 schema 一律改 `packages/shared`（zod）。
- 服务端权威：表情增删改只能走属主校验的 REST（GM `/gm/characters/*`、PL `/pl/characters/*`），不走 WS。
- UI 遵循 `docs/DESIGN.md`：token 只在 theme.css，组件用现有 ui 基础件组合；新组件放 features 层，不下沉 components/ui。
- 无新注释；TS strict + `noUncheckedIndexedAccess`；测试用 bun test。

## 6. 已考虑的方案

- **A. 表情管理器组件两处复用**（推荐过）：只做表情管理，GM/PL 各自页面嵌入。范围小，但人物资料编辑仍是两套（GM 详情页零散控件、PL 弹窗），不满足用户对 C 的选择。
- **B. 最小改动**：给上传加自由 key 输入。被否：没有重命名/排序/设默认，玩家无入口，等于没解决。
- **C. 统一人物资料编辑器 + 表情管理器（选定，用户拍板）**：一个 `CharacterProfileEditorDialog`（姓名/背景/表情）+ 一个 `ExpressionManager` 组件，GM/PL 共用。范围大一圈但消除两套资料编辑形态，正好补齐产品文档承诺。

## 7. 数据与协议设计（已定）

### 7.1 表情标识模型（核心决定）

- **用户只面对「表情名」（label）；`expression_key` 由服务端自动生成**（如 `expr_` + 10 位随机 hex），对用户不可见。理由：让用户起唯一 key 违背直觉，key 唯一性由系统保证（DB 有 `(character, expression_key)` 唯一索引）。
- `expression_key` 创建后不可改；「重命名」= 更新 `label`（`UpdatePortraitRequest.label` 已支持）。
- 显示名解析：`label ?? expression_key`。存量自定义 key（如 `toast_glass`）没填过 label，显示旧 key——可接受且唯一一次出现，用户重命名后即消失。内置 5 个 key 走现有 i18n 翻译兜底。
- 不迁移存量数据。

### 7.2 协议变更（packages/shared/src/characters.ts、snapshot.ts）

1. `AddPortraitRequest.expressionKey` 改为 **optional**；服务端缺省时自动生成。`label` 语义升级为「表情名」，建议必填由前端保证、协议仍 optional（max 64）。
2. `SnapshotPortrait` 增加 `label: z.string().nullable()` 与 `sortOrder: z.number().int()`；`build-snapshot.ts` 的 portrait 查询补 select 两字段并按 `sortOrder, createdAt` 排序——表情自定义顺序在 composer 下拉、GM 控制台下拉与快照中一致生效。`ExpressionChangedEvent` 等 WS 事件 payload **不变**——客户端从快照人物的 portraits 里按 key 查 label。快照按排序输出后，客户端无需再排。
3. 其余端口（UpdatePortrait/DeletePortrait）不变。
4. 历史与队列中的已删表情：`expression:changed` 历史条目与 GM 待放行队列项若引用已删除的表情，显示名回落旧 key（可读的 `toast_glass` 类 key 可接受；`expr_` 自动 key 一般刚建即用，罕见出现在历史里）。不做软删 label 保留查询、不改历史协议——避免为此扩协议；泄漏窗口收敛为「删除后又出现在历史里」这一低频场景。

### 7.3 服务端逻辑变更（apps/server）

1. **媒体读取规则重构**：`checkMediaAccess`（`apps/server/src/modules/media/transport/routes.ts`）改为四层判定，逐层短路：(a) 资产 owner（账号身份，无论 gm/pl）可读——服务上传回显与 PL 进团前预览；(b) 团 owner（sessions.ownerId = actor.userId）可读其团内人物的所有立绘——服务 GM 舞台加载 PL 上传的立绘；(c) 现有「参与团的角色可见」链路保持（背景/曲目/立绘/情报）；(d) 其余 403。理由：人物立绘天然要在「上传者≠阅读者」间流动（GM 预建 PC 上传后指派给 PL、PL 上传后 GM 舞台显示），按 owner 双向放行是表情系统的前置条件；GM 分支不再提前 return，统一走同一判定链。
2. `AddPortraitUseCase`：`expressionKey` 缺省时生成 `expr_<10hex>`（用注入的 RandomSource，冲突时重查重试）；`label` 缺省落 null；`sortOrder` 缺省取该人物现有最大值 +1（追加到末尾），不再固定 0。
3. `DeletePortraitUseCase` 增强：删除时若该表情是该团内人物 `currentExpressionKey`，则把团内人物当前表情重置为其默认表情（无默认则置 null）；「已存在立绘」类校验（`portraitExists`、`SetExpressionHandler`）一律排除 `deletedAt` 非空的行。默认位不自动转移（删除默认表情后无默认，快照回落第一张）。

### 7.4 客户端设计（apps/client）

**新组件（`apps/client/src/features/characters/`）：**

1. `ExpressionManager`（props: `characterId`, `portraits: CharacterPortraitDto[]`, `onChange`）：
   - 网格缩略图列表（mediaUrl），每格显示表情名、默认星标、上移/下移、删除（ConfirmDialog）。
   - 「添加表情」：`<input type="file" multiple accept="image/*">` → 逐文件出现待上传行（名字预填文件名去扩展名，可改）→ 逐个 POST `/media/upload`（purpose=portrait）+ POST `.../portraits`（不带 key，带 label）。
   - 排序：移动时把全列表 sortOrder 重写为 0..n-1（按当前显示序），逐个 PATCH。显示序 = `sortOrder, createdAt`。
   - 设默认：PATCH `isDefault: true`（服务端已互斥清其他默认）。
   - 改名：行内编辑（Enter 提交、Esc 还原，同 music 页重命名交互）。
2. `CharacterProfileEditorDialog`（props: `character: CharacterDetailDto`, `open`, `onClose`, `onSaved`）：
   - 姓名（Input）、背景（Textarea）、规则徽标只读、`ExpressionManager`。
   - 保存：PATCH name/background（带 `expectedVersion`）+ 表情操作实时生效（各自独立请求，不做大事务）。
   - 上传失败不阻塞其他表情操作，toast 逐条报错。

**改造点：**

3. `routes/gm/characters.tsx`：删除写死 Select（283-301 行）与上传 label 逻辑；「已上传表情」网格与上传按钮并入编辑器弹窗；工具栏保留 导入 Excel / 编辑数值 / 资料与表情（新，打开编辑器）/ kebab 删除。详情页保留 arch 形当前立绘预览。
4. `routes/pl/characters.tsx`：编辑弹窗换成 `CharacterProfileEditorDialog`（需先 GET `/:id` 拿详情含 portraits；新建流程不变）。
5. `lib/format.ts`：删除 `EXPRESSION_KEYS`；`expressionLabel(key, label?)` 改为 `label ?? translateOr("expression.<key>", key)`。
6. `lib/character-sheet.ts`：`CharacterPortrait` 增加 `label`；`expressions` 映射用显示名。
7. `features/play/composer.tsx`：表情选项 label 用 portrait.label。
8. `features/gm-console/characters-panel.tsx`：表情下拉用显示名，且下拉项来自 portraits 排序（快照已带 sortOrder）。
9. `features/gm-console/gm-panel-stage.tsx`：待放行队列项的表情上下文用显示名——从 play-store 人物 portraits 按 key 查（队列 DTO 不改）。
10. `features/play/composer.tsx`：已选表情 trigger 同样用显示名（覆盖原来仅选项列表改 label 的遗漏）。
11. `lib/chat-map.ts` + `stores/play-store.ts`：`expression:changed` 活动消息显示 label——从 store 内该人物 portraits 按 expressionKey 查显示名，查不到回落 key。
12. i18n（zh-CN.ts）：新增表情管理相关 key；删除因 3 而失效的 key（如 `gm.characters.uploadExpression`、`gm.characters.expressionAria`）；5 个预设翻译保留，作为存量 key 的翻译兜底。

## 8. 权限与安全

- GM 路由复用现有 `/gm/characters/:id/portraits`；PL 表情路由已存在且校验 `ownerId === actorUserId`（`/pl/characters/:id/portraits`），复用。
- 媒体上传已允许 pl 角色；读取按 §7.3.1 的四层判定。
- 表情切换（WS expression:set / chat 表情校验）不变：仍校验团内人物存在该 key 的**未删除**立绘。
- 批量添加受上传限速约束（20 次/分/IP，`http-limits.ts`）：批量逐个顺序上传，单条 429 不中断批次、toast 报错可重试；不为表情加批量端点、不调限速。

## 9. 测试与验收

服务端（bun test，contract tests）：
- 自动 key 生成与唯一性；label 落库；快照含 label。
- 媒体读取：PL 读自己上传的立绘 200、读他人 403；团 owner 读团内人物立绘 200；无关联账号 403。
- 删除表情：团内 currentExpressionKey 指向被删表情时回落默认/null；删除后 `expression:set` 与演绎发言引用该 key 被拒。

客户端（bun test）：
- `expressionLabel` label 优先 / i18n 兜底 / key 回落。
- `character-sheet.ts` 映射 label。
- chat-map expression:changed 的 label 解析。

人工验收（用户执行）：
- GM 库里给礼帽男子重命名一个表情、排序、设默认、删除、批量添加。
- PL 账号对自己 PC 做同样操作；进团后 composer 表情选择显示新名字；GM 放行带表情的发言后舞台切换，历史显示表情名。

## 10. 留给实现者的决定

- 批量添加的并发策略：固定顺序逐个上传（限速约束下的最简正确做法）。
- 快照人物立绘数组是否仍需客户端二次排序：不需要，快照按 sortOrder, createdAt 输出。
- 历史条目已删表情的显示名：回落 key，不做软删 label 查询。

## 11. Reviewer 问题的处置记录

独立 reviewer 提出的问题与采纳结论：媒体读取双向 owner 放行（§7.3.1，采纳）；历史已删表情显示回落 key、不扩协议（§7.2.4，采纳，接受低频泄漏）；快照补 sortOrder 并服务端排序（§7.2.2，采纳）；删除清理团内当前表情并排除软删行（§7.3.3，采纳）；composer trigger 与 GM 队列两处遗漏显示点补入（§7.4.9/10，采纳）；批量上传限速按顺序+可重试处理（§8，采纳，不调限速）。

## 12. 交付物清单

- `packages/shared/src/characters.ts`（AddPortraitRequest）、`packages/shared/src/snapshot.ts`（SnapshotPortrait.label 与 sortOrder）
- `apps/server/src/modules/characters/application/use-cases.ts`（AddPortraitUseCase、DeletePortraitUseCase）
- `apps/server/src/modules/realtime/application/build-snapshot.ts`
- `apps/server/src/modules/media/transport/routes.ts`（checkMediaAccess）
- `apps/server/src/modules/chat/infrastructure/drizzle-chat-repository.ts` 与 `apps/server/src/modules/sessions/application/stage-commands.ts`（立绘校验排除软删）
- `apps/client/src/features/characters/expression-manager.tsx`、`character-profile-editor-dialog.tsx`（新）
- `apps/client/src/routes/gm/characters.tsx`、`apps/client/src/routes/pl/characters.tsx`
- `apps/client/src/lib/format.ts`、`apps/client/src/lib/character-sheet.ts`
- `apps/client/src/features/play/composer.tsx`、`apps/client/src/features/gm-console/characters-panel.tsx`、`apps/client/src/features/gm-console/gm-panel-stage.tsx`
- `apps/client/src/lib/chat-map.ts`、`apps/client/src/stores/play-store.ts`
- `apps/client/src/i18n/messages/zh-CN.ts`
- 服务端与客户端测试若干
