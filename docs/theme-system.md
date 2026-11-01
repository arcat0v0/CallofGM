# 主题系统

主题系统让自部署者在不修改核心代码的前提下替换页面布局、视觉与站点文案。主题是**运行时加载的 React 插件**：以 TSX 编写、用 CLI 编译为 `.cogmtheme` 包，由 GM 在后台上传安装，玩家端与 GM 端按各自作用域加载。核心只负责插槽契约、加载、回退与主题选择，不内置任何第三方主题。

## 设计原则

- **编译产物安装**：服务端不执行 TSX 构建，也不接收源码；`.cogmtheme` 内只含 `bundle.js`、`bundle.css`、静态资源与清单。作者在本地用 CLI 构建。
- **页面级插槽，而非整页接管**：核心拥有路由、状态、WS、服务端权威判定与页面骨架；主题只覆盖约定的插槽。未覆盖的插槽回退到内置 `default` 主题。
- **内置主题不可删除**：`default` 是保留 id，随客户端发布，提供全部插槽与基础视觉。主题包只能使用 `author.theme` 形式的 id。
- **服务端权威的主题选择**：模组主题存数据库、GM 界面主题存实例级设置；客户端只读取结果，不自行决定。
- **严格 API 版本 + 分层回退**：`apiVersion` 必须与核心完全一致；不兼容、加载失败或单个插槽抛错时逐级回退（主题插槽 → 默认主题插槽 → 页面兜底）。
- **主题可覆盖全部站点文案**：核心所有 UI 文案走 `t()` 消息键；主题可提供 `messages` 覆盖。缺失键逐级回退到 `zh-CN` 基础目录。

## 主题作用域

| 界面 | 主题来源 | 切换生效时机 |
|---|---|---|
| 入口 `/`、GM 登录 `/gm/login` | 内置 `default` | 不随主题变化 |
| 玩家进团 `/join/$sessionId` | 该团所属模组的 `themeId`（`JoinInfoResponse`） | 下次加载页面 |
| 玩家沉浸视图 `/play/$sessionId` | 该团所属模组的 `themeId`（快照 / 主题查询接口） | 下次加载页面；GM 切换后玩家刷新即见 |
| GM 控制台 `/gm/session/$sessionId` | `ui_settings.gmThemeId` | 应用后由 `GmThemeScope` 即时重载 |
| GM 后台 `/gm/*` | `ui_settings.gmThemeId` | 应用后即时重载 |

- 模组主题在 `/gm/module/$moduleId` 选择；未选择或所选主题已被删除时回退 `default`。
- GM 界面主题在任意 GM 页面右下角的主题浮钮中切换，写入实例级 `ui_settings`（单例表），所有 GM 共享。
- GM 浮钮属于核心、不可被主题替换，并使用固定的中性色样式（刻意不走主题 token），保证任何主题下都能找到恢复入口。
- 任意页面追加 `?theme=default` 可强制禁用主题，用于排障；该参数不修改任何持久化设置。
- 主题版本按“最新安装版本”加载：安装新版本后，所有尚未加载的页面使用新版本；已打开的页面保持当前版本，刷新后更新。服务端为每个 id 保留最近 2 个版本用于回滚/排障。

## 包格式（`.cogmtheme`）

本质是 zip 压缩包，根目录结构：

```
theme.json          # 清单（必需）
bundle.js           # esbuild 产物，ESM，默认导出 ThemeDefinition（必需）
bundle.css          # 主题样式（可选，manifest.styles 声明）
assets/             # 图片、字体（仅允许 png/jpg/jpeg/webp/gif/svg/ico/woff/woff2/ttf/otf）
preview.png         # 后台列表预览图（可选）
README.md           # 说明（可选）
```

`theme.json` 由 CLI 生成，字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `formatVersion` | `1` | 包格式版本，固定为 1 |
| `id` | string | `author.theme`，小写字母/数字/连字符；`default` 保留 |
| `name` | string | 展示名 |
| `version` | string | 严格 `x.y.z`；同一 id 只能安装更高版本 |
| `apiVersion` | integer | 主题 API 版本，当前必须为 `1` |
| `description` / `author` / `license` / `repository` / `homepage` | string | 可选元数据；`repository`/`homepage` 必须是合法 URL |
| `entry` | `"bundle.js"` | 固定 |
| `styles` | string[] | 相对路径 CSS，最多 12 个 |
| `defaultLocale` | string | 默认语言，缺省 `zh-CN` |
| `locales` | string[] | 声明支持的语言 |
| `colorScheme` | `"dark" \| "light"` | 应用到根元素 `color-scheme` |
| `themeColor` | `#rrggbb` | 浏览器地址栏颜色 |
| `icon` | string | favicon 相对路径（通常 `assets/icon.png`，需在允许的图片扩展名内） |
| `slots` | string[] | 声明覆盖的插槽（仅元数据） |
| `tokens` | Record<string, string> | CSS 颜色 token 覆盖，键写入 `--color-<key>` |
| `bundleHash` | `sha256:<64 hex>` | `bundle.js` 哈希，安装时校验 |
| `signature` | string \| null | 预留字段，v1 不校验 |

服务端安装安全限制：

- 上传仅限 GM，校验同源、上传限流；压缩包 ≤ 50 MB。
- 解压条目 ≤ 2000，单文件 ≤ 20 MB，解压总量 ≤ 200 MB；拒绝绝对路径、`..`、反斜杠与白名单外文件。
- 清单必须通过 `ThemeManifest` 校验，`bundleHash` 必须与 `bundle.js` 匹配；样式与图标文件必须存在。
- 解压到 `data/themes/.tmp/<uuid>` 后原子 `rename` 到 `data/themes/<id>/<version>`，失败清理临时目录；仅保留最近 2 个版本。
- 主题 bundle 是**不受沙箱限制的浏览器代码**，拥有页面全部权限。只安装可信来源的 `.cogmtheme`；GM 上传等同于安装插件。

## 主题开发（`packages/theme-cli`）

工作区提供 `cogm-theme` 命令。CLI 未发布到 npm，v1 的主题创作在 CoGM 仓库 checkout 旁进行：

```bash
# 在 CoGM 仓库根目录执行；建议把主题源码放在仓库外
bun run theme init author.my-theme ../my-theme
cd ../my-theme
bun run build                         # 输出 dist/（bundle.js、bundle.css、theme.json）
bun run pack                          # 产物默认在该目录生成 author.my-theme-1.0.0.cogmtheme
```

也可以从任意目录直接调用 CLI 文件：

```bash
bun /path/to/CoGM/packages/theme-cli/src/index.ts init author.my-theme ./my-theme
```

`init` 生成 `package.json` 的 `build`/`pack` 脚本时会写入当前机器上 CLI 文件的绝对路径，因此脚手架内 `bun run build` / `bun run pack` 可直接使用；分享主题时分享 `.cogmtheme` 打包产物，而不是主题源码。

- `build` 以 `src/index.tsx` 为入口，用 esbuild 打包为 ESM；`react`、`react-dom`、`@cogm/theme-sdk` 被替换为 `globalThis.__COGM_THEME_SDK__` 的运行时代理，确保主题与核心共享同一份 React，避免 hooks/context 断裂。
- esbuild 从组件导入的 CSS 与 `src/styles.css`（若存在）会合并为 `dist/bundle.css`，并自动写入 `manifest.styles`。
- `theme.config.ts` 默认导出构建配置，字段与清单对应，`formatVersion`、`entry`、`bundleHash` 由 CLI 补齐。
- 资源通过 `assetUrl("assets/bg.png")` 取得带版本前缀的 URL；也可在 CSS 中使用 `--color-md-*` 等核心 token。
- 主题是纯编译产物：不能 `import` 核心客户端源码（`@/...`），只能依赖 SDK 暴露的 API 与稳定 token。

## SDK（`packages/theme-sdk`）

```tsx
import { defineTheme, assetUrl, t, useLocale } from "@cogm/theme-sdk";
import type { PlayDialogueCtx } from "@cogm/theme-sdk";

function Dialogue({ speaker, text }: PlayDialogueCtx) {
  return (
    <div className="my-dialogue" style={{ backgroundImage: `url(${assetUrl("assets/paper.png")})` }}>
      <strong>{speaker}</strong>
      <p>{text}</p>
    </div>
  );
}

export default defineTheme({
  slots: { "play.dialogue": Dialogue },
  messages: { "zh-CN": { "play.dialogue.speakerFallback": "？？？" } },
});
```

`defineTheme` 接受 `{ slots, messages? }`。`slots` 中未提供的插槽使用 `default` 主题实现；提供未知插槽名会在加载时被拒绝并回退默认主题。组件通过 props 接收只读视图数据、已渲染的 `nodes` 与回调，**不得**在主题内复制业务判定；所有状态变更必须调用核心传入的 action。

### 插槽列表

| 插槽 | 上下文 | 说明 |
|---|---|---|
| `join.layout` | `JoinLayoutCtx` | 进团页整体布局；`nodes.header/seats/spectator/action`、`view`、`actions.join` |
| `join.header` | `JoinHeaderCtx` | 团名、模组名、状态 |
| `join.seat-card` | `JoinSeatCardCtx` | PC/OB 座位卡；`seat`、`selected`、`disabled`、`onSelect`、`variant` |
| `play.layout` | `PlayLayoutCtx` | 玩家沉浸视图布局；`nodes.stage/chat/composer/overlays/connection`、`viewport` |
| `play.stage` | `PlayStageCtx` | 舞台外壳；`nodes.sceneInfo/portrait/dialogue/audio`、场景视图数据 |
| `play.scene-info` | `PlaySceneInfoCtx` | 左上场景/阶段信息；由核心渲染（主题通常只调整外观） |
| `play.dialogue` | `PlayDialogueCtx` | 当前演绎对话框；`speaker`、`roleLabel`、`text`、`size` |
| `play.chat-panel` | `PlayChatPanelCtx` | 聊天面板；`messages: ChatMessageView[]`、`compact`、`onCollapse` |
| `play.chat-message` | `PlayChatMessageCtx` | 单条聊天消息气泡；`message`、`variant` |
| `gm-console.layout` | `GmConsoleLayoutCtx` | GM 控制台三栏布局；`nodes.controls/stage/chat/overlays/connection/endedBanner` |
| `gm-console.stage` | `GmConsoleStageCtx` | 控制台舞台外壳 |
| `gm-admin.shell` | `GmAdminShellCtx` | GM 后台外壳；`nodes.nav/content` |
| `gm-admin.nav` | `GmAdminNavCtx` | 导航栏；`items`（含 label/icon/to/active）、`onNavigate`、`onLogout` |

`ChatMessageView.isSystem` 是稳定字段：系统消息（骰点结果、状态提示等）由服务端/核心标记，主题应据此渲染，不得通过匹配文案判断。`speakerRoleLabel`、`roleLabel` 等展示文案已由核心本地化。

### 文案覆盖

- 核心所有站点文案集中在 `apps/client/src/i18n/messages/zh-CN.ts`，以点分层键组织（如 `play.stage.phaseHint`、`error.AUTH_REQUIRED`）。
- 主题 `messages` 结构为 `{ [locale]: { [key]: string } }`；当前激活语言由核心维护（v1 基础语言 `zh-CN`）。
- 主题组件内用 `t(key, vars?)` 取文案，`useLocale()` 获知当前语言；`translateOr(key, fallback)` 在核心内部用于错误码回退。
- 服务端错误以稳定 code 返回，客户端 `errorText(error, fallbackKey)` 先查 `error.<code>`，缺失时使用服务端 message 或 fallback key。
- 主题只覆盖已有键；新增键不会被核心使用，但主题自己的组件可以自由使用。

## 服务端存储与接口

- 安装目录：`THEMES_DIR`（默认 `data/themes`，相对服务端工作目录；本地为 `apps/server/data/themes`，Docker 中为 `/app/data/themes`），结构 `<THEMES_DIR>/<id>/<version>/`。
- 数据库：`modules.theme_id` 保存模组主题；`ui_settings` 单例表保存 `gm_theme_id`。
- 备份策略需同时覆盖数据库与 `THEMES_DIR`；只备份数据库不会保留已安装主题文件。
- 公开接口：
  - `GET /api/v1/themes/:id/manifest` → `ThemeManifest`，`Cache-Control: no-cache`。
  - `GET /api/v1/themes/:id/versions/:version/*` → 版本化静态文件，`Cache-Control: public, max-age=31536000, immutable`。
  - `GET /api/v1/public/sessions/:id/theme` → `{ themeId }`，供玩家端解析有效主题。
- GM 接口（需 GM 会话）：
  - `GET /api/v1/gm/themes`、`POST /api/v1/gm/themes`（multipart `file`）、`DELETE /api/v1/gm/themes/:id`、`POST /api/v1/gm/themes/rescan`。
  - `GET/PUT /api/v1/gm/ui-settings`，body `{ gmThemeId: string | null }`。
- 模组创建/更新时校验 `themeId` 已安装；删除主题前拒绝被模组或 GM 界面引用。

## 客户端加载与回退

1. `ThemeScope` 按作用域拿到 themeId（`null` 表示默认），请求最新 manifest。
2. 校验清单、`apiVersion === 1`、id 一致；动态 `import()` 版本化 `bundle.js`（URL 含版本，天然破缓存）。
3. 校验默认导出结构、插槽名与组件类型、`messages` 类型；成功后应用 token、样式、`color-scheme`、favicon、theme-color，并把 React/ReactDOM/JSX/SDK 注入 `globalThis.__COGM_THEME_SDK__`。
4. 每个 `ThemeSlot` 独立错误边界：主题插槽抛错时渲染默认主题同类插槽；默认插槽也抛错时渲染页面提供的兜底（通常为 `null`）。主题整体加载失败时记录控制台错误并回退默认主题，页面不白屏。
5. `?theme=default` 强制走默认主题，并跳过所有主题 DOM 覆盖。
6. 主题切换/卸载时恢复基线 favicon 与 theme-color，移除注入的 token 与样式链接。

## 与设计 token 的关系

- 核心页面仍遵守 `docs/DESIGN.md`：所有设计 token 定义在 `apps/client/src/styles/theme.css` 的 `@theme`。
- 主题 CSS 是文档化例外：它通过 `--color-md-*` 等 token 覆盖与自身 `.cogm-*` 类实现视觉，不写回核心 `theme.css`；`manifest.tokens` 只允许颜色键，运行时写入 `:root` 的内联自定义属性。
- 内置 `default` 主题的插槽实现位于 `apps/client/src/themes/default/slots/`，是主题作者最直接的参考。

## 验证

```bash
bun run typecheck
bun run test                 # 含主题契约测试 tests/contract/themes.test.ts
bun run check:boundaries
bun run build:client
```

端到端手工验证（需用户执行浏览器部分）：

1. `bun run dev:server` + `bun run dev:client`。
2. 用 `cogm-theme init` / `build` / `pack` 生成示例主题，在 `/gm/themes` 上传。
3. 在模组页选择该主题，进入 `/play/$sessionId` 刷新验证插槽、样式、文案与资源。
4. 在 GM 页面右下角切换 GM 主题，确认控制台与后台即时更新；用 `?theme=default` 验证逃生开关。
5. 上传非法包（缺 `bundle.js`、错误哈希、路径穿越、超大文件）确认错误提示且不影响已安装主题。