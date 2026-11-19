# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
