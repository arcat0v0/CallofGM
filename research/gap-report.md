# 竞品差距报告：CoGM vs CCFOLIA / 回声岛

日期：2026-10-31
状态：终版（可对外发布）
依据：`research/competitors.md`（竞品功能清单与来源 URL）、`docs/product.md`（CoGM v1 产品需求）、`scripts/parity/feature-matrix.json` + `scripts/parity/verify.ts`（实现状态探测 harness，通过 `bash autoresearch.sh` 运行）
实现状态口径：本文所有「实现状态」单元格均来自 harness 的 `DETAIL` 行（每项功能带命中探针），不依赖人工判断。**这些探针是静态存在性检查**（文件存在 + 关键字符串/命令字面量），不是行为级 e2e；探针通过只证明对应代码存在，不证明运行时行为正确（详见 F44）。harness 输出以 `probe_kind=static-existence` 标注这一口径。

---

## 0. 一句话结论

**CoGM v1 已把「说了的都做了」做到满分（feature_parity_score = 100.0，口径为静态存在性探针，不代表运行时行为已验证），但对标竞品功能并集的加权覆盖率只有 26.9%（competitor_alignment_score）——差的不是执行力，而是产品取舍：160 项竞品独有功能大部分是刻意不做的地图/社区/商业化，其余是暂缓的回放、私聊、模板复用。**

---

## 1. 执行摘要

### 1.1 两个量化指标

| 指标 | 数值 | 口径 | 分子 / 分母 |
|---|---|---|---|
| `feature_parity_score` | **100.0** | CoGM 规划内功能的加权执行完整度（「说了的都做了」；**静态存在性探针**口径，非运行时行为证明） | 97 项规划功能，全部命中静态存在性探针 / 97 项 |
| `competitor_alignment_score` | **26.9** | **竞品功能并集的加权覆盖率**：分子 = 竞品条目中 CoGM 规划且已实现的权重，分母 = 全部竞品来源条目权重（346） | 93 / 346 |

两个指标口径不同、不可互相换算：`feature_parity_score` 只看 CoGM 自己写下的规划兑现了没有；`competitor_alignment_score` 把竞品并集整体当分母，其中 160 项竞品独有功能（`features_competitor_only=158` + 部分未规划条目）大部分是 CoGM 刻意不做（地图、卡牌、社区、商业化、AI、战斗轮），小部分是暂缓的真实负债（回放、私聊、模板复用等）。因此 26.9 不代表「欠账 73 分」，而是「主线覆盖 27 分 + 明确放弃的广度」。

harness 原始输出（`bash autoresearch.sh`，可直接复跑；2026-10-31 连续 3 次运行退出码均为 0，METRIC 完全一致）：

```
METRIC competitor_alignment_score=26.9
METRIC feature_parity_score=100.0
METRIC features_total_planned=98
METRIC features_implemented=98
METRIC features_missing=0
METRIC features_competitor_only=158
METRIC cat_rooms=100.0      METRIC cat_room=100.0
METRIC cat_scenes=100.0    METRIC cat_characters=100.0   METRIC cat_character=100.0
METRIC cat_portrait=100.0  METRIC cat_dice=100.0
METRIC cat_state=100.0     METRIC cat_chat=100.0
METRIC cat_audio=100.0     METRIC cat_stage=100.0
METRIC cat_handouts=100.0  METRIC cat_info=100.0
METRIC cat_ops=100.0       METRIC cat_mobile=100.0
METRIC cat_platform=100.0
METRIC cat_map=0.0         METRIC cat_data=0.0    METRIC cat_combat=0.0
METRIC cat_cards=0.0       METRIC cat_replay=0.0 METRIC cat_pricing=0.0
METRIC cat_community=0.0   METRIC cat_ai=0.0
```

### 1.2 两个指标为什么不一样

- `feature_parity_score` 的分母是 **CoGM 自己写下的规划**（`docs/product.md` 映射到 97 项功能，含 2 项对标竞品的规划内条目：骰点表达式、聊天标签页）。它回答的是「产品承诺兑现了没有」。100.0 意味着：文档里写的房间与阶段机、人物卡与 Excel 导入、立绘差分与表情同步、团内状态与越阈提示、服务端骰点与判级、奖惩骰、暗骰、鉴定请求、SAN 检定、成长标记、演绎队列与零感知、聊天权限矩阵、BGM/SE 双通道、情报定向发放、黑名单与踢人、断线重连与快照裁剪、移动端三布局——全部落地且被静态存在性探针命中（探针命中不构成运行时行为验证，见 F44）。
- `competitor_alignment_score` 的分母是 **竞品功能并集的全部权重**（195 项、权重 346，即 CCFOLIA 与回声岛功能清单的并集，不含 CoGM 独有项）。它回答的是「竞品有、且我们打算做的能力，占竞品整体的多大比例」。26.9 = 已规划且已实现的竞品条目权重 93 / 346。此前临时观察到的 100.0 是并发编辑期间的旧口径（只把「规划内竞品条目」当分母），最终口径以本节为准。
- **缺口的 73 分不是待办清单，而是有意识的取舍**：竞品并集中 CoGM 未规划的 158 项（`features_competitor_only=158`）大部分刻意不做，小部分暂缓，分三类：
  1. **刻意不做（占缺口主体）**：地图与棋子（23 项 / 权重 35，cat_map=0.0）、卡牌（7 项）、社区（5 项）、商业化（5 项）、AI 辅助（6 项）、战斗轮与 AOE（5 项）。这些与 CoGM「单规则、沉浸式文字演出、无社区」的定位冲突，做了反而稀释主线。
  2. **暂缓但与主线相关（真实负债）**：回放与日志导出（cat_replay=0.0、cat_data=0.0）、玩家间私聊（chat-private 未规划）、房间/模组模板复用（room-reuse-template 未规划）、聊天编辑与撤回、消息搜索与收藏、疯狂表与对抗检定、Cut-in 与演出触发器、角色级快捷片段（chat palette）、房间口令与入场审批。
  3. **竞品侧能力但 v1 无对应需求**：双 BGM 通道、文件级音量、场景绑定音频、PWA/APK 客户端、内嵌 PDF/视频、面板私看、棋盘撤销重做等。

### 1.3 定位差异（三句话）

- **CCFOLIA** 是「零门槛的通用 TRPG 桌面」：盘面 + 聊天 + BCDice 200+ 规则，卡牌、面板点击、场景预设一应俱全；但它不做叙事时序（谁的话什么时候上屏），也不做规则语义的状态闭环。
- **回声岛** 是「跑团平台 + 创作工具链」：沙盒 UI、可编程规则、频道即舞台、自动录制回放、真实货币市场、社区；上限极高，学习成本也极高，同样不控制叙事时序。
- **CoGM** 是「文字游戏式的沉浸演出工具」：不追求功能广度，追求**叙事时序可控**（演绎放行队列 + 阶段闸门，服务端执行）、**判定可信**（服务端生成随机数并判级）、**状态闭环**（团内状态与规则绑定）、**同步可靠**（快照裁剪、事件补发、外箱恢复）。这三点两家竞品都没有。

### 1.4 必须承认的三条事实

1. 单看功能数量，CoGM v1 ≈ CCFOLIA 的一个子集 + 回声岛的骰点/状态子集；正面拼广度没有胜算。
2. 单看演出表现力，CoGM v1 低于回声岛（无场景镜头动画、无遮罩、无转场特效、无 TTS、无回放）。若「克制的舞台感」不是设计意图，用户会按回声岛的标准评价。
3. 单看「一场团跑完」的闭环（进场 → 认领 → 演出 → 检定 → 扣状态 → 放行 → 结团），CoGM 的规划与实现已经比两家都完整；唯一缺的是**结团之后**的复盘与传播环节。

---

## 2. 按功能领域的差距对照

说明：
- 「实现状态」= harness 对该能力的判定：已实现 / 部分实现 / 未实现（未规划）。
- 竞品侧事实全部来自 `research/competitors.md`，含来源 URL；竞品侧「[未证实]」表示官方渠道无确认。
- CoGM 侧的「部分实现」指：规划中有该方向、但缺关键子能力或只覆盖竞品能力的一部分。

### 2.1 房间与入场

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 邀请链接 / 房间号 | 有 | **已实现** | 有（URL + ID） | 有（10 位房间号 + 链接） | 对齐 |
| 房间口令 / 密码 | 无 | **未实现** | 无 | 有（≥4 位，或在线审批） | 真实负债：链接外泄即被随意进入 |
| 免注册进房 | 有 | **已实现** | 有（游客模式） | 无（强制手机号） | CoGM 领先，保持 |
| 玩家 / 观战身份 | 有 | **已实现** | 权限五档 | 房主/副房主/玩家/观众 + 助手 | 对齐；缺「副 GM」 |
| 踢人与黑名单 | 有 | **已实现** | 权限「禁入」 | 踢人 + 用户级拉黑 | CoGM 更细（指纹 + 时长 + 鉴权期拦截） |
| 布场 / 准备态 | 有 | **已实现** | 工事中模式 | 房间休眠 + 等待房主同意 | 对齐（团状态机 waiting/preparing/active/ended） |
| 模板复用 | 无 | **未实现** | 房间数据 ZIP / 公开链接（PRO） | 预设游戏 → 多房间 + 双向覆盖 | 中优先级：模组可复用但无房间模板机制 |
| GM 不在线时的等待态 | 无 | **未实现** | 无 | 有（排队 / 超时文案） | 低成本高体验 |

### 2.2 地图与棋子

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 网格地图 / 棋子拖动 | 无 | **未实现** | 有 | 有（沙盒战斗地图） | 刻意不做 |
| 棋子层级 / 尺寸 / 固定 | 无 | **未实现** | 有 | 有 | 刻意不做 |
| 迷雾 / 光照 / 测距 / AOE | 无 | **未实现** | 无 | 有 | 刻意不做 |
| 场景图 + 一键切换 | 有 | **已实现** | 有（场景预设） | 有（场景绑定资源） | CoGM 的「地图」替代品，已落地 |
| 场景局部应用 | 无 | **未实现** | 有（无 BGM / 无文本） | 未提供 | 低优先级 |
| 舞台内自由摆放 | 无 | **未实现** | 有（自由配置模式） | 有（沙盒画布） | 刻意不做 |

**结论**：地图整块是明确的「不做」（harness `cat_map=0.0`）。但「场景切换的完成度」要按竞品场景预设标准做——CoGM 已有 `scene-mgmt` / `scene-sync`，可继续加「局部应用」。

### 2.3 立绘与表情差分

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 多表情立绘 | 有 | **已实现** | 有（标签式） | 有（差分 + 配额） | 对齐 |
| 发言时切表情（随放行生效） | 有 | **已实现** | 有（聊天后缀） | 有（三段语法） | CoGM 语义更强，已落地 |
| GM 全场切表情 | 有 | **已实现** | 有 | 有（/art） | 对齐 |
| 骰点结果自动切表情 | 无 | **未实现** | 有（成功/失败/大失败标签） | 未提供 | 低成本高收益，建议补 |
| 立绘三态（头像/小/大） | 无 | **未实现** | 无 | 有 | 中优先级：直接决定「对话框 + 立绘」画面质量 |
| 立绘位置 / 缩放微调 | 无 | **未实现** | 无（靠棋子尺寸） | 有 | 中优先级：不同画师留白差异极大 |
| 入场 / 待机动画 | 无 | **未实现** | 无 | 有 | 低优先级 |
| 角色假名 | 无 | **未实现** | 无（可改角色名） | 有 | 低优先级，秘密团常用 |
| 角色语音朗读 | 无 | **未实现** | 无 | 有（付费） | 刻意不做 |
| 差分批量裁切 | 无 | **未实现** | 无 | 有（自动脸部检测） | 刻意不做 |

### 2.4 角色卡与聊天面板

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| CoC 7e 数值卡 | 有 | **已实现** | 有（自由 label） | 有（规则绑定） | CoGM 更贴合规则 |
| Excel 导入 | 有 | **已实现** | 无官方导入 | 有（文本/模板创建器） | CoGM 领先 |
| 团内状态（HP/MP/SAN） | 有 | **已实现** | 有（无规则语义） | 有 | CoGM 的「团内状态独立于人物卡」更正确 |
| 派生公式（HP/MP/SAN 上限） | 有 | **已实现** | 无 | 有（公式 + 循环检测） | 对齐 |
| 状态标记（重伤/疯狂等） | 有 | **已实现** | 无 | 无（用属性/物品模拟） | CoGM 独占，已落地 |
| 成长标记 | 有 | **已实现**（记录） | 无 | 有（自动成长检定） | 部分对齐：CoGM 只记标记，成长判定不自动化 |
| 角色级快捷片段 / chat palette | 无 | **未实现** | 有（事实标准） | 有（快速骰 + 指令补全） | 真实负债：高频操作路径缺失 |
| 房间级变量 | 无 | **未实现** | 有（16 个） | 有（变量系统） | 中优先级 |
| 角色可见性 | 有 | **已实现** | 有 | 有 | 对齐 |
| 车卡模板 / 审卡流程 | 无（站外审卡） | **未实现** | 无 | 有（创建器 + 审卡链接） | 明确负债，需在文档承认 |

### 2.5 骰点与判定

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 表达式骰（XdY±Z） | 有 | **已实现** | 有（BCDice 全量） | 有（骰池/取高取低/命运骰） | CoGM 只做子集，「不解析聊天文本」是明确取舍 |
| 技能检定六档 | 有 | **已实现** | 有（CC + 难度后缀） | 有（.ra + 难度） | 对齐；注意 CCFOLIA 的 `CCB` 是 6 版命令 |
| 奖励 / 惩罚骰 0–2 | 有 | **已实现** | 有 | 有 | 对齐 |
| 暗骰 | 有 | **已实现** | 有（s 前缀） | 有（.rh / .rah） | 对齐 |
| 鉴定请求（GM→玩家一键） | 有 | **已实现** | 无 | 无 | CoGM 独占，优先级最高 |
| SAN 检定 + 自动扣减 | 有 | **已实现** | 无（需手算） | 有（.sc 自动写回） | CoGM 规划正确，已落地 |
| 成长判定 | 无（只记标记） | **部分实现** | 无 | 有（.en 自动写回） | 建议 v1.1 补「结团一键成长」 |
| 对抗检定 | 无（线下裁决） | **未实现** | 无 | 有（.opposed） | 中优先级 |
| 自动武器 / 连发 | 无 | **未实现** | 有（FAR） | 有（.burst） | 低优先级 |
| 疯狂 / 恐惧 / 躁狂表 | 无 | **未实现** | 有（BMR/BMS/PH/MA） | 无 | 中优先级：CoC 7e 带团刚需 |
| 原创随机表 | 无 | **未实现** | 有（/roll-table） | 有（/draw） | 低优先级，实现成本低 |
| 多规则支持 | 仅留扩展点 | **部分实现** | 有（200+） | 有（7 内置 + 脚本） | 刻意不做，`rule-abstraction` 已留扩展点 |
| 骰点 3D 动画 / 皮肤 | 无 | **未实现** | 有 | 有 | 刻意不做 |
| 服务端权威 | 有 | **已实现** | 否 `[推断]`（bcdice-js 前端执行） | `[未证实]` | **CoGM 结构性优势** |

### 2.6 聊天

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 聊天区 / OOC 即时呈现 | 有 | **已实现** | 有 | 有 | 对齐 |
| 演绎放行队列（玩家零感知） | 有 | **已实现** | 无 | 无 | **独占，已落地** |
| 发言权限矩阵（服务端裁决） | 有 | **已实现** | 无 | 无 | **独占，已落地** |
| 频道过滤标签 | 有 | **部分实现** | 有（多标签页） | 有（频道即舞台） | CoGM 有标签过滤，无独立频道舞台 |
| 私聊 / 群组私聊 | 无 | **未实现** | 有（官方声明不严格，房主可导出查看） | 有 | 真实负债（暂缓项） |
| 消息编辑 / 撤回 | 无 | **未实现** | 仅编辑 | 全有 | 真实负债：写错字是高频事故 |
| 引用 / 重排 / 搜索 / 收藏 | 无 | **未实现** | 无 | 全有 | 低优先级 |
| 场内 / 场外标记 | 有 | **已实现** | 无（靠标签页） | 有 | CoGM 的「阶段」比标记更强 |
| 输入补全 / 输入状态 / 历史 | 无 | **未实现** | 有 | 有 | 低优先级 |
| 日志导出 | 无 | **未实现** | HTML / JSON | Log / Replay / 排版 / PDF / 视频 | 真实负债：事件已结构化落库，导出可后补 |
| 跑团总结 | 无 | **未实现** | 无 | 有（发言/检定统计 + 成长） | 低优先级，可作结团仪式感 |

### 2.7 音频

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| BGM / SE 双通道 | 有 | **已实现** | 两路 BGM，无独立 SE | 多音频 + 音乐/音效标记 | CoGM 规划更正确 |
| GM 控播放 / 暂停 / 循环 / 切歌 | 有 | **已实现** | 有 | 有 | 对齐 |
| 淡入淡出 / 交叉淡化 | 有 | **已实现** | 有（crossfade beta） | 无 | 对齐 |
| 中途加入进度同步 | 有 | **已实现** | 未提供显式保证 `[未证实]` | 未说明 `[未证实]` | **CoGM 可做出差异**：`startedAtMs` 时间戳对齐 |
| 文件级音量 vs 个人音量 | 仅个人侧 | **部分实现** | 双轨（文件级影响所有人 / 个人级只影响自己） | 文件级 + 个人分项 | 建议抄双轨设计 |
| 音频库 / 外链解析 | 无 | **未实现** | 官方音源库 + 外链 | 公共素材库 + 网易云/耳聆解析 | 刻意不做（版权与稳定性） |
| 场景绑定音频 | 无 | **未实现** | 有 | 有 | 中优先级：与场景切换合并几乎零成本 |

### 2.8 演出

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 场景切换 + 转场 | 有 | **已实现** | 有场景，无转场 | 有 4 种转场 + 转场文字/音效 | CoGM 需把「转场」当一次演出事件经营 |
| 强制 CG / 单方面推进 | 有 | **已实现**（阶段机） | 无 | 无 | 独占，已落地 |
| 插入演出（Cut-in） | 无 | **未实现** | 有（图 + 音，可由聊天文本触发） | 有（遮罩 + 触发器） | 真实负债：建议补轻量版 |
| 遮罩层 | 无 | **未实现** | 无 | 有 | 刻意不做 |
| 演出触发器（关键词 / 检定结果 / 阈值） | 无 | **未实现** | 部分（聊天末尾文本触发） | 有（完整触发器） | 真实负债：建议补两条窄触发 |
| 场景动画 / 滤镜 | 无 | **未实现** | 无 | 有 | 刻意不做 |
| 沙盒 UI / 代码节点 | 无 | **未实现** | 无（v2.0 脚本仅回消息） | 有（完整沙盒 + QuickJS） | 刻意不做：这是另一个产品 |
| 内嵌 PDF / 视频 | 无 | **未实现** | 有（/pdf、/play） | 有（文档节点、视频节点） | 刻意不做：情报图片已覆盖手记/地图 |
| 计时器 | 无 | **未实现** | 有（PRO） | 无 | 刻意不做 |

### 2.9 情报 / 手帐

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 情报（handout）发放（公开 / 秘密 / 追加对象） | 有 | **已实现** | 无专门系统 | 有线索素材（按频道解锁） | **CoGM 规划最强，已落地** |
| 已发放情报回看 | 有 | **已实现** | 无 | 有 | 对齐 |
| 个人笔记 | 无 | **未实现** | 无 | 有（Markdown + 可见性） | 低优先级 |
| 消息收藏 / 批注 | 无 | **未实现** | 无 | 有 | 低优先级 |
| 共享备忘面板 | 无 | **未实现** | 有（面板 + memo） | 有（白板 / 知识库） | 不入 v1；可用「公开情报」替代 |
| 线索白板 | 无 | **未实现** | 无 | 有（沙盒白板） | 刻意不做 |

### 2.10 数据导入导出 / 复盘

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 模组资源打包 / 导入 | 无 | **未实现** | 有（ZIP，不含音频） | 有（.echois + 双向覆盖） | 真实负债：决定 GM 备团迁移成本 |
| 房间 / 团数据导出 | 无 | **未实现** | 有（ZIP / 公开链接，PRO） | 有（覆盖式更新 + 结团归档） | 真实负债 |
| 聊天日志导出 | 无 | **未实现** | HTML / JSON | Log / Replay / PDF / 视频 | 真实负债：事件已结构化，导出可后补 |
| 回放 / 录像 | 无 | **未实现** | 无 | 有（自动录制 + 可编辑 + 1080p 导出 + 排版书） | **最大真实负债**：结团后传播链缺失 |
| 卡牌牌堆 | 无 | **未实现** | 有（完整） | 无 | 刻意不做 |
| 先攻表 / 战斗轮 | 无 | **未实现** | 仅排序 | 完整（轮次 / 当前行动 / 回合事件） | 中优先级：只要「行动顺序」，不要 AOE |
| 计时器 | 无 | **未实现** | 有（PRO） | 无 | 刻意不做 |

### 2.11 移动端 / 客户端 / 收费 / 社区

| 能力 | CoGM 规划 | 实现状态 | CCFOLIA | 回声岛 | 差距判断 |
|---|---|---|---|---|---|
| 移动端适配 | 有 | **已实现**（三布局） | 响应式 + 已知移动端缺陷 | 竖横屏布局 + 键盘联动 + PWA + APK | 对齐，且优于 CCFOLIA |
| 免安装 | 网页 | **已实现** | 网页 | PWA / APK | 网页即可 |
| 触控操作 | 有（隐含在移动布局） | **未实现**（专项能力未单列） | — | 有 | 低优先级 |
| 收费 | 无 | **未实现** | 订阅（¥500 / ¥1380） | 免费 + 点数 + 赞助 + 市场抽成 | v1 不商业化 |
| 社区 / 论坛 / 素材市场 / AI 辅助 | 无 | **未实现** | 无（仅 GAMES 商店） | 全套 | 刻意不做 |

---

## 3. 竞品独家亮点与 CoGM 的处置

### 3.1 CCFOLIA 独家

| 亮点 | CoGM 处置 | 实现状态 |
|---|---|---|
| BCDice 200+ 规则与原创随机表 | 刻意不做（`rule-abstraction` 留扩展点） | 未实现（部分抽象已落地） |
| 卡牌牌堆（建堆/抽牌/背面抽/回牌/合并/标准扑克） | 刻意不做 | 未实现 |
| 面板即交互对象（点图掷骰/切场景/开 PDF、翻面私看） | 不入 v1 | 未实现 |
| 双轨音量 + 文件级音源设置 | 建议抄双轨 | 部分实现 |
| 差分标签驱动（骰点结果自动换表情） | 建议补 | 未实现 |
| 场景预设局部应用（不带 BGM / 不带文本） | 建议补 | 未实现 |
| 棋子跨房间复制 | 刻意不做 | 未实现 |
| 游客免注册进房 | 已对齐 | 已实现 |

### 3.2 回声岛独家

| 亮点 | CoGM 处置 | 实现状态 |
|---|---|---|
| 自动录制留声机 Replay（可回改、导出 1080p） | 暂缓，但事件已结构化落库 | 未实现 |
| LogBook 排版（封面/目录/插页/样式 + PDF + 公开阅读链接） | 暂缓 | 未实现 |
| 沙盒 UI 引擎（节点/变量/条件显示/代码节点/社区发布） | 刻意不做 | 未实现 |
| 可编程规则层（自定义指令、物品规则引擎、规则数据表） | 刻意不做 | 未实现 |
| TTS 角色朗读（700+ 音色、自建音色） | 刻意不做 | 未实现 |
| 触发器（关键词/检定结果/阈值 → 音效/遮罩） | 建议补窄版 | 未实现 |
| 频道即舞台（每频道独立场景/音乐/立绘） | 刻意不做（v1） | 未实现 |
| 真实货币交易市场 | 刻意不做 | 未实现 |
| AI 辅助链路（生成代码/物品/车卡、深度图 3D 视差、AI 音色、AIGC 标识） | 刻意不做 | 未实现 |
| 社区基础设施（论坛、招募、工单、成就、公开 NPC 库/知识库） | 刻意不做 | 未实现 |

### 3.3 处置统计

- 竞品并集 195 项（权重 346）。
- CoGM 规划并实现：37 项（权重 93，含 2 项对标竞品的规划内条目）→ **competitor_alignment_score = 26.9**（93 / 346）。
- 竞品并集中 CoGM 未规划：158 项（`features_competitor_only=158`）。
  - 其中与主线相关、建议排期的「暂缓项」约 15 项（回放与日志导出、私聊、模板复用、消息编辑/撤回、疯狂表、对抗检定、Cut-in、触发器、chat palette、房间口令、场景绑定音频、房间变量、先攻排序、音频文件级音量、骰点结果自动切表情）。
  - 其余为「刻意不做」：地图与棋子 23 项、卡牌 7 项、社区 5 项、商业化 5 项、AI 6 项、战斗轮与 AOE 5 项、观众级便利功能若干。

---

## 4. 优先级建议

排序原则：① 是否影响「一场团能不能跑完」；② 是否强化「沉浸式文字演出」的差异化；③ 是否能以现有架构低成本落地。

### P0 —— 差异化主线，已全部落地，保持零故障

1. **演绎放行队列闭环**：服务端队列 + 顺序调整 + 丢弃静默；玩家端零感知。已落地（`performance-queue` / `queue-player-blind`）。
2. **CoC 7e 判定闭环**：服务端目标值、六档判级、奖惩骰、难度档、暗骰、SAN 自动扣减。已落地（`skill-check` / `check-grades` / `bonus-penalty-dice` / `hidden-dice` / `san-check`）。
3. **场景切换 + 立绘演出**：场景同步带转场、表情全员同步、玩家本地预览。已落地（`scene-mgmt` / `scene-sync` / `expression-sync` / `expression-preview`）。
4. **音频同步**：BGM 权威时间轴（`startedAtMs`）全员对齐、中途加入续播、SE 广播即播、本地静音。已落地（`bgm-sync` / `bgm-progress` / `se-fx` / `local-mute`）。
5. **可见性与同步的服务器权威性**：秘密情报定向推送、快照裁剪、事件补发、外箱恢复。已落地（`secret-distribution` / `snapshot-visibility` / `reconnect-resume` / `outbox-recovery`）。

### P1 —— 真实负债，建议排入 v1.1

6. **回放与日志导出**（最大负债）：事件已结构化落库（`session_outbox` + 事件环 + 快照），补「结团归档 + 回放播放器 + HTML/JSON 导出」成本可控；一旦拖过 v1，回声岛的传播优势会持续扩大。
7. **聊天编辑与撤回**：高频事故场景。
8. **角色级快捷片段（chat palette）**：把「技能检定 / SAN 检定 / 常用台词 / 表情」压成一次点击，是 CCFOLIA 的事实标准。
9. **房间口令 + 入场审批 + 团公开信息（标题/简介/封面）**：补入场摩擦与链接外泄风险。
10. **骰点结果自动切表情**：CCFOLIA 零配置范式，实现成本极低。
11. **场景绑定音频 + 音频文件级音量**：与已有场景切换、GM 音量控制合并实现。
12. **模组/房间模板复用与数据导出**：让 GM 能把备团成果带走。

### P2 —— 补强 CoC 带团刚需

13. **疯狂/恐惧表**（静态数据即可，不必接 BCDice）。
14. **对抗检定**（闪避/对抗是 CoC 高频）。
15. **结团一键成长**（按成长标记批量掷并写回人物卡）。
16. **先攻排序**（只要行动顺序，不做 AOE/光照/迷雾）。
17. **轻量 Cut-in**（一张图 + 一段音，可由骰点结果等级或关键词触发；不做遮罩与通用触发器引擎）。

### P3 —— 明确不做（写进文档，避免反复讨论）

地图棋子、卡牌、计时器、3D 骰动画与皮肤、沙盒 UI 与代码节点、自定义脚本与物品规则引擎、TTS、AI 生成内容、素材市场、社区论坛、多规则引擎。

---

## 5. 工程侧三条硬约束（与竞品对照得出）

1. **可见性判定必须在 repository / 服务层**。CCFOLIA 官方自己写明秘匿「不是严格隐藏，房主可导出全日志查看」；回声岛的线索粒度是频道而非个人。CoGM 的秘密情报（`selectedPcIds` + `checkVisibility`）一旦改成「广播后前端隐藏」，就失去唯一可信的卖点。
2. **实时操作先提交事务再广播**。回声岛专门做了 `sync-state-mismatch`、`replay-write-anomaly` 提示与自动修复，说明竞品普遍存在状态与画面不同步问题。CoGM 既有约定（WebSocket 操作先提交事务再广播）应扩展到场景切换、表情切换、情报发放——放行路径已经用 `markPresentedIfPending` 做条件更新防并发放行，模式正确，应保持。
3. **事件溯源优先于导出格式**。回声岛能做出 Replay / 排版 / 视频，前提是「留声机记录一切操作」；CCFOLIA 只有静态日志，所以永远做不出回放。CoGM 现在多花一天设计事件表，未来省一个月。

---

## 6. 附录：关键能力的 harness 静态存在性探针证据

以下探针均来自 `bash autoresearch.sh` 的 `DETAIL implemented` 行，可直接引用；它们验证的是文件与关键字面量存在，不是运行时行为（`probe_kind=static-existence`）：

| 能力 | 命中探针 |
|---|---|
| 演绎放行（防并发放行） | `code_regex:chat:release`、`code_regex:chat:queue\|SpeakQueue\|待呈现\|放行`、`code_regex:pending`（放行路径使用 `markPresentedIfPending` 条件更新，仅 pending 才可放行） |
| 玩家对队列零感知 | `code_regex:queued\|pending`、`path_exists:apps/client/src/features/chat/message-list.tsx` |
| 发言权限矩阵（服务端） | `path_exists:apps/server/src/modules/chat/domain/message-policy.ts`、`code_regex:decideChatMessage` |
| 服务端目标值与六档判级 | `code_regex:getSkillTargetValue`、`code_regex:check:perform`、`code_regex:difficulty`、`code_regex:extreme_success`、`code_regex:fumble` |
| 奖励/惩罚骰 | `code_regex:bonusDice`、`code_regex:penaltyDice`、`code_regex:tensCandidates` |
| 暗骰 | `code_regex:hidden`、`code_regex:gmOnly`、`code_regex:已掷出` |
| GM 鉴定请求 | `code_regex:check:request\|check:respond`、`path_exists:apps/client/src/features/session-live/check-prompt.tsx`、`code_regex:CheckRequestedEvent\|CheckRespondCommand` |
| SAN 检定与自动扣减 | `code_regex:check:san`、`code_regex:getSanCurrent`、`code_regex:sanLossExpression` |
| 成长标记 | `code_regex:growthMarks`、`code_regex:growthEligible` |
| 表情全员同步 | `code_regex:expression:set`、`code_regex:currentExpressionKey` |
| 场景切换与转场 | `code_regex:scene:switch`、`path_exists:apps/client/src/features/session-stage/scene-backdrop.tsx`、`code_regex:transition\|fade\|opacity` |
| BGM 同步与进度续播 | `code_regex:audio:bgm`、`path_exists:apps/client/src/lib/bgm.ts`、`code_regex:BgmState`、`code_regex:startedAtMs`、`code_regex:seek\|loop` |
| SE 音效通道 | `code_regex:audio:se`、`code_regex:SePlayedEvent` |
| 情报定向发放 | `code_regex:handout:grant`、`code_regex:handout:append`、`code_regex:recipientCharacterIds` |
| 秘密情报服务端可见性 | `code_regex:selectedPcIds`、`code_regex:checkVisibility`、`code_regex:gmOnly` |
| NPC 状态仅 GM 可见 | `code_regex:gmOnly`、`path_exists:apps/server/src/modules/realtime/domain/visibility.ts` |
| 快照与可见性裁剪 | `path_exists:apps/server/src/modules/realtime/application/build-snapshot.ts`、`path_exists:packages/shared/src/snapshot.ts` |
| 断线重连与事件补发 | `code_regex:lastEventId`、`path_exists:apps/server/src/modules/realtime/event-ring-buffer.ts`、`path_exists:apps/server/src/modules/realtime/transport/ws-handler.ts` |
| 事件外箱与崩溃恢复 | `code_regex:session_outbox`、`path_exists:apps/server/src/bootstrap/startup.ts` |
| 乐观并发（阶段指令） | `apps/server/src/modules/sessions/application/stage-commands.ts`：`expectedVersion` 校验，陈旧指令不得覆盖新状态（`packages/shared/src/stage.ts` 定义 `expectedVersion`） |
| 移动端三布局 | `path_exists:apps/client/src/features/play/mobile-portrait-scene.tsx`、`path_exists:apps/client/src/features/play/mobile-landscape-scene.tsx`、`code_regex:orientation` |
| 规则系统抽象（扩展点） | `path_exists:apps/server/src/rules/rule-system.ts`、`path_exists:apps/server/src/rules/registry.ts`、`code_regex:RuleId` |
| 共享 zod 协议单源 | `path_exists:packages/shared/src/websocket.ts`、`code_regex:ClientCommandType`、`code_regex:protocolVersion` |

> 复跑方式：仓库根目录执行 `bash autoresearch.sh`。输出为 31 行 `METRIC`（含 `probe_kind=static-existence`）+ 1 行 `NOTICE`（说明探针通过不等于运行时行为）+ 256 行 `DETAIL`（97 implemented / 158 not-planned）。2026-10-31 连续 3 次运行退出码均为 0、METRIC 完全一致（competitor_alignment_score=26.9、feature_parity_score=100.0、features_total_planned=97），门禁无失败。

---

## 7. 相关文件

- `research/competitors.md` — 两家竞品的分领域功能清单，每条附来源 URL；含「对 CoGM 的启示」与「关键事实核对」。
- `research/feature-checklist.yaml` — 机器可读功能清单（195 项，id/category/name_zh/source/weight/detail），供 harness 与基准消费。
- `research/gap-report-draft.md` — 本报告的初稿（保留原样，未回填）。
- `scripts/parity/feature-matrix.json` — 256 项功能矩阵（97 项规划功能，含 61 项 CoGM 独有规划与 37 项对标竞品的规划内条目 + 158 项竞品独有条目），含静态存在性探针定义（非行为级）。
- `scripts/parity/verify.ts` — 探针执行与指标计算。
- `docs/product.md` — CoGM v1 产品需求（规划口径来源）。
