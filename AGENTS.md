# CoGM（主持人的呼唤）— Agent 协作准则

网页跑团工具（v1 适配 CoC 7e），参考 CCFolia，沉浸式场景 + 立绘 + 对话。全栈 TypeScript，运行时 Bun。

## 必读文档

开始任何设计或编码工作前，先阅读 `docs/`：

- `docs/product.md` — 产品需求：角色/模组/团模型、团状态与阶段规则、掷骰与鉴定、角色团内状态、音频 GM 控制、情报发放、黑名单
- `docs/tech-stack.md` — 定稿技术栈（Bun + Elysia + React 19 + TanStack Router + shadcn/ui + Drizzle/bun:sqlite）
- `docs/architecture.md` — 架构：monorepo 布局、规则系统抽象、WS 协议与断线补发、服务端权威原则、演绎发言队列、音频同步、情报可见性、路由表

## 硬性约束

- 技术选型以 `docs/tech-stack.md` 为准，不引入已被否决的方案（Socket.IO、React Router、Next/Nuxt 等）。
- **规则系统抽象（永久原则）**：所有规则相关逻辑（人物卡 schema 与解析、鉴定判级、特殊检定、团内状态定义与推导、骰点命令）必须通过规则系统抽象接入——面向对象设计，`RuleSystem` 抽象类 + 每种规则一个实现类（v1 仅 CoC 7e），服务端按 `ruleId` 从注册表取实现。通用业务代码禁止硬编码任何具体规则的判定；规则专属 schema 放 `packages/shared/src/rules/{ruleId}/` 并以命名空间导出。详见 `docs/architecture.md` 的"规则系统抽象"。
- 发言权限、团状态机、掷骰等规则判定必须服务端权威，见 `docs/architecture.md`。
- WS 消息协议与数据 schema 一律定义在 `packages/shared`（zod），禁止两端各写一份。
- 一律使用 Bun 工具链：`bun install` / `bun run` / `bunx` / `bun test`。
- 样式文件职责分离（硬性）：`apps/client/src/styles/globals.css` 仅作为全局样式入口（聚合 `@import` 与 `@layer base`）；全部设计 token（颜色、阴影、圆角、字体）必须定义在 `apps/client/src/styles/theme.css` 的 `@theme` 块中并按文件内分区归类，禁止写回 `globals.css` 或在其他文件中新建 `@theme`。
