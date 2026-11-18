# D&D fifth-edition compatibility (2024)

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

CoGM adapts SRD data into identifiers, numeric fields, and rules logic for its original virtual tabletop. Catalog names and mechanics are taken from the licensed PDF. The 2024 Basic Rules provide a play reference. [SRD PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) · [SRD publication and FAQ](https://www.dndbeyond.com/srd) · [2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024)

## 快速上手

### 主持人

1. 登录 `/gm`，创建模组时选择 D&D 第五版（2024），再从模组创建团。生成团邀请链接发给玩家，并在审核页 `/gm/reviews` 通过人物提交。
2. 开团后进入 `/gm/session/$sessionId`。用「鉴定」替角色掷骰，或选择目标 PC「发送鉴定请求」，设置难度、优势或劣势及是否暗骰。团设置可控制是否「公开队友人物卡」及观战者能否查看 PC 数值。NPC 可公开哪些状态由主持人分别设置。
3. 在「先攻遭遇」勾选参战者。PC 默认选中，NPC 需手动勾选。开始遭遇后由服务端掷先攻，主持人推进回合并管理伤害、治疗、状态与休整。法术效果、专注和位置由主持人裁定。

### 玩家

1. 登录 `/pl/characters`，新建一张 D&D 第五版（2024）人物卡。打开主持人发来的 `/submit/$token` 链接，选择卡片并提交。审核通过后，从 `/join/$sessionId` 认领角色，进入 `/play/$sessionId`。
2. 在游玩页通过「鉴定」进行属性、技能、豁免或攻击检定，也可以响应主持人的鉴定请求。
3. 升级已有角色时，先在人物库编辑并保存主卡等级。主持人再在团内人物面板选择「同步主卡」，查看预览，勾选规则卡并确认同步。团内等级在确认后更新。

## Catalog coverage

| Content | Included fields |
| --- | --- |
| 12 classes | Hit die, save training, armor and weapon training, spellcasting progression and one SRD subclass name per class |
| 9 species and 4 backgrounds | Walking speed, selected species traits, background ability options, skill and tool proficiencies and origin feat |
| 38 weapons and 12 armor entries | Damage dice and type, grip, mastery and other property names, armor training, AC, Strength and Stealth modifiers. Shield is a separate character field. |
| 339 spells | Spell name, level, school and list membership |
| 13 playable creature presets, CR 0 to CR 5 | Scores, AC, HP, walking speed, initiative, passive Perception, selected saves and skills, damage defenses and basic attacks |
| 326 creature index entries | Name and challenge rating in `dnd5r.CREATURE_INDEX` |
| 81 adventuring gear entries | Name, weight in pounds and price in copper in `dnd5r.ADVENTURING_GEAR`. Variable values are `null`. |
| 17 feats | Name, category, minimum level and prerequisite tag in `dnd5r.FEAT_INDEX` |

The creature presets are ready for basic combat. Run special traits, multiattack, alternate movement, and additional damage or riders at the table. Catalog spell entries support spell preparation notes and slot tracking. The GM adjudicates spell effects, concentration, targeting and areas. Character sheets support a single class and user-supplied options for house rules, including attacks, spell slots, skills, resources, spell names and equipment. Ability scores are the final scores after bonuses. Level is an explicit sheet field for milestone play, with optional XP metadata and reference thresholds.

## Play support

The server resolves D20 Tests, attacks, damage, resistance, immunity, vulnerability, temporary HP, death saves, rests, initiative and turn order. The GM chooses when out-of-turn actions and opportunity attacks apply. The initial encounter order uses server initiative rolls unless the GM supplies results. Positional combat, full class-feature automation and complete condition interactions are table adjudication. The GM decides when a rest takes effect.

Targeted attacks use the target sheet’s AC on the server and omit it from the result. NPC state is private by default with per-character public fields. Check requests and encounter state are stored with session state. Rewind and undo restore encounter state and pending requests.

Removing an NPC from the session also removes it from initiative. When the removed NPC owns the current turn, initiative advances to the next enrolled combatant. Removing the final combatant ends the encounter. Rewind and undo respect the current session roster.

When the GM syncs an updated sheet, current HP stays the same unless it exceeds the new maximum, in which case it drops to that maximum. Remaining Hit Point Dice, spell slots, and tracked resources are recalculated by subtracting prior spends from the new maxima, with a floor of zero. Pact Magic carries spends forward when its slot level increases. New tracked resources start full and removed resources leave the session state.
