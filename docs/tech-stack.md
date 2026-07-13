# 技术栈（定稿 2026-07-13）

全栈 TypeScript，运行时统一为 Bun。

| 层 | 选型 | 说明 |
|---|---|---|
| 运行时/工具链 | **Bun** | runtime、包管理（workspaces）、测试（`bun test`）、`.env` 加载一体 |
| 后端框架 | **Elysia** | Bun 原生框架；配 **Eden Treaty** 实现端到端类型安全（替代 tRPC） |
| 实时通信 | **Bun 原生 WebSocket**（Elysia `ws` 插件） | 内建 topic pub/sub，"团"即一个 topic，天然的房间广播模型 |
| 客户端 WS | **partysocket** | 自动重连、心跳；配合 lastEventId 补发机制 |
| 前端 | **React 19 + Vite + TypeScript** | SPA，无 SSR 需求 |
| 路由 | **TanStack Router** | 类型安全的路由参数与 search params，与全栈类型安全理念一致 |
| 状态管理 | **Zustand** | WS 消息到达后直接写 store，组件订阅切片 |
| UI | **Tailwind CSS v4 + shadcn/ui** | shadcn 组件源码拷入仓库（`apps/client/src/components/ui/`），可深度定制；主题走 CSS 变量语义 token |
| ORM | **Drizzle + `bun:sqlite`** | Bun 内置 SQLite 驱动，同步 API，零原生编译；迁移用 drizzle-kit |
| 协议与校验 | **zod**（`packages/shared`） | WS 消息协议、人物卡 schema、掷骰结果的单一事实来源，两端共享类型 |
| Excel 解析 | **SheetJS (xlsx)** | 服务端解析 CoC 人物卡 |
| 音频 | **Howler.js** | 处理自动播放解锁、循环、淡入淡出、seek |
| 玩家指纹 | **FingerprintJS**（开源版） | 匿名玩家标识与黑名单基础 |
| 部署 | 单 Bun 进程 + Docker（`oven/bun`） | Elysia 同时托管 API、WS 与前端静态产物 |

## 已考虑并否决的方案

| 方案 | 否决原因 |
|---|---|
| Vue 3 + Element Plus | 用户明确倾向 React 技术栈 |
| SolidJS | 性能瓶颈不在框架层（事件驱动更新，非帧循环）；UI 生态薄，GM 后台开发成本高 |
| Socket.IO | 在 Bun 上兼容性不完美；Bun 原生 WS 的 pub/sub 更契合房间模型 |
| Nuxt / Next 全栈框架 | 长连接实时应用，无 SSR/SEO 需求，SPA + 独立后端更简单 |
| PostgreSQL | 自部署单 GM、单桌并发场景，SQLite 零运维足够；Drizzle 换驱动成本低，留作扩展路径 |
| React Router | 可用，但 TanStack Router 的类型安全参数与本项目"端到端类型安全"的选型哲学更一致 |

## 取舍说明

- **Elysia 与 Bun 深度绑定**：接受锁定 Bun。若未来需要跨运行时，替代方案为 Hono（`hc` 客户端同样有类型安全 RPC），但 WS pub/sub 需自行封装。
- **放弃 Socket.IO 的代价**：断线重连与消息补发需自行设计，方案见 `architecture.md` 的事件日志一节。
