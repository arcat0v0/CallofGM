# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 首页、登录页、入团页、GM 后台与 GM 控制台提供低调的版本入口，可查看网页与后端版本、提交与构建时间。
- 曲目支持网易云音乐与 QQ 音乐的官方歌曲 ID/分享页搜索、解析和添加，与本地上传共同作为模组及模板资源。
- 平台曲目经所有权与团席位鉴权的服务端流接口播放，保留 BGM/SE 同步、重连进度、循环、音量与淡入淡出语义。
- `/api/version` 公开只读版本接口，通过共享 zod schema 返回后端构建信息。
- 客户端构建通过 Vite 注入版本、提交与构建时间，后端在应用装配时读取根 `package.json` 与构建环境。
- `bun run release:check` 发版一致性检查，以及根目录 `docker-compose.yml` 手动构建更新入口。

### Changed

- 根 `package.json` 成为软件版本号的唯一事实来源。
- GM 声音浮层改为「当前播放 → 曲目/平台添加 → 播放设置 → 即时音效」四段式层级；空曲目、断线、目录加载失败、播放失败与平台不可播状态均提供明确反馈。
- 平台搜索候选显示平台元数据并标注可播性待验证；添加成功后曲目库显示来源与艺术家，官方链接仅作详情入口。
- 客户端测试默认按文件隔离，避免测试间替换全局 fetch/session-socket 造成 JoinPage/PlayEntry 假超时。
- `tracks` 与 `template_tracks` 增加曲目来源及平台元数据；`0005_lazy_xorn` 将历史曲目迁移为 `upload`，保留媒体引用和软删除状态，平台曲目的 `audio_asset_id` 可空。

### Fixed

- 修复全团音量连续拖动复用旧 `expectedVersion` 导致的音频版本冲突：拖动只预览、释放时提交一次。
- 修复切换/重播曲目后进度未立即刷新、平台流 URL 被误当作 asset id、播放失败缺少重试入口，以及循环与淡入淡出文案语义矛盾。
- 修复平台 `MUSIC_UNAVAILABLE` 等错误未映射为中文的问题，服务端英文 message 不再直接显示。
- 修复 QQ 匿名 vkey 偶发返回空 `purl` 时立即判不可播：最多三次更换匿名 guid 并退避重试，仍为空才返回 `MUSIC_UNAVAILABLE`。

### Security

- 版本接口只返回构建标识，不暴露环境变量、数据库路径或文件系统信息。
- 平台音频仅代理严格白名单的官方目标，逐次校验重定向并限制 HTTPS、超时、大小、音频类型与单段 Range；不持久化临时直链，不绕过登录、VIP、付费或版权限制。
