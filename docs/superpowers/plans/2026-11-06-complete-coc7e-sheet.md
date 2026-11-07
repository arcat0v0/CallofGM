# 完整 CoC 7e 数值卡实施计划

设计：`docs/superpowers/specs/2026-11-06-complete-coc7e-sheet-design.md`（已确认）

## 阶段 1：共享规则模型 ✅

- 升级 CoC sheet schema 至 v2，旧卡通过 zod.preprocess 自动规范化。
- 完整技能/专攻目录（45+ 标准技能 + 8 格斗专攻 + 7 射击专攻 + 16 技艺专攻 + 13 科学专攻 + 驾驶/生存/学识专攻）。
- 28 个参考职业，含可选属性公式。
- 统一 HP/MP/SAN、DB/体格、MOV、半值/五分之一、信用与资产公式。
- 公开投影剥离武器、护甲、装备、资产、法术、神话记录。
- 成长规则：奖励骰排除、信用评级/克苏鲁神话排除、技能值允许超过 100%。

## 阶段 2：服务端权威流程 ✅

- 玩法鉴定读取 session_characters.sheet_json 而非主卡。
- 审核版本在 decide 和入团路径生效（ReviewSheetVersionConflictError）。
- 同步预览包含 statePreview（当前/目标 HP/MP/SAN 上限）。
- 同步提交重算 HP/MP/SAN 上限，保留 HP/MP 损失并钳制 SAN，广播 session:refresh。
- 整卡写入、导入、成长与终生字段使用 CAS 乐观锁。
- 永久字段修改写入审计；路由接受并校验 expectedVersion。
- 团内快照按观察者返回完整卡、公开投影或 null，队友不收到武器、资产和法术。

## 阶段 3：Excel 导入 ✅

- `人物卡` / `简化卡` 固定布局优先解析，简单表格回退到通用扫描。
- 识别九属性、完整标准技能与专攻、自定义技能、年龄、时代、职业、信用与资产、武器、护甲、装备、法术和神话遭遇。
- 读取公式缓存值并使用 `xlsx.utils.encode_cell`，支持超过 Z 列和 `2万` 等资产写法。
- 预览同时保存完整卡与明确字段补丁；更新已有卡只覆盖明确出现的字段。
- 更新预览携带 characterId 查询参数和 expectedVersion，缺失字段进入保留路径而非静默覆盖。
- PL 与 GM 均复用导入预览/确认入口，PL 新导入归属 PL 且类型固定为 PC。

## 阶段 4：客户端完整流程 ✅

- 新建页、邀请新建、PL 已有卡和 GM 自建人物共用 CoC 7e 整卡编辑器。
- CharacterProfileEditorDialog 保存完整 sheetData 与 expectedVersion；玩家拥有的卡不允许 GM 绕过永久字段审计直接改数值。
- GM 人物面板提供同步预览、字段选择、HP/MP/SAN 上限变化展示和确认同步。
- GM 终生属性修正提供原因、版本冲突提示和最近审计记录。
- 团内人物卡展示职业/时代/年龄、衍生值、完整技能搜索与按权限可见的装备/资产/神话区段。
- 手机端技能目录按分组折叠，可在组内展开查看全部技能。

## 阶段 5：验证 ✅

- 全量 563 测试通过（shared 26 + server 296 + client 228 + theme-cli 2 + release 11）。
- `bun run typecheck`、`bun run check:boundaries`、`bun run build:client` 通过。
- 隔离数据库与端口完成独立建卡、未选规则草稿刷新恢复、PL 完整卡保存、邀请新建提交完成态。
- 已认证开发构建的 design-taste app inspector 为 0 FAIL / 3 WARN；1440、768、390 截图人工检查通过。
- 生产构建可加载；认证后的生产构建 inspector 在截图阶段超时，未计入通过项。
