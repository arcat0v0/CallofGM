# CoGM — Agent 指南

本项目是 CoGM（主持人的呼唤）：CoC 7e 网页跑团工具，全栈 TypeScript + Bun。

任何 AI 代理在本仓库工作前，必须先阅读：

1. `docs/product.md` — 产品需求与领域规则
2. `docs/tech-stack.md` — 定稿技术栈（含否决方案清单，不得引入）
3. `docs/architecture.md` — 架构决策：服务端权威、WS 协议、音频同步、路由
4. `CLAUDE.md` — 硬性约束汇总

要点速览：Bun + Elysia（Eden Treaty）+ Bun 原生 WS / React 19 + Vite + TanStack Router + Zustand + Tailwind v4 + shadcn/ui / Drizzle + bun:sqlite / zod 协议共享于 `packages/shared`。
