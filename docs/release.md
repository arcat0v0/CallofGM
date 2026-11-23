# 发版流程

CoGM 使用人工维护的 semver、annotated tag 与 CHANGELOG，支持通过 `docker compose` 或直接通过 `systemd` 在部署机按指定 tag 的源码本地构建更新。仓库不发布镜像、不自动部署、不监听 tag 触发发布。

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
3. 确认 `docs/release.md`、`AGENTS.md`、`docker-compose.yml` 与 `deploy/systemd/cogm.service` 中的命令仍然有效。
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

本地开发使用 `config/cogm.toml`（路径相对 `apps/server`）；容器使用 `config/cogm.docker.toml`（绝对 `/app/data` 路径），由镜像设置 `COGM_CONFIG` 指定；直接通过 systemd 部署使用 `config/cogm.systemd.toml`（默认 `/opt/cogm/data` 路径与 `127.0.0.1:15632`），由 `cogm.service` 设置 `COGM_CONFIG` 指定。部署专属改动写入同目录的 `config/cogm.local.toml`（已忽略提交；compose 以只读方式挂载整个 `config/`）。修改后重启容器或服务生效。

配置读取顺序为：基础配置文件 → 同目录 `cogm.local.toml` → 显式覆盖。`COGM_CONFIG` 可指定基础配置文件（开发脚本、systemd 与隔离测试使用）；指定后仍会合并该文件同目录的 `cogm.local.toml`。除密钥、运行时模式和构建元数据外，不再通过环境变量配置实例：

| 环境变量 | 用途 |
|---|---|
| `COGM_CONFIG` | 基础配置文件路径；默认 `config/cogm.toml`，容器镜像设为 `config/cogm.docker.toml`，systemd 服务设为 `/opt/cogm/config/cogm.systemd.toml` |
| `NODE_ENV` | `development` / `production` / `test`，决定 Cookie `Secure` 与默认 CORS 策略 |
| `VOICE_TURN_REST_SECRET` | coturn 长期凭据，必须与 `[voice] turnUrls` 成对出现 |
| `COGM_COMMIT` / `COGM_BUILD_TIME` | 构建与版本展示元数据 |
| `COGM_ADMIN_USERNAME` / `COGM_ADMIN_PASSWORD` | `setup:admin` 初始化账号；也可用命令行参数 |

部署在 TLS 反向代理之后时，必须在 `config/cogm.local.toml` 中设置：

```toml
[security]
trustProxy = true
```

让服务端从代理的 `X-Forwarded-Proto` / `Host` 还原浏览器实际访问的来源；否则它看到的是内部 `http://127.0.0.1:15632`，浏览器带 `Origin` 的登录与写请求会被源校验以 403 拒绝，页面能打开但无法登录或操作。只有确认请求确实经由自己的代理到达时才开启。`corsOrigins` 仅用于额外放行前端与 API 不同源的部署：

```toml
[security]
corsOrigins = ["https://cogm.example.com"]
```

再打开首页或登录页的版本入口，确认网页版本、后端版本与 commit 一致。游玩房间与沉浸舞台不显示版本入口。

## 手动 systemd 部署与更新（无 Docker）

如果部署机直接安装 Bun 并由 systemd 托管进程，推荐将仓库放在 `/opt/cogm`，以专用无特权系统用户 `cogm` 运行，并配合 Caddy/Nginx 提供 HTTPS/WSS 反向代理。配套文件位于 `config/cogm.systemd.toml` 与 `deploy/systemd/`（`cogm.service`、`cogm.env.example`、`deploy.sh`）。

### 首次安装与升级

在项目目录（默认 `/opt/cogm`）执行一键部署/更新脚本（自动完成系统用户创建、Bun 安装检查、`bun install --frozen-lockfile`、数据库热备份、前端构建与类型检查、写入 `/etc/cogm/build.env`、安装并重启 `cogm.service` 及就绪/版本探针）：

```bash
cd /opt/cogm
./deploy/systemd/deploy.sh --ref vX.Y.Z
```

若当前目录已检出目标代码，直接运行 `./deploy/systemd/deploy.sh` 即可。

如需手动分步执行：

```bash
cd /opt/cogm
git fetch --tags
git checkout vX.Y.Z
sudo -u cogm COGM_CONFIG=/opt/cogm/config/cogm.systemd.toml /usr/local/bin/bun run db:backup
export COGM_COMMIT="$(git rev-parse HEAD)"
export COGM_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
/usr/local/bin/bun install --frozen-lockfile
/usr/local/bin/bun run build:client
printf 'COGM_COMMIT=%s\nCOGM_BUILD_TIME=%s\n' "$COGM_COMMIT" "$COGM_BUILD_TIME" | sudo tee /etc/cogm/build.env >/dev/null
sudo install -m 0644 deploy/systemd/cogm.service /etc/systemd/system/cogm.service
sudo systemctl daemon-reload
sudo systemctl enable --now cogm.service
sudo systemctl restart cogm.service
```

### 配置、密钥与日常运维

- 实例配置：`config/cogm.systemd.toml` 默认监听 `127.0.0.1:15632`，数据位于 `/opt/cogm/data/{db.sqlite,media,themes}`。反代后部署同样在 `/opt/cogm/config/cogm.local.toml` 设置 `[security] trustProxy = true`；若需变更端口、路径或直连监听地址，也写入 `cogm.local.toml`。
- 环境变量密钥：`VOICE_TURN_REST_SECRET` 写入 `/etc/cogm/cogm.env`（参考 `deploy/systemd/cogm.env.example`，权限 `0640 root:cogm`），修改后执行 `sudo systemctl restart cogm`。
- 权限隔离：`cogm.service` 开启 `ProtectSystem=strict` 与 `ProtectHome=true`，仅对 `/opt/cogm/data` 开放读写。手动执行备份或初始化管理员时，请以 `cogm` 用户并显式传入 `COGM_CONFIG`：

```bash
sudo -u cogm COGM_CONFIG=/opt/cogm/config/cogm.systemd.toml /usr/local/bin/bun run db:backup
sudo -u cogm COGM_CONFIG=/opt/cogm/config/cogm.systemd.toml /usr/local/bin/bun run --cwd /opt/cogm/apps/server setup:admin <用户名> <密码>
```

- 日志与状态查看：

```bash
systemctl status cogm
journalctl -u cogm -f
```

## 数据库迁移与备份

- 更新前必须备份 `data/db.sqlite`。Docker 环境在运行中的容器内使用 `docker compose exec cogm bun run db:backup`；systemd 环境使用 `sudo -u cogm COGM_CONFIG=/opt/cogm/config/cogm.systemd.toml /usr/local/bin/bun run db:backup`（`deploy/systemd/deploy.sh` 默认自动执行）。
- 备份写入数据库同目录的 `backups/`，可通过 `[database] backupDir` 覆盖；属于 `data/` 持久卷的一部分。
- 新版本包含迁移时，先确认迁移可重复执行、失败路径可恢复，并在副本上预演。
- 应用启动会在 `apps/server` 启动流程中执行数据库迁移；不要在未备份的情况下直接更新。
- 回滚代码不等于降级数据库。若新版本已执行不可逆迁移，必须按该版本迁移说明处理，不能自动降级。
- `0006_bgm_playback_modes` 将 `session_audio_state.loop` 转为 `mode`：`1 → single`，`0 → off`，保留曲目、音量、进度与版本并删除旧列。升级须同步更新服务端与前端，已打开页面需刷新；回滚至仍读取 `loop` 的版本前应恢复升级前的数据库备份，不能仅回滚代码。

## WebRTC 语音部署

语音是 GM + 最多 7 个其他席位的全网状 WebRTC 拓扑（8 人共 28 条对等连接），CoGM 只交换信令，不代理媒体。默认可不配置任何外部服务，浏览器会直接尝试 host/host；跨 NAT 或受限网络通常需要 STUN，无法直连时需要 TURN。实际生产验收必须覆盖目标网络与真实音频设备，不能用同机结果代替跨网络保证。

语音配置位于 `config/cogm.toml` 的 `[voice]` 段：

| 配置项 | 默认 | 说明 |
|---|---|---|
| `maxParticipants` | `8` | 实例最大语音人数，含 GM，整数 2–256；大规模全网状需另行评估浏览器带宽与 CPU |
| `stunUrls` | `[]` | `stun:` / `stuns:` 地址数组，最多 16 条 |
| `turnUrls` | `[]` | `turn:` / `turns:` 地址数组，最多 16 条，与 REST secret 成对设置 |
| `turnTtlSeconds` | `600` | TURN 临时凭据寿命，60–86400 秒 |

TURN 长期凭据不写入配置文件，只通过服务端环境变量 `VOICE_TURN_REST_SECRET` 注入；`docker-compose.yml` 仅透传该变量，仓库与配置文件中均不含长期凭据。

coturn 需启用 `use-auth-secret` 与同一 `static-auth-secret`，按实际公网地址开放 UDP/TCP relay 端口及 relay 端口范围；公网部署优先使用受 TLS 保护的 `turns:`。TURN 是独立可选组件，不由 CoGM compose 强制启动。

浏览器麦克风在非 localhost 环境只可用于安全上下文，生产必须同时提供 HTTPS 页面与 WSS 团连接；仅开放 HTTP/WS 不能作为公网语音部署。TURN REST 凭据在每次语音 join/rejoin 时重新签发；若 relay 协商在凭据到期后失败，应重新加入以取得新凭据，并按单次通话时长、网络切换与重连策略调整 TTL，不能把已下发凭据当作永久配置。

本次隔离验收记录：真实 Chromium 中 GM + 7 个匿名 OB 使用同机 localhost Bun/Vite，各自只有一条团 WS，每人 7 条 peer connection（全网状 28 对）；未配置 ICE 时选择 host/host，七名 OB 均收到非零音频能量，授权 OB 上行也被 GM 收到。强制关闭 WS 后，客户端在同一开启重入并终止旧麦克风轨道；GM 将持久上限 8 调为 6 后刷新与服务重启均保留。私有 loopback rootless coturn 4.9 REST fixture 在仅允许 relay 的验收策略下选择 relay/relay，OB 收到非零音频。另验证了 GM 静音与强制 CG 会停止 OB 采集并在远端 mute/pause/disable 轨道，结团关闭连接与音频，暂停语音不影响 BGM。

上述结果来自 Chromium 合成采集与同一主机，未验证物理麦克风、跨设备或跨公网 NAT；部署验收应补测这些项目，并检查满员、重复标签页、非归属 GM 隔离与 TURN 凭据到期后的重连。

## 回滚

1. 备份当前数据库。
2. 检出上一个稳定 tag。
3. Docker 方式：重新设置 `COGM_COMMIT` 与 `COGM_BUILD_TIME`，执行 `docker compose build --pull` 与 `docker compose up -d`；systemd 方式：执行 `./deploy/systemd/deploy.sh --ref vX.Y.Z`（或手动构建并更新 `/etc/cogm/build.env` 后重启 `cogm.service`）。
4. 检查健康接口、`/api/version` 与页面版本弹窗。
5. 如果数据库已迁移，先按发布记录判断兼容性；不能确认时停止回滚并恢复备份副本。

## 热修复

- 不移动、不覆盖已发布 tag。
- 从最新稳定 tag 创建修复分支，提交修复后发布新的 `PATCH` 版本。
- 重复完整发布顺序与 `bun run release:check`。

## ESA 边界

阿里云 ESA 云函数不作为后端宿主。其 V8 Isolate 运行时未提供本应用需要的 `fs`、SQLite 与常驻 WebSocket 服务端能力；ESA 只能作为前端静态托管或回源加速层。本次发版流程不包含 ESA 函数改造。
