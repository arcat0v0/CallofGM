# Direction D: 档案检索台 (Archive search desk)
Concept: the library is a search instrument — one composable query bar on top of a precise, sortable table; you narrow hundreds of characters down to one in a few keystrokes, and a detail drawer opens beside the result.
Emotional target: professional command console; exact, keyboard-fast, nothing wasted.
Taste anchors: user picked 3 (档案检索台). | Avoids: a generic admin data-grid with zebra stripes and checkbox clutter; a filter sidebar full of checkboxes; tag-pill soup.
Risk level: 3

Layout logic:
- Top band (full width): the RULE switch as large tabs on the left — "CoC 7e 82" / "D&D 5e 52" (short name 1.375rem, count in mono), full rule name small beneath the active one; on the right: 导入 (CoC only) and 新建人物 (the one filled button).
- Query bar (full width, 48px): a single field that holds composable filter tokens + free text — tokens like [类型: NPC] [模组: 雾港疑案] [归属: 玩家持有], each removable; typing "/" focuses it; a quiet row of quick-add suggestions under it when focused or empty (类型 · 模组 · 归属 with their options and counts). Result line: "显示 23 / 82" + sort control (最近更新 / 名称) + density toggle (紧凑 / 舒适) on the right.
- Table (flexible): sticky header; columns: portrait thumb (24×32) or monogram, 姓名, 类型 (PC/NPC as plain text), 模组 (comma list, truncated with "+n"), 归属 (我 / 玩家 · 小鹿), 表情 (count, mono), 更新 (relative, mono, right-aligned). Rows 40px compact / 52px comfortable. Sortable headers with a single active indicator. Row hover; selected row accent left rule. Keyboard ↑/↓ moves selection, Enter opens the sheet editor (toast in prototype).
- Detail drawer (≈400px, docked right, part of the layout not an overlay on desktop): portrait 3:4 (≈200px) beside name and identity line; actions; 所属模组 with add/remove; 人物卡摘要 rule-provided definition list; expressions list; 更新时间. Close button collapses it and the table takes the width.
- Batch: selecting multiple rows (shift/ctrl-click or a narrow selection column that appears on hover) shows a slim batch bar above the table: "已选 5 · 关联到模组… · 删除" (PL characters excluded from delete).
- Mobile: rule tabs on top, the query bar full width, the table becomes a compact list (thumb, name, second line 类型 · 模组 · 归属, right side updated); tapping opens the detail as a full view with ← back.

Palette: tokens only; table on #1a1c16, header band #12140e, drawer #1e2019; hairline row rules #45483d; accent #b4d087 for selection, active tokens and the single primary button.
Type: system sans; mono for counts, dates, ids, token keys ("类型:" in mono, value in sans).
Motion: tokens appear with a 100ms scale-in; drawer slides 12px; reduced motion: none.
Signature moves (visible in the first screenshot):
1. The rule tabs with large short names and mono counts.
2. The composable token query bar with live counts ("显示 23 / 82").
3. The razor-sharp table with the docked detail drawer and its rule-provided summary.
Never: rule numbers in the table; checkbox column always visible; pill tags in cells.

Build prompt:
"Build the CoGM GM character library as an archive search desk: large rule tabs with counts, a composable token query bar (类型/模组/归属 + text, '/' to focus) with a live 'x / y' result line, a precise sortable table of generic columns (thumb, 姓名, 类型, 模组, 归属, 表情, 更新) with compact/comfortable density, a docked detail drawer with portrait, actions, module links and a rule-provided 人物卡摘要 list, and multi-select batch actions. 134 characters, read-only PL rows, monogram frames for missing portraits. Tokens only, hairlines, one accent. Make it look great."
