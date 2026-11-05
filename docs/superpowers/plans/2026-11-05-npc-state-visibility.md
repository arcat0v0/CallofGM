# NPC 状态分项公开实施计划

设计依据：`docs/superpowers/specs/2026-11-05-npc-state-visibility-design.md`

## 阶段 1：共享协议与规则投影（TDD）

1. 在 CoC 7e 共享状态 schema 中新增公开项枚举（`hp` / `mp` / `san` / `statuses`）与公开状态视图 schema（数值成对可选、状态列表可选）。
2. 新增共享命令 `npc:state-visibility`（`characterId` + `fields`）与玩家投递事件 `state:public-changed`；`CharacterStateChangedEvent` 增加可选 `publicState`。
3. `SnapshotCharacter` 增加 GM 专用的可选 `publicState` 与 `publicStateFields`。
4. 服务端 `RuleSystem` 抽象新增：
   - 规则声明的可公开字段；
   - `projectPublicSessionState(state, fields)`，空字段返回 `null`，未知字段报错，输出仅含成对字段。
5. CoC 7e 实现上述投影；先写规则投影单元测试，覆盖空配置、单项、组合项、全项、未知字段与不泄露标签/成长。

## 阶段 2：服务端持久化与投递

1. `session_characters` 增加 `public_state_fields_json`，默认 `[]`；用 drizzle-kit 生成迁移并跑 `db:check`。
2. 新增 `playerOnly` 可见范围：所有非 GM 连接可见，包含 PC 与 OB；GM 不可见。快照、ring buffer、outbox 补发共用。
3. 新增 `NpcStateVisibilityHandler`：
   - 仅 GM、未结团可执行；
   - 校验本团未删除 NPC 与规则字段；
   - 更新配置；
   - GM 收 `npc:state-visibility-changed`（完整 state、publicState、fields），非 GM 收 `state:public-changed`（公开投影或 `null`）。
4. 调整 NPC 状态变更事件：
   - GM 事件 `state:changed` 携带完整 state 与更新后的 `publicState`；
   - 有公开项时非 GM 收 `state:public-changed`；
   - 玩家投影不进历史、不写检查点；公开配置变化不进历史、不被回溯。
5. 快照裁剪：
   - PC 行为不变；
   - 非 GM 的 NPC `state` 为公开投影或 `null`；
   - GM 的 NPC 附带 `publicState`、`publicStateFields`。
6. 先写并运行真实 WS 集成测试：默认隐藏、分项公开、状态变更、取消公开、断线补发、非法输入、非 GM 拒绝、PC 回归。

## 阶段 3：客户端舞台与 GM 配置

1. 规则注册表增加通用状态条视图数据与公开项选项，不再要求舞台解析完整 CoC 状态。
2. `PortraitLayer` 改为轻量状态区：名字独立、无大卡片背景、只渲染可见项；PC 显示现有三项与状态标记，NPC 按公开项渲染。
3. GM 人物面板 NPC 展开区新增公开项 Checkbox，即时发送 `npc:state-visibility`，折叠摘要反映公开状态。
4. `play-store` 处理 `state:public-changed`、GM 的 `publicState`/`publicStateFields` 与配置变更事件。
5. 玩家视角预览传入玩家受众视角，NPC 使用服务端 `publicState`。
6. 先写客户端状态条渲染与 store 事件测试，再实现 UI；新增 zh-CN 文案键。

## 阶段 4：文档与全量验证

1. 更新 `docs/product.md`、`docs/architecture.md` 中 NPC 状态可见性、事件可见范围与 GM 预览描述。
2. 运行 `bun run test`、`bun run typecheck`、`bun run check:boundaries`、`bun run db:check`。
3. 对改动文件执行 Biome 检查与格式化。
4. 汇总已验证项；浏览器视觉与交互留给用户验证。

## 边界约束

- 不改变 PC 可见性、OB PC 数值设置、状态编辑规则或 NPC 人物卡可见性。
- 不把公开配置写入模板、运行时检查点或回溯恢复数据。
- 通用代码不得新增 CoC 字段硬编码；状态条数据由规则注册表提供。
- 不新增代码注释；不提交本次任务外的改动。
