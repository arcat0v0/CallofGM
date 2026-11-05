# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 首页、登录页、入团页、GM 后台与 GM 控制台提供低调的版本入口，可查看网页与后端版本、提交与构建时间。
- `/api/version` 公开只读版本接口，通过共享 zod schema 返回后端构建信息。
- 客户端构建通过 Vite 注入版本、提交与构建时间，后端在应用装配时读取根 `package.json` 与构建环境。
- `bun run release:check` 发版一致性检查，以及根目录 `docker-compose.yml` 手动构建更新入口。

### Changed

- 根 `package.json` 成为软件版本号的唯一事实来源。

### Security

- 版本接口只返回构建标识，不暴露环境变量、数据库路径或文件系统信息。
