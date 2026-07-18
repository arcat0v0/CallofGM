# CoGM — Agent 指南

本项目是 CoGM（主持人的呼唤）：CoC 7e 网页跑团工具，全栈 TypeScript + Bun。

任何 AI 代理在本仓库工作前，必须先阅读：

1. `docs/product.md` — 产品需求与领域规则
2. `docs/tech-stack.md` — 定稿技术栈（含否决方案清单，不得引入）
3. `docs/architecture.md` — 架构决策：服务端权威、WS 协议、音频同步、路由
4. `CLAUDE.md` — 硬性约束汇总

要点速览：Bun + Elysia（Eden Treaty）+ Bun 原生 WS / React 19 + Vite + TanStack Router + Zustand + Tailwind v4 + shadcn/ui / Drizzle + bun:sqlite / zod 协议共享于 `packages/shared`。

## 前端组件与样式约束（硬性）

- 前端 UI 必须遵循“通用组件 → 组合/variant 扩展 → 业务专用组件”的优先级。开发前先检查 `apps/client/src/components/ui/` 中的 shadcn/ui 基础组件及项目已有通用组件；按钮、表单、弹窗、菜单、卡片、表格等常见 UI 禁止重复手写同类实现。
- 现有组件不能直接满足需求时，优先通过组合已有组件、增加通用 props 或 variant 扩展能力。只有组件与某个特殊业务语义或交互强绑定，且无法合理抽象为通用能力时，才允许在对应 `apps/client/src/features/{domain}/` 下新增业务组件；业务逻辑不得下沉到 `components/ui/` 的通用基础组件中。
- 样式统一使用 Tailwind CSS v4 的 utility class 与全站 CSS 变量语义 token；颜色、间距、圆角、阴影等视觉值不得在各页面随意硬编码。禁止为普通组件新增成套的页面级/组件级 CSS、复制重复样式或以大量内联 `style` 代替 Tailwind。
- 独立 CSS 仅限 Tailwind 难以合理表达的全局 reset、主题 token、字体、关键帧、第三方样式覆盖和运行时动态值，并应保持最小范围；重复出现的 utility class 组合必须收敛为通用组件或统一 variant，避免散落复制。
