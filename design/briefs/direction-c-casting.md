# Direction C: 三栏 × 选角目录 (Three-pane casting directory)
Concept: a professional three-pane tool (like a great mail client) whose content is a casting directory — the portrait is the hero of every character, the panes do the organizing.
Emotional target: professional command console; calm, fast, organized; faces first.
Taste anchors: user picked 13 (三栏 × 选角目录) and 2 (邮件客户端三栏). | Avoids: a photo-gallery app look, cards with drop shadows, a SaaS sidebar with tinted icon circles.
Risk level: 3

Layout logic:
- Pane 1 (≈232px, #12140e): the RULE switch at the top as the dominant control — each rule a full-width row with its short name large (CoC 7e / D&D 5e), full name small, and its character count in mono; selected rule marked by the accent left rule. Below it, for the current rule only, a folder-like list with counts: 全部人物, then 类型 (PC, NPC), 归属 (我创建的, 玩家持有), 模组 (each module of this rule, then 未归入模组). Clicking a folder filters; one folder active per group (groups combine). This replaces chips/filters elsewhere.
- Pane 2 (flexible, ≈420–520px): header with the current scope as a title ("CoC 7e · 雾港疑案" etc.), result count, search field, sort, and a view toggle 列表 / 立绘墙. 列表 view: 48px rows — 32×43 portrait thumb (3:4) or monogram frame, name, a second line with modules · owner (muted), right side updated-relative in mono and a PC/NPC marker as plain text (not a pill). 立绘墙 view: a dense grid of 3:4 tiles (≈112px wide) — portrait or a calm monogram tile, name under it. Selected item gets the accent.
- Pane 3 (≈420px, flexible): the inspector. Large 3:4 portrait (≈240px wide) with the expressions as a row of small labeled tabs under it (默认 · 生气 · 惊讶 …, count shown), name at 1.75rem, a line "PC · CoC 7e · 我创建的" or "PC · 玩家持有 · 小鹿", actions (编辑人物卡 outline-accent, 管理立绘 ghost, ⋯ menu with 关联模组/删除). Then 所属模组 as a small list with add/remove, then 人物卡摘要 (rule-provided label/value list in a 2-column definition grid, titled with the rule's full name), then 更新时间.
- Mobile: pane 1 collapses into a top rule switch (segmented, with counts) plus a "筛选" button opening the folder list as a sheet; pane 2 list full width; tapping opens pane 3 as a full view with ← back.

Palette: tokens only. Pane backgrounds step: #12140e (nav pane) / #1a1c16 (list) / #1e2019 (inspector). Hairlines #45483d. Accent #b4d087 for selection + one primary button (新建人物 at the top of pane 2 or pane 1).
Type: system sans throughout; mono for counts, dates and ids. Rule short names in pane 1 at 1.375rem semibold — the one moment of display scale.
Motion: list/grid switch cross-fades 120ms; inspector content slides 8px on selection change; reduced motion: none.
Imagery: the portraits; monogram tiles for the rest (first character of the name, set large and dim in a 3:4 frame with a hairline border — like a contact sheet with an unexposed frame).
Signature moves (visible in the first screenshot):
1. The rule switch as the dominant top of pane 1, with mono counts, and the folder tree beneath it.
2. The 立绘墙 / 列表 toggle with a dense, beautiful 3:4 contact-sheet grid (screenshot the wall view as default on desktop).
3. The inspector where the portrait leads and the rule-provided summary sits as a quiet generic definition list.
Never: rule numbers in the list; pills on rows; card shadows.

Build prompt:
"Build the CoGM GM character library as a three-pane casting directory. Pane 1: rule switch (CoC 7e / D&D 5e with counts) dominating the top, then folder groups with counts (全部, 类型, 归属, 模组 incl. 未归入模组). Pane 2: scope title, search, sort, 列表/立绘墙 toggle; dense 48px rows or a 3:4 contact-sheet grid; monogram frames for missing portraits. Pane 3: portrait-led inspector with expression tabs, generic identity, module links, a rule-provided 人物卡摘要 definition list, and actions; PL characters read-only. 134 characters must feel effortless. Tokens only, one accent, hairlines, no pills or shadows. Make it look great."
