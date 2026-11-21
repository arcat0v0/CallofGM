# Shared build context v2 for /gm/characters prototypes (rule-first, generic, scale)

## What the page is
The character library ("人物管理") in the GM back office of CoGM, a web tool for running tabletop RPG sessions with several rule systems (today: 克苏鲁的呼唤 第7版 / CoC 7e, and 龙与地下城 第五版（2024） / D&D 5e; more may be added). UI language: Simplified Chinese. Audience: the game master (GM), preparing sessions and finding characters quickly. This is the permanent character library, NOT a live session (no wounds, no session state).

Emotional target: a professional command console — efficient, precise, organized; the GM finds any of hundreds of characters in seconds and grasps who they are at a glance.

## The organizing model (this is the point of the redesign)
- The RULE SYSTEM is the top-level unit. Every character belongs to exactly one rule; the GM works inside one rule at a time (switching rule is a deliberate, prominent control with per-rule counts). New characters are created inside the current rule.
- Inside a rule, characters can be narrowed by: 类型 (PC / NPC), 模组 (modules of that rule, many-to-many — a character can be in several modules; plus "未归入模组"), 归属 (我创建的 / 玩家持有), name search, sort (最近更新 / 名称).
- The library must work for HUNDREDS of characters: compact rows, counts everywhere, fast filtering, clear "no results" state, sticky headers, keyboard navigation (↑/↓, / to search) is welcome.
- PL-owned characters (players' PCs that joined one of the GM's modules through review) appear READ-ONLY, clearly marked "玩家持有 · <player name>". For them: 查看人物卡 instead of 编辑, no delete, but module links are still shown.

## Generic only (hard rule)
The list/grid/table shows ONLY generic fields: portrait thumbnail (or a deliberate no-portrait state), name, PC/NPC, modules, owner, number of expressions (立绘/表情 count), last updated (relative, e.g. "3 天前"). NO rule numbers (no HP/SAN/AC/level) in the list.
The detail/inspector may show ONE rule-provided block "人物卡摘要": a list of label/value pairs that the rule system supplies (data field `summary`). Render it generically as a definition list — the page must not know what the labels mean, and it must look right for both rules (CoC gives 职业/年龄/时代/HP/MP/SAN; D&D gives 职业/等级/种族/HP/AC). Rule-specific capabilities: "从 Excel 导入" exists only for CoC (show it only when the current rule is coc7e).

## Data (use this; inline it into the page as a JS constant)
/home/chihaya/Develop/CallofGM/design/briefs/roster-fixture.json — 134 characters (82 CoC, 52 D&D), rules, modules. Fields: id, ruleId, name, kind (PC|NPC), owner {kind gm|pl, name}, modules [names], portrait (file name or null — reference as ../../assets/<file>), expressions [labels], updatedAt (ISO; "now" is 2026-11-21), summary [[label, value]]. It is layout-test data; render it faithfully, do not invent other fields.
Portraits: 3:4 painterly busts on dark olive-charcoal; only 9 characters have one, so the no-portrait state is the common case and must look intentional and calm (never a broken-image "×", never a generic person icon in a circle; a monogram or a quiet empty frame).

## Actions that must exist
Page level: 新建人物 (primary, in current rule), 导入 (CoC only). Per character: 编辑人物卡 (main action; for PL characters 查看人物卡), 管理立绘, 关联模组 (add/remove module links), 删除 (destructive, in an overflow menu; not for PL characters).

## The app shell (global; keep it)
Left navigation rail 96px, background #12140e, full height. Top: 40px round logo mark. Vertical items, each a 24px line icon above a 12px label: 团, 模组, 模组模板, 人物 (active: icon in a pill #374d13 with #d0eda1 icon), 音乐, 黑名单, 审核, 回收站. Bottom: 40px round avatar "KP" (#374d13 bg, #d0eda1 text) and a logout icon. Simple inline SVG line icons (1.75px stroke). Page content sits to the right on #1a1c16. On mobile (390px) the rail stays 96px wide (global): design the page for the remaining ~294px — the document should scroll normally on mobile, the list is full width, tapping a character opens its detail as a full view with a back control.

## Design tokens (the product's real dark palette — do not add hues)
--surface #12140e; --surface-container-lowest #0d0f09; --surface-container-low #1a1c16; --surface-container #1e2019; --surface-container-high #292b23; --surface-container-highest #33362e; --on-surface #e2e3d8; --on-surface-variant #c5c8b9; --outline #8f9285; --outline-variant #45483d;
--primary #b4d087; --on-primary #223600; --primary-container #374d13; --on-primary-container #d0eda1;
--secondary #56d6f5; --tertiary #bac3ff; --tertiary-container #2f4090; --error #ffb4a6; --warning #f0c11c.
Radii: 4, 8, 12, 16, 28px, full. Fonts: system stack only — sans: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; mono: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace. tabular-nums for numbers. No web fonts. Minimum text size 11px; small text on dark backgrounds uses #c5c8b9 (≥4.5:1).

## Build rules
- One self-contained HTML file: inline CSS/JS, semantic HTML, CSS custom properties for every token, no external requests.
- Real copy in Chinese, short, console voice. No lorem, no marketing words, no explanatory paragraphs about how to use the page.
- Desktop 1440×900 and mobile 390×844 both deliberately designed. On desktop the page itself does not scroll; inner regions scroll and carry the attribute data-scroll. On mobile the document scrolls.
- Fully interactive with the fixture: rule switch, filters, search, sort, selection, view toggles, link/unlink module (in-memory), delete (in-memory, with confirm). Hover and :focus-visible states. Native buttons/inputs. prefers-reduced-motion respected.
- URL hash hooks for screenshots: "#rule=dnd5r", "#sel=<id>", "#view=<name>" (if you have views), "#q=<text>", "#m=detail" (mobile: open detail of the selected character). Combine with "&".
- Avoid: identical rounded stat tiles, initial-letter avatar circles, badge pills on every row, accent color on every name, decorative empty space, gradients, glows, glassmorphism, emoji, uniform rounding everywhere, explanatory footnotes, the same datum shown twice. One filled primary button per screen. Accent green only for selection and the primary action.
- Make it look great. Commit fully to the direction.
