# CoGM 运行时版本与手动发版规范设计

日期：2026-11-05

## 意图与原因

CoGM 是自部署的网页跑团工具，玩家、GM、PL、OB 都可能在同一团里使用不同的网页缓存或连接不同时间更新的后端。现在仓库没有软件版本号、tag 或 CHANGELOG，运行实例出问题时无法判断它对应哪次构建，也无法从版本追到变更内容。

本设计建立一套轻量的“版本可辨识 + 手动发版”闭环：运行中的网页和后端各自展示可核验的构建标识；发版时留下 semver tag 和人工整理的 CHANGELOG；`docker compose` 按指定 tag 的源码在本地构建并更新。发版规范写入 `AGENTS.md`，供所有 Agent 在提交和发布前遵循。

这套规范不引入镜像仓库、自动部署或自动发布工具。阿里云 ESA 云函数不作为现有后端宿主：其函数是 V8 Isolate 的 JS 运行时，官方 Runtime API 未列出 `fs`、SQLite 或 WebSocket 服务端能力；ESA 的 WebSocket 是客户端接入与回源能力，需要常驻源站；Edge KV 只提供最终一致的键值存储。现有 Elysia + Bun + 原生 WS + `bun:sqlite` 后端继续使用 `docker compose` 部署。ESA 可作为前端静态托管或回源加速层，但不是本次发版实施项。

## 目标

- 玩家、GM、PL、OB 在首页、登录页、入团页、GM 后台及 GM 控制台的页脚或设置区能看到当前网页构建和后端的软件版本；不需要登录。进入游玩房间后的沉浸舞台不显示版本信息，避免打断演出。
- 网页构建版本与后端构建版本分别记录，能识别二者不一致；各自带构建时的 Git commit，能区分同一版本号的未发布开发构建。
- 版本号、tag、CHANGELOG、网页与后端运行时报告的版本可互相核对；发版前由一条 Bun 命令完成静态校验。
- 发版规则写进 `AGENTS.md`，完整流程写进 `docs/release.md`，`CHANGELOG.md` 位于仓库根目录。
- `docker compose` 以当前检出的 tag 源码构建并重启；不发布或推送镜像，不配置自动部署。
- 手动更新步骤包含数据库迁移与持久卷的注意事项，不破坏现有 `data/` 中的数据库、媒体和主题。

## 非目标与反目标

- 不生成 GitHub Release、不自动改版本、不自动生成 CHANGELOG、不监听 tag 触发 CI、不推送 Docker 镜像，也不让 CI 自动部署。
- 不改变现有 gitmoji 提交习惯，不引入 conventional commits、changesets 或 semantic-release。
- 不把版本信息放进团快照、WS 协议、历史时间线或回溯状态；版本是实例级运维信息，不是团业务数据。
- 不要求玩家看到 commit/build 时间的完整详情；只在首页、登录页、入团页和 GM 后台/控制台的低调入口按需打开详情，游玩房间不显示任何版本信息。
- 不让前端声称后端的版本；后端版本从服务端实时读取，接口失败时明确显示“后端未知”，不伪造或复用网页版本。
- 不把 ESA 云函数改造成本纳入本次实施；不因本规范修改后端架构、数据库或部署宿主。
- 不改动用户当前未提交的 `.aoci/baseline.json`、`aoci.code.txt`、`apps/client/src/themes/default/slots/gm-console-layout.tsx`。

## 约束

- 根 `package.json` 是软件版本号的唯一事实来源；各 workspace 的 `0.0.0` 不作为发布版本。
- 构建时从 Git 元数据或显式构建参数获得 commit；`.dockerignore` 排除 `.git`，因此镜像内不得依赖 `git rev-parse`。
- 网页版本通过 Vite `define` 编译进前端产物；后端版本在服务端读取根 `package.json`，不从浏览器环境推断。
- 版本响应的 zod schema 定义于 `packages/shared`，并由 `packages/shared/src/index.ts` 导出；服务端与客户端复用同一 schema。
- UI 复用 shadcn/ui 的 Button、Dialog/Popover 与现有语义 token；文案进入 `zh-CN.ts`；不新增组件级 CSS。
- 所有脚本使用 Bun；`release:check` 不依赖新增第三方依赖。
- Docker 与 CI 的 Bun 版本不一致是既有问题；本设计不擅自统一，但在 `docs/release.md` 记录发布前必须核对。
- 遵循 TDD：先补版本信息纯函数、版本接口契约和版本 UI 的失败测试，再实现；涉及接口的改动运行真实应用入口的集成测试。
- TypeScript/JavaScript 改动限定范围运行 Biome 检查/格式化、`bun run typecheck` 与相关测试；不擅自改造 CI 工具链。

## 决定的形态

### 版本标识

- 发版版本采用 `MAJOR.MINOR.PATCH` 的 semver；首个手动发版版本由发布者在实现后按当前成熟度选择，不改变既有 `0.0.0` 的历史含义。
- 根 `package.json` 增加 `"version": "<当前发版版本>"`。开发期间可带构建 commit，例如 `0.1.0+abc1234`，但 tag 与 CHANGELOG 标题只使用 `vX.Y.Z`。
- 每项构建信息包含 `version`、`commit`（完整 SHA 或 `unknown`）、`buildTime`（ISO 时间或 `unknown`）以及 `component`（`client` / `server`）。
- 版本响应使用共享 `BuildInfoSchema` / `VersionResponseSchema`，字段固定为 `client?: BuildInfo`（仅客户端本地合并）、`server: BuildInfo`；服务端接口只返回 `server`，不声称自己知道客户端版本。
- 网页在编译时将版本信息写入 `import.meta.env` 的等价常量模块；后端在应用装配时读取构建信息。二者均允许 `unknown` 字段，但不得显示为空字符串或假造 commit。
- `/api/version` 是公开只读 GET 接口，不放在 `/api/v1` 业务前缀下，与现有 `/api/health/*` 放在一起；使用 `no-store` 响应头，避免代理缓存把旧后端版本报给新页面。

### 用户界面

- 在首页、登录页、入团页、GM 后台及 GM 控制台使用一个低调版本入口（优先复用各页面已有页脚或设置区），点击才查看详情；不放在全局根路由，不覆盖 `/play/$sessionId` 游玩房间或沉浸舞台。
- 入口默认只显示可点击的「版本」字样或 `v{网页版本}`；详情列出网页版本、后端版本、各自 commit 与构建时间。接口未返回时显示“后端未知”，并可在详情里重试。
- 点击入口打开现有 Dialog 组件，列出网页版本、后端版本、各自 commit 与构建时间；提供“复制全部”按钮，便于用户报问题。版本不同时显示醒目的“不一致”提示，但不阻止游戏。
- 所有用户可见文案走 `t()`；版本数值本身作为 `monospace` 小字展示，使用已有 Tailwind 语义类。
- 版本入口做成可复用的共享业务组件，由指定的非游玩页面显式挂载；页面选择是产品决定，不由主题插槽或路由全局注入隐式覆盖。

### 发版规则与产物

- `AGENTS.md` 增加“版本与发版”段，明确：版本源、semver/tag/CHANGELOG 约定、提交与发版顺序、`bun run release:check`、手动 docker compose 更新、不自动部署/不发布镜像、ESA 部署边界。
- `docs/release.md` 写完整流程：何时升 MAJOR/MINOR/PATCH、发版前检查、修改文件清单、tag 命名、发布后验证、回滚与热修复、compose 快速更新命令、数据库迁移和备份注意事项。
- `CHANGELOG.md` 采用 Keep a Changelog 的人工分类（`Added` / `Changed` / `Fixed` / `Removed` / `Security`），每版记录日期、tag、主要用户可见变化、升级/迁移注意；开发期条目放在 `Unreleased`。
- `bun run release:check` 校验：
  1. 根 `package.json` 版本是合法 semver；
  2. `HEAD` 指向 annotated tag `vX.Y.Z`，tag 指向的版本与 `package.json` 一致，工作区无未提交改动；
  3. `CHANGELOG.md` 存在对应版本标题和日期，且不得仍是占位文本；
  4. `docs/release.md` 与 `AGENTS.md` 中的当前流程一致（至少检查关键命令存在）；
  5. 可选的 `--runtime <url>` 模式请求 `/api/version` 与网页入口，核对运行时版本、commit 与构建注入信息；本地未启动服务时不把“跳过”算作通过。
- 发版顺序固定为：完成验证 → 更新 `Unreleased` 为正式版本 → 改根 `package.json` → 提交（gitmoji，例如 `🔖 chore(release): v0.1.0`）→ 打 annotated tag → 运行 `release:check` → 由维护者手动部署。tag 必须指向最终发布提交。
- `docker compose` 更新：在部署机 `git fetch --tags && git checkout vX.Y.Z`，执行 `docker compose build --pull && docker compose up -d`；更新前用 `bun run db:backup` 或等价 SQLite 热备份脚本备份持久卷，更新后查看健康接口与 `/api/version`，再在网页版本弹窗核对两端版本。回滚为 checkout 上一个 tag 并重复构建/启动；涉及新版本数据库迁移的回滚须先按 `docs/release.md` 检查数据兼容性，不自动降级数据库。
- 仓库不新增自动部署 workflow；现有 UI CI 保留为质量检查，不等于发版门禁。若未来要加 CI 校验，属于新需求。

## 验证

- 单元测试：版本信息的解析/格式化、`unknown` 降级、版本一致性判断、commit/buildTime 的合法与非法输入。
- 服务端契约测试：从真实 `createApp` 请求 `/api/version`，断言共享 schema 可解析、字段来自构建信息、响应 `no-store`、不暴露环境变量或文件系统路径。
- 客户端测试：编译注入的版本常量在非游玩页面显示；`/play/$sessionId` 与沉浸舞台不渲染版本入口；后端接口失败时显示“后端未知”并可重试；详情弹窗列出两端信息，复制内容与展示一致；不一致时有提示。
- 发版脚本测试：合法 semver、非法 semver、tag 名/目标不匹配、CHANGELOG 缺版本、工作区脏、运行时版本不匹配；使用临时 git 仓库与临时文件，不操作当前仓库的 tag 或工作区。
- 集成验证：运行 `bun run test`、`bun run typecheck`、`bun run check:boundaries`，以及限定改动文件的 Biome 检查/格式化；启动真实服务请求 `/api/version` 与页面入口，核对版本报告；`docker compose` 的实际部署/回滚留待维护者在部署机执行并核对，静态检查不冒充部署成功。
- 文档验证：按 `docs/release.md` 的清单逐项走一次预演；明确列出未执行的部署机步骤。

## Approaches

### 方案 1：文档约定 + 手动版本（已选择）

维护 `AGENTS.md`、`docs/release.md`、`CHANGELOG.md` 与根 `package.json` 单一版本源；构建时分别注入网页/后端版本，提供公开版本接口和非游玩页面的低调版本入口；用 `bun run release:check` 做一致性检查；`docker compose` 按 tag 源码手动构建更新。契合“确定运行版本、追溯变更、不自动部署、不发布镜像”的目标，代价是版本号和 tag 需要人工操作。

### 方案 2：GitHub Actions 自动发版

由 tag 触发 CI 生成 Release、CHANGELOG 片段并跑完整门禁；compose 仍手动更新。能减少漏项，但需要维护 workflow 与权限，而且用户明确不需要自动流程；与轻量手动目标不匹配，未选择。

### 方案 3：Conventional commits + 自动版本号

由提交类型自动推导 semver、生成 changelog、打 tag。自动化程度最高，但与现有 gitmoji 提交习惯冲突，需改约定或加兼容层，对一个自部署单体过重，未选择。

## 留给实现者的决定

- 版本入口用 Popover 还是 Dialog，以及具体落在哪些已有页脚/设置区，只要复用现有基础组件、满足低调可复制且游玩房间不显示即可。
- 构建注入常量模块的文件名与 `VITE_*` 环境变量命名，以 Vite/Bun 类型声明的最简实现为准。
- `release:check` 脚本放在 `scripts/release/` 下，具体实现可拆纯函数与 CLI，但测试必须覆盖上述失败路径。
- 首个版本号在实现完成后由维护者按成熟度指定；设计不预设当前功能应为 `0.1.0` 还是 `1.0.0`。
- `docker compose` 是否已存在文件、其服务名与卷路径由实现者核对现有仓库；不擅自创建与实际情况冲突的部署清单。
