# CoGM（主持人的呼唤）— Agent 协作准则

网页跑团工具，支持 CoC 7e 和 D&D 第五版（2024 规则），参考 CCFolia，沉浸式场景 + 立绘 + 对话。全栈 TypeScript，运行时 Bun。

## 必读文档

开始任何设计或编码工作前，先阅读 `docs/`：

- `docs/product.md` — 产品需求：角色/模组/团模型、团状态与阶段规则、掷骰与鉴定、角色团内状态、音频 GM 控制、情报发放、黑名单
- `docs/tech-stack.md` — 定稿技术栈（Bun + Elysia + React 19 + TanStack Router + shadcn/ui + Drizzle/bun:sqlite）
- `docs/architecture.md` — 架构：monorepo 布局、规则系统抽象、WS 协议与断线补发、服务端权威原则、演绎发言队列、音频同步、情报可见性、路由表
- `docs/theme-system.md` — 运行时主题插件：`.cogmtheme` 格式、插槽与 SDK、主题作用域、安装安全与回退链
- `docs/DESIGN.md` — UI/UX 设计规范：M3 Expressive 设计方向、官方资源、token 体系与样式文件职责

## 硬性约束

- 技术选型以 `docs/tech-stack.md` 为准，不引入已被否决的方案（Socket.IO、React Router、Next/Nuxt 等）。
- **规则系统抽象（永久原则）**：所有规则相关逻辑（人物卡 schema 与解析、鉴定判级、特殊检定、团内状态定义与推导、骰点命令）必须通过规则系统抽象接入——面向对象设计，`RuleSystem` 抽象类 + 每种规则一个实现类，服务端按 `ruleId` 从注册表取实现。通用业务代码禁止硬编码任何具体规则的判定；规则专属 schema 放 `packages/shared/src/rules/{ruleId}/` 并以命名空间导出。详见 `docs/architecture.md` 的"规则系统抽象"。
- D&D 第五版（2024）的规则 ID 为 `dnd5r`。内置资料限于 SRD 5.2.1 的结构化数据，接入或扩展目录时保留来源与署名。见 [D&D 规则与目录](docs/dnd5r-srd.md)。
- 发言权限、团状态机、掷骰等规则判定必须服务端权威，见 `docs/architecture.md`。
- WS 消息协议与数据 schema 一律定义在 `packages/shared`（zod），禁止两端各写一份。
- 一律使用 Bun 工具链：`bun install` / `bun run` / `bunx` / `bun test`。
- UI/UX 设计规范统一维护在 `docs/DESIGN.md`（M3 Expressive 方向、设计 token 体系、样式文件职责分离等硬性约束），UI 相关工作前必读。

## 版本与发版

- 根 `package.json` 的 `version` 是软件版本号唯一事实来源；使用 `MAJOR.MINOR.PATCH`，Git tag 使用 `vX.Y.Z`，CHANGELOG 标题使用 `## [X.Y.Z] - YYYY-MM-DD`。
- 每次发布必须提交发布准备、创建指向最终提交的 annotated tag，并运行 `bun run release:check`；不得移动或覆盖已发布 tag。
- 版本号、`CHANGELOG.md`、`docs/release.md`、`AGENTS.md` 与运行时 `/api/version` 必须互相对齐。
- 发布顺序固定为：验证 → 更新 CHANGELOG → 修改根版本 → gitmoji 提交 → annotated tag → `bun run release:check` → 维护者手动部署。
- 部署使用 `docker compose build --pull` 与 `docker compose up -d`，或直接通过 systemd（`deploy/systemd/deploy.sh` / `deploy/systemd/cogm.service` 配合 `config/cogm.systemd.toml`）在当前检出的 tag 源码上手动执行；先备份 `data/` 数据库，再核对健康接口与页面版本弹窗。
- 部署只使用上述手动 Docker Compose 或 systemd 流程，不发布或推送 Docker 镜像，不生成 GitHub Release，不增加 tag 触发 CI，不自动部署。
- 版本入口只允许出现在首页、登录页、入团页、GM 后台与 GM 控制台；游玩房间 `/play/$sessionId` 与沉浸舞台不得显示版本信息。
- 阿里云 ESA 云函数不是后端宿主；ESA 仅可作为前端静态托管或回源加速层，不纳入本发版流程。
- 完整流程、回滚、热修复与数据库迁移注意事项见 `docs/release.md`。
