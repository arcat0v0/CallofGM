# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 新增直接通过 systemd 管理的无 Docker 部署方案：`config/cogm.systemd.toml`（默认 `/opt/cogm/data` 与 `127.0.0.1:15632`）、`deploy/systemd/cogm.service`、`deploy/systemd/cogm.env.example` 与一键部署/更新脚本 `deploy/systemd/deploy.sh`，并同步更新 `docs/release.md` 等部署文档。

## [0.2.3] - 2026-11-23

### Changed

- 优化移动端与平板端界面布局：横屏玩家房间采用响应式聊天栏宽度、紧凑输入栏/顶栏与无遮挡舞台居中偏移，竖屏缩小舞台最小高度以预留软键盘空间。
- GM 控制台在 `< lg` 视口切换为单实例多视图（「控场 / 对话 / 舞台」），收缩顶栏操作项、适配工具浮层定位与栅格表单，避免双栏重叠与面板截断。
- 适配全局弹窗外边距及内边距、玩家/GM 历史回顾弹层、情报库与入团选座卡片，首页登录入口脱离绝对定位以避免矮横屏重叠。

### Fixed

- 修复 Safari / iOS Safari 授予麦克风权限后测试电平停留在 `0%` 且无回听声音的问题：在权限与异步手势切换后自动恢复 `AudioContext` 并处理 `"interrupted"` 状态、为捕获图增加零增益输出保活、复用同一上下文节点进行麦克风测试以规避跨上下文流静音，并按原生采样率与 `"play-and-record"` 会话模式对齐音频硬件、补全 `<audio playsinline>` 与移动端语音弹窗头部固定布局。

## [0.2.2] - 2026-11-23

### Changed

- 服务端实例配置从环境变量迁移到 TOML 文件：本地使用 `config/cogm.toml`，容器使用 `config/cogm.docker.toml`，两者均可由同目录 `config/cogm.local.toml` 覆盖；监听地址、数据库与媒体/主题目录、CORS、代理信任和语音参数统一由文件加载并校验。环境变量仅保留 `NODE_ENV`、TURN secret、构建元数据与初始化账号凭据。
- `dev:https` 从同一配置读取端口与额外主机，并生成临时的 `COGM_CONFIG` 文件注入代理与 CORS 设置；Docker compose 改为只读挂载 `config/`。

### Fixed

- 补齐 GM 导演工作台的团状态切换入口与阶段保护。
- 返回按钮按来源回到上级路由，并显示与目标路由一致的标签。

## [0.2.1] - 2026-11-22

### Fixed

- 修复 TLS 反向代理部署下浏览器登录与写请求被源校验拒绝（403）的问题：开启 `TRUST_PROXY` 时按 `X-Forwarded-Proto` / `Host` 还原公网同源，compose 透传该开关；`CORS_ORIGINS` 仅用于额外来源。

## [0.2.0] - 2026-11-22

### Added

- GM 与玩家语音面板新增本地麦克风选择、浏览器音频约束、RNNoise 深度降噪、噪声门和压限器，显示实际应用状态与处理回退提示。
- 语音支持本地麦克风测试与回听、可配置的按键说话，以及说话人悬浮窗和独立成员音量。
- 语音传输优先协商单声道 Opus，支持时将发送端码率上限设为 32 kbps。DTX 与带内 FEC 取决于浏览器能力和协商结果。
- 语音面板可在明确同意后记录本地 RTC 诊断，并下载 JSON。默认关闭，停止后仍可下载本标签页的日志。诊断不上报，旧上传及 GM 后台导出接口已移除。已发布的数据库迁移及旧报告记录原样保留。

### Changed

- GM 人物库采用 Material 3 Expressive 圆角和表面色阶，更新侧栏、台账、立绘墙与检视器样式，保持 36px 桌面台账行高。
- 人物台账把类型和玩家归属移到姓名旁，保留对齐的模组和更新时间列。选中行改用中性色阶和短强调线。
- 团管理、模组模板、音乐、黑名单、提交审核和回收站统一为紧凑的 Material 3 Expressive 管理页，采用与模组库、人物库一致的页头、圆角面板和表面色阶。
- GM 音乐库对齐模组库与人物库的 M3 Expressive 工作台：圆角模组侧栏、胶囊工具栏、圆角曲目台账面板与底部试听浮岛。

### Fixed

- 修复 GM 模组工作台音乐页缺失文案键、直接显示 i18n key 的问题（曲目计数与空态）。
- 修复 GM 曲库与模组工作台的试听无法播放无扩展名媒体与平台流的问题：为 Howler 补显式格式提示，网易云按 mp3、QQ 按 m4a。

### Tests

- 使用隔离双 Chromium、network namespace、合成音频与 RTP/RMS 采样验证语音基线、真实 UDP 损伤、五次双路径切换及 WS-only 重连；明确 CDP 页面网络条件未形成 RTP 弱网证据，实体无线切换、RNNoise 弱网对照与主观听感仍未覆盖。详见 [语音弱网与切网验证](docs/voice-network-testing.md)。
- 用两个隔离 Chromium 和真实 WebRTC 验证本地诊断的同意、拒绝、停止、重连、刷新与 JSON 下载。两端诊断 HTTP 请求及 WS 帧均为 0。服务端集成测试确认旧接口均返回 404，历史报告行保持原样。

## [0.1.0] - 2026-11-19

发布验证使用 Bun `1.4.4`。Docker 构建与运行使用 Bun `1.3.14`。

### Added

- 首页、登录页、入团页、GM 后台与 GM 控制台提供低调的版本入口，可查看网页与后端版本、提交与构建时间。
- 曲目支持网易云音乐与 QQ 音乐的官方歌曲 ID/分享页搜索、解析和添加，与本地上传共同作为模组及模板资源。
- 平台曲目经所有权与团席位鉴权的服务端流接口播放，保留 BGM/SE 同步、重连进度、循环、音量与淡入淡出语义。
- 声音面板支持粘贴网易云音乐与 QQ 音乐公开歌单 ID/官方链接，通过共享分页契约逐页读取并复用单曲添加流程批量导入，保留真实进度、部分失败和逐首可播性验证；不新增歌单持久化实体或持续同步。
- `/api/version` 公开只读版本接口，通过共享 zod schema 返回后端构建信息。
- 客户端构建通过 Vite 注入版本、提交与构建时间，后端在应用装配时读取根 `package.json` 与构建环境。
- `bun run release:check` 发版一致性检查，以及根目录 `docker-compose.yml` 手动构建更新入口。
- 增加基于现有团 WebSocket 的 WebRTC 语音协议与服务端权威控制：独立开启标识、人数与 GM 保留位、重复标签页防护、点对点 SDP/ICE 单播、OB 授权、个别静音、阶段/回溯/席位更新与断线重连。
- 支持可选 STUN 与 coturn REST 短期 TURN 凭据；默认不依赖外部 ICE 服务，并新增可空持久单团人数上限迁移 `0007_voice_limit`。
- 新增 D&D 第五版（2024，`dnd5r`）规则。支持 1–20 级人物卡、D20 鉴定与豁免、武器攻击与伤害、先攻和轮次、死亡豁免与休整。鉴定请求、遭遇和资源状态支持重连、历史及回溯，迁移 `0008_rule_runtime` 新增可空的规则运行态和鉴定选项字段。内置结构化目录来源和实现范围见 [SRD 5.2.1 说明](docs/dnd5r-srd.md)。
- `bun run check:boundaries` 增加规则系统隔离、服务端分层与客户端主题边界检查。

### Changed

- 根 `package.json` 成为软件版本号的唯一事实来源。
- GM 声音浮层改为「当前播放 → 曲目/平台添加 → 播放设置 → 即时音效」四段式层级；空曲目、断线、目录加载失败、播放失败与平台不可播状态均提供明确反馈。
- 平台搜索候选显示平台元数据并标注可播性待验证；添加成功后曲目库显示来源与艺术家，官方链接仅作详情入口。
- 客户端测试默认按文件隔离，避免测试间替换全局 fetch/session-socket 造成 JoinPage/PlayEntry 假超时。
- `tracks` 与 `template_tracks` 增加曲目来源及平台元数据；`0005_lazy_xorn` 将历史曲目迁移为 `upload`，保留媒体引用和软删除状态，平台曲目的 `audio_asset_id` 可空。
- 服务端统一规则检定入口，将理智、幸运与成长作为独立能力，并将团状态机、BGM 状态、音乐平台适配及持久化职责收口。
- 前端按规则注册表渲染人物卡与检定界面，实时 Store 改为业务切片并保留 `usePlayStore` 入口。
- `bun dev` 的 Vite 前端监听 `0.0.0.0:15633`。从局域网地址登录时，将该访问地址加入后端的 `CORS_ORIGINS`。

### Fixed

- 修复全团音量连续拖动复用旧 `expectedVersion` 导致的音频版本冲突：拖动只预览、释放时提交一次。
- 修复切换/重播曲目后进度未立即刷新、平台流 URL 被误当作 asset id、播放失败缺少重试入口，以及循环与淡入淡出文案语义矛盾。
- 修复平台 `MUSIC_UNAVAILABLE` 等错误未映射为中文的问题，服务端英文 message 不再直接显示。
- 修复 QQ 匿名 vkey 偶发返回空 `purl` 时立即判不可播：最多三次更换匿名 guid 并退避重试，仍为空才返回 `MUSIC_UNAVAILABLE`。
- 修复 D&D 人物卡显示 CoC 专属数值，以及终生字段编辑未使用规则声明范围的问题。
- 回收站恢复立绘时校验所属人物仍有效且归当前操作者所有。
- 登录顶替与账号撤销统一使用有效且共享的 `SessionCloseCode.loginRevoked = 4003`，不再发送浏览器无法干净关闭的 401 WS 关闭码。

### Security

- 版本接口只返回构建标识，不暴露环境变量、数据库路径或文件系统信息。
- 平台音频仅代理严格白名单的官方目标，逐次校验重定向并限制 HTTPS、超时、大小、音频类型与单段 Range；不持久化临时直链，不绕过登录、VIP、付费或版权限制。
