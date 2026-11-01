# 技术栈（定稿 2026-07-13）

全栈 TypeScript，运行时统一为 Bun。

| 层 | 选型 | 说明 |
|---|---|---|
| 运行时/工具链 | **Bun** | runtime、包管理（workspaces）、测试（`bun test`）、`.env` 加载一体 |
| 后端框架 | **Elysia** | Bun 原生框架；配 **Eden Treaty** 实现端到端类型安全（替代 tRPC） |
| 实时通信 | **Bun 原生 WebSocket**（Elysia `ws` 插件） | 内建 topic pub/sub，"团"即一个 topic，天然的房间广播模型 |
| 客户端 WS | **partysocket** | 自动重连、心跳；配合 lastEventId 补发机制 |
| 前端 | **React 19 + Vite + TypeScript 7** | SPA，无 SSR 需求 |
| 路由 | **TanStack Router** | 类型安全的路由参数与 search params，与全栈类型安全理念一致 |
| 状态管理 | **Zustand** | WS 消息到达后直接写 store，组件订阅切片 |
| UI | **Tailwind CSS v4 + shadcn/ui** | shadcn 组件源码拷入仓库（`apps/client/src/components/ui/`），可深度定制；主题走 CSS 变量语义 token |
| ORM | **Drizzle + `bun:sqlite`** | Bun 内置 SQLite 驱动，同步 API，零原生编译；迁移用 drizzle-kit |
| 协议与校验 | **zod**（`packages/shared`） | WS 消息协议、人物卡 schema、掷骰结果的单一事实来源，两端共享类型 |
| Excel 解析 | **SheetJS (xlsx)** | 服务端解析 CoC 人物卡 |
| 音频 | **Howler.js** | 处理自动播放解锁、循环、淡入淡出、seek |
| 玩家指纹 | **FingerprintJS**（开源版） | 匿名玩家标识与黑名单基础 |
| UI 主题 | **运行时 React 插件 + esbuild + fflate** | 主题以 TSX 编写、CLI 编译为 `.cogmtheme`（zip）；React 经 `globalThis.__COGM_THEME_SDK__` 共享；页面级插槽见 `docs/theme-system.md` |
| 部署 | 单 Bun 进程 + Docker（`oven/bun`） | Elysia 同时托管 API、WS 与前端静态产物；主题安装于持久卷 `data/themes` |
