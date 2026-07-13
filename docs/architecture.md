# 架构设计

## Monorepo 结构（Bun workspaces）

```
CallofGM/
├── package.json          # workspaces: ["apps/*", "packages/*"]
├── packages/
│   └── shared/           # zod schema：WS 消息协议、CoC 人物卡、掷骰结果、团状态枚举
├── apps/
│   ├── client/           # React 19 + Vite + TanStack Router + Zustand + Tailwind v4 + shadcn/ui
│   └── server/           # Elysia + Drizzle + bun:sqlite
├── data/                 # SQLite 文件 + 上传媒体（立绘/背景/音乐/情报图片），不入库存磁盘
└── docs/                 # 本目录
```

`packages/shared` 是协议的单一事实来源：服务端用 zod 做运行时校验，客户端用 `z.infer` 拿类型。改协议 → 两端编译期报错。

## 服务端权威原则

以下判定一律在服务端执行，前端只渲染结果、禁用输入：

- 团状态机流转（等待开始/准备中/进行中/已结团）与团内阶段（自由讨论/演绎时间/强制CG/自由演绎）
- 每条消息"是否允许发出、记为场外还是角色扮演"的裁决，以及演绎发言的放行（GM 待呈现队列）
- 掷骰（服务端生成随机数后广播，防前端造假）
- 情报可见性（秘密情报只推送给可见者，禁止全员广播后前端隐藏）
- 踢人、黑名单校验（WS 握手时校验指纹）

## WebSocket 设计

- 每个团一个 topic：`session:{id}`。连接加入团即 `ws.subscribe`，广播用 `server.publish`。
- **定向消息**（如秘密情报）不走 topic，服务端按连接注册表向可见者逐连接推送。
- 消息信封：`{ eventId: number, type: string, payload: T }`，eventId 为团内单调递增序号。
- **断线补发**：服务端为每个进行中的团在内存维护一个环形事件日志（近 N 条），日志条目带可见范围（全体 / 指定 PC 集合）。客户端（partysocket 自动重连）重连时携带 `lastEventId`，服务端按请求者身份过滤后补发缺失事件；缺口超出日志范围则下发全量快照（当前场景、在场立绘及表情、阶段、音频状态、对该玩家可见的情报列表、最近聊天记录）。
- 新加入者直接走全量快照路径。

## 演绎发言队列（隐式审核）

- 生命周期：玩家发送演绎消息 → 服务端写入该团的**待呈现队列**（不广播、不进事件日志、不分配 eventId）→ GM 控制台实时看到队列，可排序、放行、丢弃 → **放行时才分配 eventId**、写入事件日志并广播进场景；丢弃则静默移除。
- eventId 只在放行时分配，保证事件日志与断线补发的顺序即"呈现顺序"，与队列内部状态无关。
- 玩家端对队列零感知：发送即完成，无待审/驳回状态展示；玩家自己的消息也只在放行后出现在场景中。
- 演绎消息可携带表情切换 `expressionId`（服务端校验只能操作发言者自己的 PC），放行时随消息一并广播，场景立绘同步切换；表情**预览**为纯前端功能（玩家浏览自己 PC 的各表情立绘素材），无服务端交互。
- PC 玩家与 GM 的场外（OOC）消息绕过队列，即时分配 eventId 并广播；**OB 的所有发言一律入队**，经 GM 放行后才上公屏。
- 队列本身只对 GM 可见：随 GM 端快照下发，GM 重连不丢队列；队列持久化到 SQLite，服务端重启不丢失未放行的发言。

## 音频同步（GM 控制）

服务端为每个团维护权威音频状态：

```
BgmState = { trackId, playing, volume, loop, seekOffset, startedAt(服务器时钟) }
```

- GM 发出指令（播放/暂停/切歌/音量/淡入淡出/seek）→ 服务端更新状态并广播 → 各客户端 Howler 执行。
- 中途加入/重连者从快照恢复：播放位置 = `seekOffset + (serverNow - startedAt)`，对 loop 曲目取模时长。
- **SE 音效**为一次性广播（fire-and-forget），不进快照。
- 玩家本地可静音/调本地音量，不影响他人；进团点击作为浏览器音频解锁手势。

## 情报发放

- 情报条目存于模组（标题、正文、可选图片），发放记录存于团：`{ handoutId, sessionId, visibility: 'all' | pcIds[] , grantedAt }`。
- GM 发放/追加对象 → 服务端写入发放记录 → 公开情报走 topic 广播、秘密情报走定向推送 → 玩家端弹出展示并计入情报面板。
- 可见性判定只在服务端：REST 拉取情报列表与 WS 推送/补发共用同一套过滤逻辑。

## 身份、在线与黑名单

- GM：密码登录 → HttpOnly session cookie。
- 玩家：首次进入由服务端签发匿名 token（localStorage 持久化），同时上报 FingerprintJS 指纹。
- 在线列表来自 WS 连接注册表（连接 ↔ 团 ↔ 所选 PC/OB）。
- 踢出 = 关闭 socket；拉黑 = 指纹写入黑名单表（含过期时间，NULL 为永久），HTTP 与 WS 握手均校验。

## 前端路由（TanStack Router）

| 路径 | 视图 |
|---|---|
| `/` | 入口：输入/选择团 |
| `/join/$sessionId` | 玩家进团：选 PC 或 OB 位 |
| `/play/$sessionId` | 玩家沉浸视图 |
| `/gm/login` | GM 登录 |
| `/gm` | GM 后台：模组/人物/场景/音乐/情报/团管理 |
| `/gm/session/$sessionId` | GM 控制台：控场、切场景/立绘/音乐、发放情报、演绎队列放行、在线管理 |

选 TanStack Router 而非 React Router：路由参数与 search params 全类型安全，`$sessionId` 这类参数不会出现手写字符串取参的运行时错误，与 Eden Treaty / Drizzle / zod 的端到端类型安全路线一致。

## Excel 人物卡导入

GM 后台上传 `.xlsx` → 服务端 SheetJS 解析 → 按 `packages/shared` 的人物卡 zod schema 校验映射 → 返回预览给 GM 确认 → 入库。解析器按"CoC 7e 人物卡模板"实现为独立模块，未来适配其他规则时新增解析器即可。

## 渲染与部署

- 场景画面用 DOM + CSS 实现（绝对定位立绘 + transition 切换表情/转场），不引入 Canvas/PixiJS；需要更复杂动画时再加 GSAP。
- 生产部署：`vite build` 产物由 Elysia 静态托管，单 Bun 进程提供 HTTP + WS，Docker 镜像基于 `oven/bun`。
