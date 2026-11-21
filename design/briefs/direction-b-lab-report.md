# Direction B: 化验单 (Lab Report)
Concept: every character is a hospital laboratory report — results in one column, the "reference range" columns are the Hard and Extreme thresholds, and flags mark what is unusually high or low against the rest of the roster.
Emotional target: a professional command console — clinical, exact, scannable; the GM reads a character like a doctor reads a blood panel.
Taste anchors honored: user picked 化验单 (the idea that "sounds like it won't work"). | Avoids: a literal fake hospital form costume (no hospital logos, no barcodes for decoration, no paper texture, no fake stamps), and the dashboard-tile look.
Risk level: 4

Palette: the product's dark tokens, used like a dark-mode medical system: ground #12140e, report sheet #1e2019, ruled lines #45483d, ink #e2e3d8, muted #c5c8b9 / #8f9285. One accent #b4d087 for selection and the primary action. Result flags: ↑ high in #f0c11c, ↓ low in #56d6f5 — used only as tiny flag glyphs next to values, never as fills.
Type: system sans for labels; mono for every value, range and code; tabular figures. The report reads as a printed form: small-caps-like Latin codes (STR, HP, SAN) next to Chinese item names. Scale: report title 1.5rem; item rows 0.875rem; codes 0.6875rem mono.
Layout logic: table / ledger / document. Left: a "specimen queue" — the roster as a list of report slips: sample number (mono, e.g. PC-01, NPC-03 derived from order), name, occupation·age, and a one-line abnormal-flag summary (e.g. "↑智力 ↑教育 ↓幸运") computed against the roster mean (flag a characteristic ↑ when ≥ mean + 15, ↓ when ≤ mean − 15). Right: the open report: a header block like a report header (检验对象 name, 类别 PC/NPC, 职业, 年龄, 时代, 规则 克苏鲁的呼唤 第7版, 更新时间 from updatedAt), the portrait as the specimen photo in a hairline frame at top right; then section 一般项目 (HP, MP, SAN with "/99", LUCK, MOV, DB, 体格, 重伤阈值) as table rows; then section 属性检验 — columns: 项目 | 代码 | 结果 | 困难(½) | 极难(⅕) | 提示 (flag) | a thin inline range bar 0–99 with the value mark; then section 技能检验 with the same columns for invested skills. Ruled rows, column alignment perfect.
Motion motif: none except a quick row highlight on hover; selection swaps the report instantly (like flipping to the next slip). Reduced motion: same.
Imagery and texture: portraits only, treated as a specimen photo with a mono caption. No paper texture.
Sound: none.
Signature moves (visible in the first screenshot):
1. The 困难(½) / 极难(⅕) columns as "reference ranges" — the CoC thresholds read like lab ranges.
2. ↑/↓ flags against the roster, in the queue and in the report.
3. The report header block and section numbering (一、二、三) that make it read as a document, not a dashboard.
Never: fake barcodes, stamps or hospital branding; paper texture; color fills on rows.

Build prompt:
"Build the CoGM GM character library as a dark-mode laboratory report system. Left: a specimen queue of report slips (sample no., name, occupation·age, ↑/↓ flag summary vs roster mean). Right: the selected character's report — header block (subject, class, occupation, age, era, rule, updated), portrait as a framed specimen photo, then numbered sections 一般项目 / 属性检验 / 技能检验 as perfectly aligned ruled tables with columns 项目 · 代码 · 结果 · 困难(½) · 极难(⅕) · 提示 and a thin 0–99 range bar. Mono tabular numbers, hairline rules, tiny amber ↑ and cyan ↓ flags, one green accent for selection and the primary action. No barcodes, stamps, paper texture or dashboard tiles. Make it look great."
