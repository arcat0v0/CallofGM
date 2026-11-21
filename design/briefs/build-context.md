# Shared build context for /gm/characters prototypes

## What the page is
The character library ("人物管理") in the GM back office of CoGM, a web tool for running Call of Cthulhu 7th edition tabletop sessions. UI language: Simplified Chinese. Audience: the game master (GM, called KP in CoC), preparing sessions and looking things up mid-session. The GM keeps both player characters (PC, 调查员) and non-player characters (NPC) here. This is the permanent character sheet library, NOT a live session: there are no wounds, no current-session state, no player names, no session assignment. Never invent such data.

Emotional target: a professional command console — efficient, precise, information-dense; the GM grasps every character at a glance.

## Real data (use exactly this; do not invent other fields)
JSON file: /tmp/claude-1001/-home-chihaya-Develop-CallofGM/7de3ff29-9362-439c-b879-4c3b2bf18cf6/scratchpad/characters.json — read it and inline the data into the page as a JS constant.
Per character: name, kind (PC|NPC), occupation (may be null → show "未填职业" muted), age (may be null), era ("1920s" → "1920 年代"), attributes {str 力量, con 体质, siz 体型, dex 敏捷, app 外貌, int 智力, pow 意志, edu 教育, luck 幸运}, skills (only the invested ones, sorted desc, label already localized), hp (max HP; in the library current = max), mp, san (starting SAN) and sanMax (99 − Cthulhu Mythos), luck, mov, db (damage bonus string like "0", "+1D4", "-1"), build, majorWound (major-wound threshold), updatedAt (ISO).
CoC rule facts you may use: every value has a Hard threshold = floor(v/2) (困难) and an Extreme threshold = floor(v/5) (极难); a roll ≤ v is a regular success. Rule system name: 克苏鲁的呼唤 第7版 (CoC 7e).
Portraits (立绘): some characters have one, some do not. Use these files when present (they may still be generating; reference them anyway with these exact relative paths and design a graceful no-portrait state for everyone else):
- 艾琳·沃克 → ../../assets/portrait-irene.png
- 托马斯·哈德维克 → ../../assets/portrait-thomas.png
- 李文渊 → ../../assets/portrait-li.png
- 玛格丽特·费恩 → ../../assets/portrait-margaret.png
- 奥斯本教授 → ../../assets/portrait-osborne.png
- 码头工人 杰克, 神秘女子, 警长 柯林斯 → no portrait
Portraits are 3:4 painterly busts on a dark olive-charcoal background.

## Actions that must exist (real features)
- 新建人物 (primary), 导入 (import a character from an Excel sheet; for the selected character also "从 Excel 更新")
- Search by name (搜索人物…), filter 全部 / PC / NPC with counts
- For the selected character: 编辑人物卡 (opens the full sheet editor page — the main action), 管理立绘, 删除 (destructive, in an overflow menu)

## The app shell (keep it, it is global and not part of this redesign)
A left navigation rail, 96px wide, background #12140e, full height. Top: a 40px round logo mark. Then vertical items, each a 24px line icon above a 12px label: 团, 模组, 模组模板, 人物 (active: the icon sits in a pill #374d13 with #d0eda1 icon), 音乐, 黑名单, 审核, 回收站. Bottom: a 40px round avatar "KP" (#374d13 bg, #d0eda1 text) and a logout icon. Use simple inline SVG line icons (lucide style, 1.75px stroke). The page content sits to the right of the rail on #1a1c16 with a 16px top-left radius. On mobile (390px) the rail stays 96px wide (global, cannot change here): design the page for the remaining ~294px and make it work — roster full width, tapping a character shows its detail as a full view with a back control.

## Design tokens you must use (CSS custom properties; this is the product's real dark MD3 palette — do not add new hues)
--surface #12140e; --surface-container-lowest #0d0f09; --surface-container-low #1a1c16; --surface-container #1e2019; --surface-container-high #292b23; --surface-container-highest #33362e; --on-surface #e2e3d8; --on-surface-variant #c5c8b9; --outline #8f9285; --outline-variant #45483d;
--primary #b4d087; --on-primary #223600; --primary-container #374d13; --on-primary-container #d0eda1;
--secondary #56d6f5; --tertiary #bac3ff; --error #ffb4a6; --error-container #900d00; --warning #f0c11c; --success #8ed88b;
Radii available: 4px, 8px, 12px, 16px, 28px, full. Fonts: system stack only — sans: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace. No web fonts. Use font-variant-numeric: tabular-nums for every number.
Type scale (rem): 3.5625 / 2.8125 / 2.25 display; 2 / 1.75 / 1.5 headline; 1.375 / 1 / 0.875 title; 1 / 0.875 / 0.75 body; 0.875 / 0.75 / 0.6875 label.

## Build rules
- One self-contained file: inline CSS and JS, semantic HTML, CSS custom properties for every token, no external requests.
- Real copy in Chinese, short and specific, in a console voice. No lorem ipsum, no invented numbers, no marketing words.
- Design both desktop (1440×900) and mobile (390×844) deliberately. The desktop page must not scroll as a whole: the shell is h-screen; inner regions scroll. Mark each internally scrolling region with the attribute data-scroll.
- Interactive: clicking a roster entry selects it and updates the detail; search and filter work. Hover and visible :focus-visible states on everything clickable. Native buttons and inputs. Respect prefers-reduced-motion.
- Avoid the generic dashboard look: no five identical rounded stat tiles with centered tiny labels, no initial-letter avatar circles, no badge pills on every row, no accent color on every name, no decorative empty space, no gradients, no glows, no glassmorphism, no emoji, not every corner equally rounded. Accent green is for the selected item and the primary action only.
- Make it look great. Commit fully to the direction.
