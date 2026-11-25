#!/usr/bin/env bash
set -euo pipefail

# CoGM systemd 直接部署与更新脚本。
# 默认将当前仓库目录（标准路径 /opt/cogm）安装或更新为 systemd 托管服务 cogm.service。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_NAME="${COGM_SERVICE_NAME:-cogm}"
SERVICE_USER="${COGM_SERVICE_USER:-cogm}"
SERVICE_GROUP="${COGM_SERVICE_GROUP:-cogm}"
BUN_VERSION="${BUN_VERSION:-1.4.4}"
BUN_BIN="${BUN_BIN:-/usr/local/bin/bun}"
REF=""
SKIP_BACKUP=0
SKIP_TYPECHECK=0
INSTALL_BUN=1

usage() {
	cat <<'EOF'
用法: deploy/systemd/deploy.sh [选项]

选项:
  --ref <git-ref>     部署前执行 git fetch --tags 并检出指定 tag / 分支 / 提交
  --skip-backup       跳过更新前的 SQLite 热备份
  --skip-typecheck    跳过 bun run typecheck（仍执行 build:client）
  --no-install-bun    缺失 /usr/local/bin/bun 时不自动安装
  --user <username>   运行服务的系统用户（默认 cogm）
  -h, --help          显示帮助信息
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--ref)
			[[ $# -ge 2 ]] || { echo "--ref 需要参数" >&2; exit 1; }
			REF="$2"
			shift 2
			;;
		--skip-backup)
			SKIP_BACKUP=1
			shift
			;;
		--skip-typecheck)
			SKIP_TYPECHECK=1
			shift
			;;
		--no-install-bun)
			INSTALL_BUN=0
			shift
			;;
		--user)
			[[ $# -ge 2 ]] || { echo "--user 需要参数" >&2; exit 1; }
			SERVICE_USER="$2"
			SERVICE_GROUP="$2"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "未知选项: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

REPO_OWNER="$(stat -c '%U' "$APP_DIR")"
CURRENT_USER="$(id -un)"

run_root() {
	if [[ $(id -u) -eq 0 ]]; then
		"$@"
	else
		sudo env "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$@"
	fi
}

run_as_repo_owner() {
	if [[ "$CURRENT_USER" == "$REPO_OWNER" ]]; then
		"$@"
	elif [[ $(id -u) -eq 0 ]]; then
		runuser -u "$REPO_OWNER" -- "$@"
	else
		sudo -u "$REPO_OWNER" "$@"
	fi
}

run_as_service_user() {
	if [[ "$CURRENT_USER" == "$SERVICE_USER" ]]; then
		"$@"
	elif [[ $(id -u) -eq 0 ]]; then
		runuser -u "$SERVICE_USER" -- "$@"
	else
		sudo -u "$SERVICE_USER" "$@"
	fi
}

ensure_bun() {
	if [[ -x "$BUN_BIN" ]]; then
		return 0
	fi
	local detected=""
	detected="$(command -v bun 2>/dev/null || true)"
	if [[ -n "$detected" && -x "$detected" ]]; then
		echo "同步现有 bun 到 $BUN_BIN..."
		run_root mkdir -p "$(dirname "$BUN_BIN")"
		run_root install -m 0755 "$detected" "$BUN_BIN"
		return 0
	fi
	if [[ "$INSTALL_BUN" -ne 1 ]]; then
		echo "未找到 $BUN_BIN 且已禁用自动安装" >&2
		exit 1
	fi
	echo "安装 Bun v${BUN_VERSION} 到 $(dirname "$BUN_BIN")..."
	local tmp_install
	tmp_install="$(mktemp)"
	if curl -fsSL https://bun.sh/install -o "$tmp_install"; then
		run_root env BUN_INSTALL=/usr/local bash "$tmp_install" "bun-v${BUN_VERSION}"
		rm -f "$tmp_install"
	else
		rm -f "$tmp_install"
		return 1
	fi
	if [[ ! -x "$BUN_BIN" ]]; then
		echo "Bun 安装后未在 $BUN_BIN 找到可执行文件" >&2
		exit 1
	fi
}

ensure_service_user() {
	if ! getent group "$SERVICE_GROUP" >/dev/null 2>&1; then
		echo "创建系统用户组 $SERVICE_GROUP..."
		run_root groupadd --system "$SERVICE_GROUP"
	fi
	if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
		echo "创建系统用户 $SERVICE_USER..."
		run_root useradd --system --gid "$SERVICE_GROUP" --home-dir "$APP_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
	fi
}

echo "==> 检查 Bun 与服务账号 ($APP_DIR)"
ensure_bun
ensure_service_user
echo "使用 Bun: $("$BUN_BIN" --version)"

if [[ -n "$REF" ]]; then
	echo "==> 检出目标版本: $REF"
	run_as_repo_owner git -C "$APP_DIR" fetch --tags
	run_as_repo_owner git -C "$APP_DIR" checkout "$REF"
fi

echo "==> 安装依赖 (frozen-lockfile)"
run_as_repo_owner bash -c 'cd "$1" && PATH="/usr/local/bin:$PATH" "$2" install --frozen-lockfile' _ "$APP_DIR" "$BUN_BIN"

COGM_CONFIG_PATH="${COGM_CONFIG:-$APP_DIR/config/cogm.systemd.toml}"

eval "$(
	cd "$APP_DIR/apps/server"
	COGM_CONFIG="$COGM_CONFIG_PATH" NODE_ENV=production "$BUN_BIN" -e '
		import { dirname, resolve } from "node:path";
		import { loadConfig } from "./src/config/app-config";
		const c = loadConfig();
		const q = (v: string) => JSON.stringify(v);
		const dbPath = c.databaseUrl === ":memory:" ? "" : resolve(c.databaseUrl);
		const dbDir = dbPath ? dirname(dbPath) : "";
		const mediaDir = resolve(c.mediaDir);
		const themesDir = resolve(c.themesDir);
		const backupDir = c.backupDir ? resolve(c.backupDir) : (dbDir ? `${dbDir}/backups` : "");
		console.log(`CFG_PORT=${q(String(c.port))}`);
		console.log(`CFG_HOST=${q(c.host ?? "127.0.0.1")}`);
		console.log(`CFG_DB_PATH=${q(dbPath)}`);
		console.log(`CFG_DB_DIR=${q(dbDir)}`);
		console.log(`CFG_MEDIA_DIR=${q(mediaDir)}`);
		console.log(`CFG_THEMES_DIR=${q(themesDir)}`);
		console.log(`CFG_BACKUP_DIR=${q(backupDir)}`);
	'
)"

declare -A seen_dirs=()
DATA_DIRS=()
for d in "$APP_DIR/data" "$CFG_DB_DIR" "$CFG_MEDIA_DIR" "$CFG_THEMES_DIR" "$CFG_BACKUP_DIR"; do
	if [[ -n "$d" && -z "${seen_dirs[$d]:-}" ]]; then
		seen_dirs["$d"]=1
		DATA_DIRS+=("$d")
	fi
done

echo "==> 准备持久化目录与权限"
for d in "${DATA_DIRS[@]}"; do
	run_root mkdir -p "$d"
	run_root chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$d"
done

if [[ "$SKIP_BACKUP" -eq 0 && -n "$CFG_DB_PATH" && -f "$CFG_DB_PATH" ]]; then
	echo "==> 备份现有数据库: $CFG_DB_PATH"
	run_as_service_user bash -c 'cd "$1" && COGM_CONFIG="$2" PATH="/usr/local/bin:$PATH" "$3" run db:backup' _ "$APP_DIR" "$COGM_CONFIG_PATH" "$BUN_BIN"
fi

COGM_COMMIT="$(run_as_repo_owner git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
COGM_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> 构建前端 (commit=${COGM_COMMIT})"
run_as_repo_owner bash -c 'cd "$1" && COGM_COMMIT="$2" COGM_BUILD_TIME="$3" PATH="/usr/local/bin:$PATH" "$4" run build:client' _ "$APP_DIR" "$COGM_COMMIT" "$COGM_BUILD_TIME" "$BUN_BIN"

if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
	echo "==> 运行类型检查"
	run_as_repo_owner bash -c 'cd "$1" && PATH="/usr/local/bin:$PATH" "$2" run typecheck' _ "$APP_DIR" "$BUN_BIN"
fi

echo "==> 写入环境文件 /etc/cogm/"
run_root mkdir -p /etc/cogm
run_root chown "root:${SERVICE_GROUP}" /etc/cogm
run_root chmod 0750 /etc/cogm

tmp_build_env="$(mktemp)"
cat >"$tmp_build_env" <<EOF
COGM_COMMIT=${COGM_COMMIT}
COGM_BUILD_TIME=${COGM_BUILD_TIME}
EOF
run_root install -m 0644 -o root -g root "$tmp_build_env" /etc/cogm/build.env
rm -f "$tmp_build_env"

if [[ ! -f /etc/cogm/cogm.env ]]; then
	run_root install -m 0640 -o root -g "$SERVICE_GROUP" "$APP_DIR/deploy/systemd/cogm.env.example" /etc/cogm/cogm.env
fi

echo "==> 安装并重启 systemd 服务 ${SERVICE_NAME}.service"
RW_LIST=()
for d in "${DATA_DIRS[@]}"; do
	if [[ "$d" == "$APP_DIR/data" || "$d" != "$APP_DIR/data/"* ]]; then
		RW_LIST+=("$d")
	fi
done
RW_PATHS="${RW_LIST[*]}"
tmp_unit="$(mktemp)"
sed \
	-e "s|^User=.*|User=${SERVICE_USER}|" \
	-e "s|^Group=.*|Group=${SERVICE_GROUP}|" \
	-e "s|^WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|" \
	-e "s|^Environment=COGM_CONFIG=.*|Environment=COGM_CONFIG=${COGM_CONFIG_PATH}|" \
	-e "s|^ExecStart=.*|ExecStart=${BUN_BIN} --cwd ${APP_DIR}/apps/server src/index.ts|" \
	-e "s|^ReadWritePaths=.*|ReadWritePaths=${RW_PATHS}|" \
	"$APP_DIR/deploy/systemd/cogm.service" >"$tmp_unit"
run_root install -m 0644 -o root -g root "$tmp_unit" "/etc/systemd/system/${SERVICE_NAME}.service"
rm -f "$tmp_unit"

run_root systemctl daemon-reload
run_root systemctl enable "${SERVICE_NAME}.service"
run_root systemctl restart "${SERVICE_NAME}.service"

PROBE_HOST="$CFG_HOST"
if [[ "$PROBE_HOST" == "0.0.0.0" || "$PROBE_HOST" == "::" || -z "$PROBE_HOST" ]]; then
	PROBE_HOST="127.0.0.1"
fi

echo "==> 等待服务就绪 (${PROBE_HOST}:${CFG_PORT})"
ready=0
for _ in $(seq 1 30); do
	if curl -fsS "http://${PROBE_HOST}:${CFG_PORT}/api/health/ready" >/dev/null 2>&1; then
		ready=1
		break
	fi
	sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
	echo "服务未能通过就绪探针，最近日志：" >&2
	run_root systemctl status "${SERVICE_NAME}.service" --no-pager >&2 || true
	run_root journalctl -u "${SERVICE_NAME}.service" -n 50 --no-pager >&2 || true
	exit 1
fi

echo "==> 部署完成"
curl -fsS "http://${PROBE_HOST}:${CFG_PORT}/api/health/ready"
echo ""
curl -fsS "http://${PROBE_HOST}:${CFG_PORT}/api/version"
echo ""
