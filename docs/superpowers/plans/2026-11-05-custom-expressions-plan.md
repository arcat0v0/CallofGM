# 自定义表情与统一人物资料编辑器 实现计划

日期：2026-11-05
依据：`docs/superpowers/specs/2026-11-05-custom-expressions-design.md`（下称「设计」）。范围：`packages/shared`、`apps/server`、`apps/client`。

## 0. 执行约束（全程适用）

- 只用 Bun：`bun install` / `bun run` / `bunx` / `bun test`；不引入新依赖。
- 协议 schema 唯一来源 `packages/shared`（zod），两端不得各写一份。
- 无数据库迁移：`character_portraits.label / sort_order` 已存在（`apps/server/src/platform/db/schema/characters.ts:99-123`），不要跑 `db:generate`。
- 服务端权威：表情增删改只走 REST；`expression:set` 与发言表情校验的权限模型不变。
- `noUncheckedIndexedAccess`：数组下标视为 `T | undefined`，排序/索引逻辑显式判空。
- 不写新代码注释；用户可见文本一律 `t()` / `translateOr()`，只改 `apps/client/src/i18n/messages/zh-CN.ts`。
- 样式只用 MD3 token/现有类；新组件放 `apps/client/src/features/characters/`，不下沉 `components/ui`。
- 服务端跨模块导入只经模块根 `index.ts`（`bun run check:boundaries`）。
- 最终一个 gitmoji commit，无 `Co-Authored-By`。
- 开工基线（只记录失败，不顺手修无关问题）：`bun run typecheck`、`bun run --cwd apps/server test`、`bun run --cwd apps/client test`、`bun run check:boundaries`。

## Phase 1 — 共享协议

### Step 1 — AddPortraitRequest key 可选；快照立绘补 label/sortOrder
**Files**: `packages/shared/src/characters.ts`、`packages/shared/src/snapshot.ts`
**Changes**:
- `AddPortraitRequest`（characters.ts:47-54）：`expressionKey` 改为 `z.string().trim().min(1).max(64).optional()`；其余不动。`CharacterPortraitDto` 已有 `label`/`sortOrder`，勿重复添加。
- `SnapshotPortrait`（snapshot.ts:19-24）：增加必填 `label: z.string().nullable()`、`sortOrder: z.number().int()`。`ExpressionChangedEvent` 等 WS payload 不动。
**Verify**: `bun run --cwd packages/shared typecheck`
**Done**: shared 编译通过；快照类型含两字段。

## Phase 2 — 服务端：自动 key、追加排序、快照标签

### Step 2 — 先写失败测试（自动 key / label / sortOrder / 快照）
**Files**: 新建 `apps/server/tests/contract/character-expressions.test.ts`；修改 `apps/server/tests/helpers/setup.ts`
**Changes**:
- 沿用 `setupTestApp`（`tests/helpers/setup.ts:354`）与 `connectWs`/`sendCommand`：`const random = new ScriptedRandomSource([]); ctx = await setupTestApp({ randomSource: random, characters: [{ id: "char-exp", name: "表情测试", kind: "npc", portraits: ["default"] }] });`
- 用例 1：POST `/api/v1/gm/characters/char-exp/portraits`，body `{ label: "举杯", portraitAssetId: "asset-placeholder" }`（不带 key）；断言 200、`expressionKey` 匹配 `/^expr_[0-9a-f]{10}$/`、`label === "举杯"`、`sortOrder === 1`。
- 用例 2：再 POST 一条，`sortOrder === 2` 且 key 不同。
- 用例 3 冲突重试：直接插入 `characterPortraits` 行 `expressionKey: "expr_123456789a"`；`random.push(1,2,3,4,5,6,7,8,9,10, 11,12,13,14,15,1,2,3,4)` 后 POST，断言返回 `expr_bcdef1234`。
- 用例 4：`connectWs` 取 `m.type === "snapshot"`，在 `payload.characters` 找 `char-exp`，断言 `portraits` 按 `sortOrder` 升序、新增项带 `label`、种子项 `label === null`。
- `setup.ts` 立绘种子（约 507-518 行）改为 `char.portraits.forEach((expressionKey, index) => ...)` 并写入 `sortOrder: index`；`isDefault` 仍只给 `default`，保证快照排序稳定。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts`
**Done**: 测试可编译，且因行为缺失而失败（非语法/夹具错误）。

### Step 3 — AddPortraitUseCase 自动 key、label 落库、sortOrder 追加
**Files**: `apps/server/src/modules/characters/application/use-cases.ts`、`apps/server/src/modules/characters/transport/routes.ts`
**Changes**:
- 导入 `type RandomSource`（`@/platform/ports`）。`AddPortraitUseCase` 构造签名改为 `(repo, idGenerator, randomSource, clock)`；`execute.expressionKey?: string`。
- 私有 `generateExpressionKey(characterId)`：`"expr_" + 10 × randomSource.randomInt(0, 15).toString(16)`；用 `repo.findPortraitByExpression` 查重（**不过滤** `deletedAt`，唯一索引包含软删行），最多 5 次，超出抛 `AppError("EXPRESSION_KEY_EXHAUSTED", ..., 500)`。
- `execute`：属主/资产校验不变 → `const expressionKey = input.expressionKey ?? await this.generateExpressionKey(character.id)` → `const current = await this.repo.listPortraitsByCharacterId(character.id)`，`nextSort = current.reduce((m,p) => Math.max(m,p.sortOrder), -1) + 1`。
- 既有行分支用 `expressionKey`，`sortOrder: input.sortOrder ?? existing.sortOrder`（保留原位置）；新行 `sortOrder: input.sortOrder ?? nextSort`、`label: input.label ?? null`。
- `routes.ts:117-121` 构造传入 `container.randomSource`；GM/PL POST 已传 `data.expressionKey`，无需改调用。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts`
**Done**: 自动 key/sortOrder/label 用例通过；新增不再要求客户端给 key。

### Step 4 — 快照输出 label/sortOrder 并服务端排序
**Files**: `apps/server/src/modules/realtime/application/build-snapshot.ts`
**Changes**:
- `portraitRows`（325-338 行）`select` 增加 `label`、`sortOrder`；追加 `.orderBy(asc(characterPortraits.sortOrder), asc(characterPortraits.createdAt))`，从 `drizzle-orm` 导入 `asc`。
- push 对象增加 `label: portrait.label`、`sortOrder: portrait.sortOrder`。客户端不再二次排序。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts`
**Done**: 快照立绘带 label/sortOrder 且顺序即协议顺序；现有 stage/chat 契约测试不回归。

## Phase 3 — 服务端：删除清理与软删排除

### Step 5 — 先写删除/软删失败测试
**Files**: `apps/server/tests/contract/character-expressions.test.ts`（追加）
**Changes**:
- 追加种子人物：`char-del`（`["default","angry"]`）、`char-soft`（`["default","angry"]`，由 `pc1` claim）。
- 用例 1：`db.update(sessionCharacters).set({ currentExpressionKey: "angry" }).where(and(eq(sessionId, ctx.sessionId), eq(characterId, "char-del")))`；DELETE `/api/v1/gm/characters/char-del/portraits/portrait-char-del-angry`；断言 `currentExpressionKey === "default"`。
- 用例 2：把 current 设为 `"default"` 后删除 default 立绘，断言变为 `null`。
- 用例 3：删除 `char-soft` 的 `angry`；`setSessionPhase(ctx, "performance_time")`；GM WS `expression:set {characterId:"char-soft", expressionKey:"angry"}` → `command:rejected` 且 `payload.code === "EXPRESSION_NOT_FOUND"`。
- 用例 4：`pc1` WS `chat:send {channel:"roleplay", content:"…", expressionKey:"angry"}` → `command:rejected`，同 code。
- 从 `@/platform/db/schema` 导入 `sessionCharacters`，从 `drizzle-orm` 导入 `and, eq`。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts`
**Done**: 删除相关用例失败，原因明确为行为缺失。

### Step 6 — DeletePortraitUseCase 重置团内当前表情
**Files**: `apps/server/src/modules/characters/application/ports.ts`、`apps/server/src/modules/characters/infrastructure/drizzle-characters-repository.ts`、`apps/server/src/modules/characters/application/use-cases.ts`
**Changes**:
- `CharactersRepository` 增加 `resetSessionCharacterExpression(characterId, fromExpressionKey, toExpressionKey: string | null): Promise<void>`。
- Repository 导入 `sessionCharacters` 并实现：`update(sessionCharacters).set({ currentExpressionKey: toExpressionKey }).where(and(eq(characterId), eq(currentExpressionKey, fromExpressionKey)))`。
- `DeletePortraitUseCase.execute`：校验后 `const portraits = await repo.listPortraitsByCharacterId(character.id)`（已排除软删）；`const fallback = portraits.find(p => p.isDefault === 1 && p.id !== portrait.id)?.expressionKey ?? null`；软删原逻辑不变；随后 `await repo.resetSessionCharacterExpression(character.id, portrait.expressionKey, fallback)`。
- 默认位不自动转移：删除默认表情后 fallback 为 null。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts && bun run --cwd apps/server typecheck`
**Done**: 删除当前表情回落默认（无默认则 null）；删除非当前表情不影响团内状态。

### Step 7 — 立绘存在性校验排除软删
**Files**: `apps/server/src/modules/chat/infrastructure/drizzle-chat-repository.ts`、`apps/server/src/modules/sessions/application/stage-commands.ts`
**Changes**:
- `portraitExists`（145-158 行）`where` 增加 `isNull(characterPortraits.deletedAt)`，导入 `isNull`。
- `SetExpressionHandler` 的 `portraitRows` 查询（166-174 行）同样增加 `isNull(characterPortraits.deletedAt)`，导入 `isNull`。
**Verify**: `cd apps/server && bun test tests/contract/character-expressions.test.ts tests/contract/stage.test.ts tests/contract/chat.test.ts`
**Done**: 两处都拒绝已软删 key；stage/chat 不回归。

## Phase 4 — 服务端：媒体读取四层判定

### Step 8 — 先写媒体访问契约测试
**Files**: 新建 `apps/server/tests/contract/media-access.test.ts`
**Changes**:
- `setupTestApp` 前设 `process.env.MEDIA_DIR = await mkdtemp(join(tmpdir(), "cogm-media-access-"))`；`afterAll` 关库并 `rm(dir, { recursive: true, force: true })`。
- 配置 `players: ["anon1"]`、`claims: [{ player:"anon1", role:"ob" }]`、`plAccounts: ["plowner","plother"]`、`characters: [{ id:"char-media", name:"媒体测试", kind:"pc", portraits:["default"] }]`。
- `db.update(characters).set({ ownerId: ctx.plIds.get("plowner")!, ownerKind: "pl" }).where(eq(characters.id, "char-media"))`。
- `plowner` 经 `/media/upload`（FormData：1x1 PNG、`purpose=portrait`）得 `asset-pl`；POST `/api/v1/pl/characters/char-media/portraits` body `{ label:"新表情", portraitAssetId: asset-pl }`（不带 key）。
- 断言：`plowner` GET `/api/v1/media/${asset-pl}` → 200（tier a）；`plother` → 403（tier d）；`gmToken` → 200（tier b）；`ctx.playerTokens.get("anon1")` → 200（tier c）。
- 另传 GM 资产 `asset-gm`：`plother` GET → 403，`gmToken` GET → 200（tier a）。
**Verify**: `cd apps/server && bun test tests/contract/media-access.test.ts`
**Done**: 四层均有断言，tier b 相关先失败。

### Step 9 — checkMediaAccess 四层重构
**Files**: `apps/server/src/modules/media/transport/routes.ts`
**Changes**:
- 删除 42-51 行 GM 提前 return 分支。
- 判定顺序：(a) `actor.type === "user"` 且 `mediaAssets.ownerId === actor.userId` → 放行；(b) 同 `actor.type === "user"` 时 `sessions.ownerId === actor.userId` join `sessionCharacters` join `characterPortraits`，按 `portraitAssetId = assetId` 查 → 放行；(c) `const holder = holderOfActor(actor)` 后保留现有背景/曲目/立绘/公开情报/秘密情报链路（55-167 行）不变；(d) `return false`。
- 不新增 import（`sessions`、`sessionCharacters`、`characterPortraits`、`mediaAssets` 已在）。
**Verify**: `cd apps/server && bun test tests/contract/media-access.test.ts tests/contract/media.test.ts && bun run --cwd apps/server typecheck`
**Done**: 四层规则生效；旧媒体测试不回归。

## Phase 5 — 客户端：显示名链路

### Step 10 — expressionLabel 新签名 + character-sheet 映射
**Files**: `apps/client/src/lib/format.ts`、`apps/client/src/lib/character-sheet.ts`；新建 `apps/client/tests/expression-label.test.ts`、`apps/client/tests/character-sheet.test.ts`
**Changes**:
- `format.ts`：`expressionLabel(key, label?)` → `if (label) return label; if (!key) return t("expression.default"); return translateOr(\`expression.${key}\`, key);`。`EXPRESSION_KEYS` 的删除放到 Step 15（与唯一使用处 GM 页同步删），避免中间态类型断裂。
- `character-sheet.ts`：`CharacterPortrait` 增加 `label: string | null`；`mapCharacterRow` 映射 `label: item.label`（55-60 行）；`expressions` 用 `expressionLabel(item.expressionKey, item.label)`（82 行）。
- `expression-label.test.ts`：label 优先（`("toast_glass","举杯") → "举杯"`）、内置 i18n 兜底（`"smile" → "微笑"`）、未知 key 回落（`"toast_glass" → "toast_glass"`）、空 key（`null → "默认"`）。
- `character-sheet.test.ts`：用 `getRuleComponent("coc7e").createEmptySheet()` 造 `sheetJson`，断言 `expressions` 含 label、`portraits[0].label` 保留。
**Verify**: `cd apps/client && bun test --preload ./tests/setup.ts tests/expression-label.test.ts tests/character-sheet.test.ts`
**Done**: 两测试通过；`EXPRESSION_KEYS` 仍在但已无新语义依赖。

### Step 11 — composer / GM 控制台 / 舞台队列改用显示名
**Files**: `apps/client/src/features/play/composer.tsx`、`apps/client/src/features/gm-console/characters-panel.tsx`、`apps/client/src/features/gm-console/gm-panel-stage.tsx`
**Changes**:
- `composer.tsx`：选项映射（62-66 行）`label: expressionLabel(portrait.expressionKey, portrait.label)`；已选 trigger（206 行）`expressionOptions.find(o => o.key === expression)?.label ?? expressionLabel(expression)`。
- `characters-panel.tsx`（342-351 行）：`expressionLabel(portrait.expressionKey, portrait.label)`；下拉项直接来自快照 `portraits`（已排序），不新增排序。
- `gm-panel-stage.tsx`：`queueContext(item, expressionName?)` 用 `expressionLabel(item.expressionKey, expressionName)`；`QueueRow` 增加 `expressionName?: string | null`；`QueueCard` 取 `usePlayStore(s => s.characters)`，按 `characterId` + `expressionKey` 查 `portraits[].label ?? null` 传入。队列 DTO 不改。
**Verify**: `bun run --cwd apps/client typecheck`
**Done**: 三处不再用 raw key 作显示名；无立绘逻辑不变。

### Step 12 — chat-map + play-store 的 expression:changed 标签
**Files**: `apps/client/src/lib/chat-map.ts`、`apps/client/src/stores/play-store.ts`、`apps/client/tests/chat-map.test.ts`、`apps/client/tests/play-store.test.ts`
**Changes**:
- `chat-map.ts` 导入 `expressionLabel`；`expression:changed` 分支（280-289 行）从 `characterOf(payload.characterId)?.portraits` 按 key 查 `label`，用 `t("history.event.expression", { expression: expressionLabel(expressionKey, label ?? null) })`。查不到人物/立绘时内置 key 走 i18n、其余回落 key（设计 §7.2.4）。
- `play-store.ts`：`withActivityMessage` 增加可选 `characters = state.characters` 参数并传给 `mapActivityEvent`；`expression:changed` 先算 `nextCharacters`，再以 `{ characters: nextCharacters }` 及 `nextCharacters` 调用，确保从最新 roster 解析。
- 测试：`chat-map.test.ts` 的 `character()` 夹具补 `label`/`sortOrder`；扩展用例 portrait `{expressionKey:"smile", label:"微笑脸", sortOrder:0}` → body `表情切换为「微笑脸」`，无 label + 未知 key → 原 key。`play-store.test.ts`：applySnapshot 带 portraits label，再 applyMessage `expression:changed`，断言活动消息 body 用 label。
- 其他夹具（`coc-labels.test.ts`、`gm-state.test.ts`、`gm-workbench.test.tsx` 的 `portraits: []`）若类型报错补 `label: null, sortOrder: 0`。
**Verify**: `cd apps/client && bun test --preload ./tests/setup.ts tests/chat-map.test.ts tests/play-store.test.ts`
**Done**: 历史/活动消息显示表情名；已删回落 key；内置仍翻译。

## Phase 6 — 客户端：统一资料编辑器与新组件

### Step 13 — ExpressionManager
**Files**: 新建 `apps/client/src/features/characters/expression-manager.tsx`
**Changes**:
- Props：`{ characterId: string; portraits: CharacterPortraitDto[]; basePath: "/gm/characters" | "/pl/characters"; onChange: () => void }`。
- 列表：`portraits` 即显示序；每格缩略图 `mediaUrl(portrait.portraitAssetId)`、名字 `expressionLabel(portrait.expressionKey, portrait.label)`、默认星标、上移/下移、删除、行内改名。
- 添加：`<input type="file" multiple accept="image/*">`，每文件生成 pending 行，名字 `file.name.replace(/\.[^.]+$/, "")` 可编辑；「上传」顺序遍历：`POST /media/upload`（FormData：`file`、`purpose=portrait`、`filename`）→ `POST ${basePath}/${characterId}/portraits` body `{ label, portraitAssetId }`（不发 key）。每条成功即移除并 `onChange()`；失败保留、标红、`toast.error(t("expressions.uploadFailed", { name, reason: errorText(error, "expressions.uploadFailed") }))`，不中断后续（429 可重试）。
- 排序：交换相邻项后按 `0..n-1` 顺序 `PATCH .../portraits/${portraitId}` `{ sortOrder }`，全部完成 `onChange()`；下标访问加 `??` 守卫。
- 设默认：`PATCH .../portraits/${id}` `{ isDefault: true }`；已是默认则禁用（服务端互斥清其他默认）。
- 改名：行内 `Input`，Enter 提交 `PATCH { label }`、Esc 还原；空白名 toast 不提交（交互照 `routes/gm/music.tsx:103-137`）。
- 删除：`ConfirmDialog`（`components/shared/confirm-dialog`）+ `DELETE ${basePath}/${characterId}/portraits/${portraitId}`（**带 characterId**，替换现有 GM 页错误的 `/gm/characters/portraits/:id`）。
- 空态 `t("expressions.empty")`；无注释，只用现有 MD3 类。
**Verify**: `bun run --cwd apps/client typecheck`
**Done**: 组件可独立 typecheck；GM/PL 通用；无写死 key。

### Step 14 — CharacterProfileEditorDialog
**Files**: 新建 `apps/client/src/features/characters/character-profile-editor-dialog.tsx`
**Changes**:
- Props：`{ scope: "gm" | "pl"; character: CharacterDetailDto; open: boolean; onClose: () => void; onSaved: (character: CharacterDetailDto) => void }`。`scope` 为设计 props 的必要补充：GM/PL 的 PATCH 与立绘前缀不同，`basePath = scope === "gm" ? "/gm/characters" : "/pl/characters"`。
- 内容：姓名 `Input`（maxLength 100）、背景 `Textarea`（maxLength 4000）、规则只读 `Badge`（`character.ruleId`）、`ExpressionManager`。
- 保存：`PATCH ${basePath}/${character.id}` body `{ name, background, expectedVersion: version }`；成功 `toast.success(t("characterProfile.saved"))`，用返回 `CharacterDto` + 原 `portraits` 合成详情调 `onSaved(next)`，弹窗保持打开；失败 `toast.error(errorText(error, "characterProfile.saveFailed"))`。
- `useEffect` 监听 `[character.id, character.version]` 重置本地 name/background/version。
- `ExpressionManager.onChange`：重新 `GET ${basePath}/${character.id}` 取详情并 `onSaved(detail)`；单条失败只 toast。不做大事务；表情实时生效。
**Verify**: `bun run --cwd apps/client typecheck`
**Done**: GM/PL 共用弹窗；保存与表情操作互不阻塞。

### Step 15 — GM 人物页改造
**Files**: `apps/client/src/routes/gm/characters.tsx`、`apps/client/src/lib/format.ts`
**Changes**:
- 删除：`EXPRESSION_KEYS` 导出（format.ts:4-10，此时唯一使用处一并删）与页内导入、`expressionLabel` 导入（若不再使用）、`Select*` 导入与 283-301 行下拉、`ImageIcon`、`Upload`、仅旧网格使用的 `mediaUrl`、`portraitKey` state、旧上传 `<label><input file>` 逻辑、旧「已上传表情」网格（380-437 行）。
- 工具栏保留 导入 Excel / 编辑数值 / kebab 删除；新增「资料与表情」按钮（`Settings2` 图标）：`const detail = await api<CharacterDetailDto>(\`/gm/characters/${selected.id}\`); setProfileCharacter(detail);`，失败 `toast.error(errorText(error, "gm.characters.loadFailed"))`。
- 状态 `profileCharacter: CharacterDetailDto | null`；条件渲染 `{profileCharacter ? <CharacterProfileEditorDialog scope="gm" open character={profileCharacter} onClose={() => setProfileCharacter(null)} onSaved={next => { setProfileCharacter(next); void reload(); }} /> : null}`。
- 保留 132px arch 当前立绘预览（`selected.portrait` 来自 `mapCharacterRow`）；导入 `CharacterDetailDto`。
**Verify**: `bun run --cwd apps/client typecheck`
**Done**: GM 页无写死下拉/旧上传；旧端点 `/gm/characters/portraits/:id` 不再被调用；`rg EXPRESSION_KEYS apps/client/src` 无结果。

### Step 16 — PL 人物页改用统一弹窗
**Files**: `apps/client/src/routes/pl/characters.tsx`
**Changes**:
- 新建流程不变：`CharacterEditor` 只保留新建（移除 `state.character` 编辑分支与 `pl.characters.editTitle` 分支）。
- 编辑：按钮改异步 `const detail = await api<CharacterDetailDto>(\`/pl/characters/${character.id}\`); setProfileCharacter(detail);`，失败 `toast.error(errorText(error, "pl.characters.empty"))`。
- 状态 `profileCharacter: CharacterDetailDto | null`；条件渲染 `{profileCharacter ? <CharacterProfileEditorDialog scope="pl" open character={profileCharacter} onClose={() => setProfileCharacter(null)} onSaved={next => { setProfileCharacter(next); void load(); }} /> : null}`。
- 删除确认弹窗与布局不动；`EditorState` 简化为 `{ open: boolean }` 或布尔；导入 `CharacterDetailDto`。
**Verify**: `bun run --cwd apps/client typecheck`
**Done**: PL 可对自己 PC 做全部表情操作；新建仍走原流程。

### Step 17 — i18n 增删
**Files**: `apps/client/src/i18n/messages/zh-CN.ts`
**Changes**:
- 新增：`characterProfile.editTitle/name/background/rule/saved/saveFailed`；`expressions.title/add/addHint/pending/upload/uploading/namePlaceholder/nameRequired/uploadFailed/defaultBadge/setDefault/setDefaultFailed/moveUp/moveDown/reorderFailed/rename/renameFailed/deleteTitle/deleteDescription/deleteFailed/empty`。关键文案：`uploadFailed`「「{name}」上传失败：{reason}」、`deleteDescription`「确定删除「{name}」吗？团内当前使用该表情的人物会回落到默认表情。」、`moveUp/Down`「上移/下移「{name}」」。
- 删除（先 `rg` 复核全仓无引用）：`gm.characters.expressionShort`、`uploadPortrait`、`expressionAria`、`uploadedPortraits`、`uploadExpression`、`uploadFailed`、`deletePortrait`、`deletePortraitFailed`、`pl.characters.editTitle`。
- 保留 `expression.default` / `expression.smile` / `expression.surprised` / `expression.angry` / `expression.hurt`（内置 key 兜底）及 `gm.characters.portraitPreview/moreActions`、删除人物相关 key。
**Verify**: `rg "gm.characters.(expressionShort|uploadPortrait|expressionAria|uploadedPortraits|uploadExpression|uploadFailed|deletePortrait|deletePortraitFailed)|pl.characters.editTitle" apps/client/src`
**Done**: 仅 zh-CN.ts 中不再有这些 key；新增 key 均被组件使用。

## Phase 7 — 收尾验证与提交

### Step 18 — 全量类型检查、测试、边界
**Files**: 无
**Changes**: 无。
**Verify**:
```bash
bun run typecheck
bun run --cwd apps/server test
bun run --cwd apps/client test
bun run check:boundaries
rg "EXPRESSION_KEYS" apps packages
```
**Done**: 四项全绿；`rg` 无结果；无新增迁移/注释。

### Step 19 — 人工验收（用户执行）
1. GM → 人物管理 → 「礼帽男子」→「资料与表情」：批量选 3 张图、改其中一个名字后上传；重命名（Enter/Esc）、上/下移、设默认（星标唯一）、删除（确认弹窗），确认顺序与名字正确、失败项可重试。
2. PL → 我的人物 → 编辑自己 PC：重复上述操作；确认无他人人物入口。
3. 进团：composer 表情下拉与已选 trigger 均显示新名字；GM 控制台人物浮层下拉显示新名字且顺序一致；放行带自定义表情的演绎发言后舞台切换、历史显示表情名；删除正在使用的表情后舞台回落默认（无默认则第一张），历史旧消息回落可读 key。

### Step 20 — 提交
**Files**: 全部改动 + 本计划
**Changes**:
```bash
git add packages/shared/src apps/server/src apps/server/tests apps/client/src apps/client/tests docs/superpowers
git commit -m "✨ feat(characters): 支持自定义表情与统一人物资料编辑器"
```
不加 `Co-Authored-By`。
**Done**: 工作区只剩预期文件；提交信息为 gitmoji 格式。

## 风险与实现备注
- 自动 key 必须走 `RandomSource`，测试用 `ScriptedRandomSource` 才能稳定断言；不要用 UUID 截断。
- `findPortraitByExpression` 保持含软删语义供自动 key 查重；`portraitExists` 与 `SetExpressionHandler` 必须排除软删，二者语义不同，勿合并。
- 快照排序是客户端顺序唯一来源；composer / GM 面板不要重新排序。
- 批量上传严格串行，单条 429 只 toast，不重试整批、不改限速。
- GM 只看到/编辑自己名下人物（`ListCharactersUseCase(gm.userId)`），故 GM 弹窗 PATCH 不会触发 `CharacterNotOwnedError`，无需放宽权限。
- 历史/队列已删表情回落 key 是设计接受的低频泄漏，不扩协议、不加软删 label 查询。
