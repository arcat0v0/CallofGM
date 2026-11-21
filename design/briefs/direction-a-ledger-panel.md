# Direction A: 台账 × 仪表面板 (Ledger × Instrument Panel)
Concept: the roster is a calibrated ledger you can read across, and the selected character opens as a Braun-era instrument panel: every number sits on a scale with its Hard and Extreme marks.
Emotional target: a professional command console — efficient, precise, information-dense.
Taste anchors honored: user picked 台账即控制台 (density, a table as the hero), 乌尔姆仪表面板 (mid-century Braun/Ulm restraint, scales and pointers), 星图对比 (compare characters' shapes). | Avoids: dashboard tiles, rounded-everything, retro costume (no wood grain, no fake knobs, no skeuomorphic chrome).
Risk level: 3

Palette: the product's dark tokens. Ground #1a1c16, panels #12140e and #1e2019, hairline rules #45483d, ink #e2e3d8, secondary ink #c5c8b9, scale ticks #8f9285. One accent: #b4d087 (pointer, selection, primary action). Danger only on delete (#ffb4a6).
Type: system sans for names and labels; mono (ui-monospace) for every number and for tiny scale labels; tabular figures. Scale: character name 1.75rem; big readouts 1.5–2rem mono; ledger 0.875rem; scale labels 0.6875rem mono, uppercase Latin abbreviations allowed (STR, CON…) paired with Chinese.
Layout logic: strict modular grid on an 8px base. Left: the ledger — a real table (one row per character, ~44px) with columns: portrait thumb (28×36, 3:4, or an empty hairline frame), name + occupation·age on two lines, HP, MP, SAN, LUCK, MOV as mono figures, and a 9-tick micro-scale sparkline of the 8 characteristics. Column headers sortable. Right: the instrument panel for the selected character: identity block (portrait 3:4 at ~180px wide, name, occupation · age · era, PC/NPC as a plain text label), then a readout strip (HP / MP / SAN / LUCK / MOV / DB / 体格) as one ruled strip with hairline dividers, big mono numerals left-aligned, label above; then 8+1 characteristics drawn as horizontal 0–99 scales: tick every 10, the value as a solid bar or pointer in accent, the Hard (½) and Extreme (⅕) marks as small notches, numbers "65 · 32 · 13" in mono at the right; then the invested skills as the same scale rows, two columns. Somewhere in the panel: a small "星图" — an octagonal radar of the 8 characteristics for the selected character, with all other characters drawn as faint #45483d outlines behind it, so the GM sees how this character's shape compares to the roster.
Motion motif: mechanical and stepped — on selection the pointers sweep from 0 to value in ~240ms with steps(6), the ledger row highlight snaps (no fade). Reduced motion: no sweep.
Imagery and texture: the portraits are the only images; set them in hairline frames with a mono caption (立绘 · 默认). No textures, no noise.
Sound: none.
Signature moves (visible in the first screenshot):
1. The ledger with mono columns and per-row micro-scales — all eight characters readable without clicking.
2. Characteristics as calibrated 0–99 scales with ½ and ⅕ notches.
3. The 星图 radar with the roster ghosted behind the selected character.
Never: rounded stat cards; color on every name; skeuomorphic knobs/chrome.

Build prompt:
"Build the CoGM GM character library as a ledger × Braun instrument panel. Left: a dense sortable table of every character (portrait thumb, name/occupation·age, HP MP SAN LUCK MOV in mono tabular figures, a micro-scale of the 8 characteristics). Right: the selected character as an instrument panel — 3:4 portrait in a hairline frame, a single ruled readout strip, the 9 characteristics as 0–99 scales with Hard/Extreme notches and 'v · ½ · ⅕' figures, invested skills as the same scales, and a small octagonal radar comparing the character's shape to the ghosted roster. Strict 8px grid, hairline rules, 4px radii max, one green accent for pointer/selection/primary action only. Stepped pointer sweep on select. Avoid dashboard tiles, pills and retro costume. Make it look great."
