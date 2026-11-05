# 发版流程

CoGM 使用人工维护的 semver、annotated tag 与 CHANGELOG，通过 `docker compose` 在部署机按指定 tag 的源码本地构建更新。仓库不发布镜像、不自动部署、不监听 tag 触发发布。

## 版本源与构建标识

- 根 `package.json` 的 `version` 是唯一发版版本号，格式固定为 `MAJOR.MINOR.PATCH`。
- Git tag 使用 `vX.Y.Z`，必须是指向最终发布提交的 annotated tag。
- `CHANGELOG.md` 的版本标题使用 `## [X.Y.Z] - YYYY-MM-DD`。
- 网页版本在 Vite 构建时注入 `version`、`commit`、`buildTime`、`component=client`。
- 后端版本在应用装配时读取根 `package.json`，并从 `COGM_COMMIT`、`COGM_BUILD_TIME` 读取构建元数据。
- 镜像构建上下文不包含 `.git`，因此镜像内不得运行 `git rev-parse`。部署构建时必须显式传入构建参数。

## 版本号选择

- `MAJOR`：破坏兼容的数据模型、API、部署方式或用户工作流，或需要不可逆迁移。
- `MINOR`：向后兼容的新功能、新规则能力或新运营入口。
- `PATCH`：向后兼容的缺陷修复、文案/样式修正或安全修复。
- 开发期间根版本保持 `0.0.0`；首个正式版本号由维护者在发版时按成熟度指定，之后的发布由实际兼容性决定增量。

## 发布前检查

1. 确认 `CHANGELOG.md` 的 `Unreleased` 已整理为本版本的 `Added`、`Changed`、`Fixed`、`Removed`、`Security` 条目。
2. 确认根 `package.json` 版本与计划发布的 `vX.Y.Z` 一致。
3. 确认 `docs/release.md`、`AGENTS.md` 与 `docker-compose.yml` 中的命令仍然有效。
4. 核对 Dockerfile 的 Bun 版本、CI 的 Bun 版本与本地 Bun 版本；三者不一致是既有问题，发布记录中必须写清实际使用版本。
5. 运行 `bun install --frozen-lockfile`、`bun run test`、`bun run typecheck`、`bun run check:boundaries`、`bun run build:client`。
6. 对本次改动文件运行 Biome 检查与格式化。
7. 启动真实服务，访问 `/api/version` 和允许显示版本的页面入口，核对网页与后端版本。

## 发布顺序

1. 把 `CHANGELOG.md` 的 `Unreleased` 条目移动为 `## [X.Y.Z] - YYYY-MM-DD`。
2. 修改根 `package.json` 的 `version` 为 `X.Y.Z`。
3. 提交发布准备：`git commit -m "🔖 chore(release): vX.Y.Z"`。
4. 创建 annotated tag：`git tag -a vX.Y.Z -m "vX.Y.Z"`。
5. 确认 tag 指向最终发布提交，然后运行：

```bash
bun run release:check
```

6. 已启动部署实例时追加运行时核对：

```bash
bun run release:check --runtime https://cogm.example.com
```

7. 由维护者在部署机手动更新。仓库不执行这一步。

## 手动 Docker Compose 更新

部署机保留持久化目录 `data/`，其中包含 SQLite 数据库、媒体与主题。更新只替换代码与容器，不删除或重建该目录。

```bash
git fetch --tags
git checkout vX.Y.Z
docker compose exec cogm bun run db:backup
export COGM_COMMIT="$(git rev-parse HEAD)"
export COGM_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose build --pull
docker compose up -d
```

更新后核对：

```bash
curl -fsS https://cogm.example.com/api/health/ready
curl -fsS https://cogm.example.com/api/version
```

再打开首页或登录页的版本入口，确认网页版本、后端版本与 commit 一致。游玩房间与沉浸舞台不显示版本入口。

## 数据库迁移与备份

- 更新前必须备份 `data/db.sqlite`。优先使用 `bun run db:backup`；在运行中的容器内使用 `docker compose exec cogm bun run db:backup`。
- 备份写入数据库同目录的 `backups/`，属于 `data/` 持久卷的一部分。
- 新版本包含迁移时，先确认迁移可重复执行、失败路径可恢复，并在副本上预演。
- 应用启动会在 `apps/server` 启动流程中执行数据库迁移；不要在未备份的情况下直接更新。
- 回滚代码不等于降级数据库。若新版本已执行不可逆迁移，必须按该版本迁移说明处理，不能自动降级。

## 回滚

1. 备份当前数据库。
2. 检出上一个稳定 tag。
3. 重新设置 `COGM_COMMIT` 与 `COGM_BUILD_TIME`。
4. 执行 `docker compose build --pull` 与 `docker compose up -d`。
5. 检查健康接口、`/api/version` 与页面版本弹窗。
6. 如果数据库已迁移，先按发布记录判断兼容性；不能确认时停止回滚并恢复备份副本。

## 热修复

- 不移动、不覆盖已发布 tag。
- 从最新稳定 tag 创建修复分支，提交修复后发布新的 `PATCH` 版本。
- 重复完整发布顺序与 `bun run release:check`。

## ESA 边界

阿里云 ESA 云函数不作为后端宿主。其 V8 Isolate 运行时未提供本应用需要的 `fs`、SQLite 与常驻 WebSocket 服务端能力；ESA 只能作为前端静态托管或回源加速层。本次发版流程不包含 ESA 函数改造。
