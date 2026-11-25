import { dnd5r } from "@cogm/shared";
import {
	Backpack,
	BookOpen,
	Search,
	Shield,
	Sparkles,
	Swords,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SheetSection } from "@/components/shared/creation-form";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { t } from "@/i18n";
import { formatStamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RuleSheetViewerProps } from "../types";
import { DndSourceCredit } from "./catalog-picker";
import { namedRecordRows } from "./editor-controls";
import {
	ABILITIES,
	abilityLabel,
	backgroundLabel,
	classLabel,
	damageLabel,
	rechargeLabel,
	SKILLS,
	signed,
	skillLabel,
	speciesLabel,
} from "./labels";

export function DndSheetViewer({
	sheet: rawSheet,
	background,
	history,
}: RuleSheetViewerProps) {
	const parsed = dnd5r.CharacterSheet.safeParse(rawSheet);
	const [skillFilter, setSkillFilter] = useState<"proficient" | "all">("all");
	const [skillSearch, setSkillSearch] = useState("");

	const derived = useMemo(
		() => (parsed.success ? dnd5r.deriveCharacter(parsed.data) : null),
		[parsed],
	);

	if (!parsed.success || !derived) {
		return (
			<p className="text-foreground-tertiary text-body-medium">
				{t("sheet.empty")}
			</p>
		);
	}

	const sheet = parsed.data;
	const saveProfSet = new Set(derived.saveProficiencies);
	const skillProfSet = new Set(derived.skillProficiencies);
	const expertiseSet = new Set(sheet.expertise);
	const armorEntry = sheet.armorId ? dnd5r.ARMORS[sheet.armorId] : null;
	const activeSpellSlots = derived.spellSlots
		.map((count, index) => ({ level: index + 1, count }))
		.filter((slot) => slot.count > 0);
	const hasSpellsOrResources =
		derived.spellcastingAbility !== null ||
		activeSpellSlots.length > 0 ||
		sheet.spellIds.length > 0 ||
		sheet.customSpells.length > 0 ||
		derived.resources.length > 0;
	const auditRows = history?.audits ?? [];

	const visibleSkills = SKILLS.filter((skill) => {
		if (skillFilter === "proficient" && !skillProfSet.has(skill)) {
			return false;
		}
		const keyword = skillSearch.trim().toLocaleLowerCase();
		if (!keyword) return true;
		return `${skillLabel(skill)} ${skill}`
			.toLocaleLowerCase()
			.includes(keyword);
	});

	return (
		<div className="flex flex-col gap-5">
			<SheetSection
				title="核心概念与衍生数值"
				description="展示职业、起源、战斗基础数值与伤害抗性。"
			>
				<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
					{[
						{ label: "最大 HP", value: String(derived.maxHp) },
						{ label: "护甲等级 AC", value: String(derived.armorClass) },
						{
							label: t("dnd5r.derived.proficiency"),
							value: signed(derived.proficiencyBonus),
						},
						{
							label: t("dnd5r.derived.initiative"),
							value: signed(derived.initiative),
						},
						{
							label: t("dnd5r.derived.speed"),
							value: `${derived.speed} ft`,
						},
						{
							label: t("dnd5r.derived.passivePerception"),
							value: String(derived.passivePerception),
						},
						{
							label: t("dnd5r.state.hitDice"),
							value: `${derived.maxHitDice}d${derived.hitDie}`,
						},
					].map((stat) => (
						<div
							key={stat.label}
							className="flex flex-col gap-1 rounded-2xl bg-md-surface-container px-3.5 py-2.5"
						>
							<span className="text-foreground-secondary text-label-small">
								{stat.label}
							</span>
							<span className="text-foreground text-title-medium-emph tabular-nums select-text">
								{stat.value}
							</span>
						</div>
					))}
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[
						{
							label: t("dnd5r.concept.class"),
							value: `${classLabel(sheet)} · Lv.${sheet.level}`,
						},
						{
							label: "子职业",
							value: sheet.subclass || "未填写",
						},
						{
							label: t("dnd5r.concept.species"),
							value: speciesLabel(sheet),
						},
						{
							label: t("dnd5r.concept.background"),
							value: backgroundLabel(sheet),
						},
						...(sheet.experiencePoints !== undefined
							? [
									{
										label: "经验值 XP",
										value: sheet.experiencePoints.toLocaleString("zh-CN"),
									},
								]
							: []),
					].map((item) => (
						<div
							key={item.label}
							className="flex flex-col gap-0.5 rounded-xl bg-md-surface-container px-3.5 py-2.5"
						>
							<span className="text-foreground-tertiary text-label-small">
								{item.label}
							</span>
							<span className="text-foreground text-body-medium select-text">
								{item.value}
							</span>
						</div>
					))}
				</div>

				{derived.resistances.length > 0 ||
				derived.immunities.length > 0 ||
				derived.vulnerabilities.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{derived.resistances.map((type) => (
							<Badge
								key={`res-${type}`}
								variant="soft"
								tone="default"
								size="sm"
							>
								抗性：{damageLabel(type)}
							</Badge>
						))}
						{derived.immunities.map((type) => (
							<Badge key={`imm-${type}`} variant="soft" tone="accent" size="sm">
								免疫：{damageLabel(type)}
							</Badge>
						))}
						{derived.vulnerabilities.map((type) => (
							<Badge key={`vul-${type}`} variant="soft" tone="danger" size="sm">
								易伤：{damageLabel(type)}
							</Badge>
						))}
					</div>
				) : null}
			</SheetSection>

			<SheetSection
				title="六项属性与豁免检定"
				description="展示最终属性值、调整值及各属性豁免熟练状态。"
			>
				<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
					{ABILITIES.map((ability) => {
						const proficient = saveProfSet.has(ability);
						return (
							<div
								key={ability}
								className="flex flex-col gap-2 rounded-2xl bg-md-surface-container px-3.5 py-3"
							>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-foreground text-label-large-emph">
										{abilityLabel(ability)}
									</span>
									<span className="text-foreground-tertiary font-mono text-label-small uppercase">
										{ability}
									</span>
								</div>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-foreground font-serif text-headline-small-emph tabular-nums select-text">
										{derived.abilities[ability]}
									</span>
									<span className="text-foreground-secondary font-mono text-title-small-emph tabular-nums select-text">
										{signed(derived.abilityModifiers[ability])}
									</span>
								</div>
								<div className="border-md-outline-variant/30 flex items-center justify-between border-t pt-1.5 text-label-small">
									<span
										className={cn(
											proficient
												? "text-accent font-medium"
												: "text-foreground-tertiary",
										)}
									>
										{proficient ? "豁免 · 熟练" : "豁免"}
									</span>
									<span className="text-foreground font-mono tabular-nums select-text">
										{signed(derived.savingThrows[ability])}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</SheetSection>

			<SheetSection title="技能（18 项）">
				<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
					<SegmentedControl
						aria-label="技能筛选"
						value={skillFilter}
						onValueChange={(value) =>
							setSkillFilter(value === "proficient" ? "proficient" : "all")
						}
						options={[
							{ value: "all", label: `全部技能 (${SKILLS.length})` },
							{
								value: "proficient",
								label: `熟练 / 专精 (${skillProfSet.size})`,
							},
						]}
					/>
					<InputGroup className="h-9 sm:w-64">
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
						<InputGroupInput
							value={skillSearch}
							aria-label={t("sheet.searchSkills")}
							placeholder={t("sheet.searchSkills")}
							onChange={(event) => setSkillSearch(event.target.value)}
						/>
					</InputGroup>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{visibleSkills.map((skill) => {
						const proficient = skillProfSet.has(skill);
						const expert = expertiseSet.has(skill);
						const ability = dnd5r.SKILLS[skill];
						return (
							<div
								key={skill}
								className={cn(
									"flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5",
									proficient
										? "bg-md-surface-container-high/80"
										: "bg-md-surface-container",
								)}
							>
								<div className="flex min-w-0 items-center gap-1.5">
									<span className="text-foreground truncate text-body-medium-emph select-text">
										{skillLabel(skill)}
									</span>
									<span className="text-foreground-tertiary font-mono text-label-small uppercase">
										{ability}
									</span>
									{expert ? (
										<Badge variant="soft" tone="accent" size="sm">
											专精
										</Badge>
									) : proficient ? (
										<Badge variant="soft" tone="default" size="sm">
											熟练
										</Badge>
									) : null}
								</div>
								<span className="text-foreground font-mono text-title-small-emph tabular-nums select-text">
									{signed(derived.skillModifiers[skill])}
								</span>
							</div>
						);
					})}
				</div>
			</SheetSection>

			<SheetSection title="武器攻击与装备">
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Swords className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">
								{t("dnd5r.review.attacks")}（{derived.attacks.length}）
							</h3>
						</div>
						{derived.attacks.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">
								暂无武器攻击
							</p>
						) : (
							derived.attacks.map((attack) => (
								<div
									key={attack.id}
									className="flex items-center justify-between gap-3 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
								>
									<div className="flex min-w-0 flex-col">
										<span className="text-foreground truncate text-label-large-emph select-text">
											{attack.name}
										</span>
										<span className="text-foreground-secondary text-body-small select-text">
											{attack.damage.count}d{attack.damage.sides}
											{signed(attack.damageBonus)}{" "}
											{damageLabel(attack.damage.type)}
										</span>
									</div>
									<Badge variant="soft" tone="accent" size="sm">
										命中 {signed(attack.attackBonus)}
									</Badge>
								</div>
							))
						)}
					</div>

					<div className="flex flex-col gap-3 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Shield className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">
								护甲与物品栏
							</h3>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="soft" tone="default" size="sm">
								护甲：{armorEntry ? armorEntry.name : "无护甲"}
							</Badge>
							<Badge variant="soft" tone="default" size="sm">
								盾牌：{sheet.shield ? "已装备（+2 AC）" : "未装备"}
							</Badge>
							{derived.stealthDisadvantage ? (
								<Badge variant="soft" tone="warning" size="sm">
									隐匿劣势
								</Badge>
							) : null}
						</div>
						<div className="flex items-center gap-2 pt-1">
							<Backpack className="text-foreground-secondary size-4" />
							<span className="text-foreground-secondary text-label-medium">
								物品栏（{sheet.inventory.length}）
							</span>
						</div>
						{sheet.inventory.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">
								暂无物品
							</p>
						) : (
							<div className="grid gap-1.5 sm:grid-cols-2">
								{namedRecordRows(sheet.inventory).map(({ item, key }) => (
									<div
										key={key}
										className="flex items-center justify-between gap-2 rounded-xl bg-md-surface-container-high/60 px-3 py-2 text-body-small"
									>
										<span className="text-foreground truncate select-text">
											{item.name}
										</span>
										<span className="text-foreground-secondary shrink-0 tabular-nums">
											× {item.quantity}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</SheetSection>

			{hasSpellsOrResources ? (
				<SheetSection title="施法、法术位与资源">
					{derived.spellcastingAbility ? (
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="soft" tone="accent" size="sm">
								施法属性：{abilityLabel(derived.spellcastingAbility)}
							</Badge>
							{derived.spellSaveDc !== null ? (
								<Badge variant="soft" tone="default" size="sm">
									法术豁免 DC：{derived.spellSaveDc}
								</Badge>
							) : null}
							{derived.spellAttackBonus !== null ? (
								<Badge variant="soft" tone="default" size="sm">
									法术攻击：{signed(derived.spellAttackBonus)}
								</Badge>
							) : null}
							{activeSpellSlots.map((slot) => (
								<Badge key={slot.level} variant="soft" tone="default" size="sm">
									{slot.level} 环位 × {slot.count}
								</Badge>
							))}
						</div>
					) : null}

					{sheet.spellIds.length + sheet.customSpells.length > 0 ? (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Sparkles className="text-foreground-secondary size-4" />
								<h3 className="text-foreground text-title-small-emph">
									{t("dnd5r.spells.title")}（
									{sheet.spellIds.length + sheet.customSpells.length}）
								</h3>
							</div>
							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{sheet.spellIds.map((id) => (
									<div
										key={id}
										className="rounded-xl bg-md-surface-container px-3.5 py-2.5"
									>
										<p className="text-foreground text-label-large-emph select-text">
											{dnd5r.SPELLS[id]?.name ?? id}
										</p>
										<p className="text-foreground-secondary text-body-small">
											{t("dnd5r.spells.level", {
												level: dnd5r.SPELLS[id]?.level ?? 0,
											})}
											{dnd5r.SPELLS[id]?.school
												? ` · ${dnd5r.SPELLS[id]?.school}`
												: ""}
										</p>
									</div>
								))}
								{namedRecordRows(sheet.customSpells).map(
									({ item: spell, key }) => (
										<div
											key={key}
											className="rounded-xl bg-md-surface-container px-3.5 py-2.5"
										>
											<p className="text-foreground text-label-large-emph select-text">
												{spell.name}
											</p>
											<p className="text-foreground-secondary text-body-small">
												{t("dnd5r.spells.level", { level: spell.level })} ·
												自定义
											</p>
										</div>
									),
								)}
							</div>
						</div>
					) : null}

					{derived.resources.length > 0 ? (
						<div className="flex flex-col gap-2">
							<h3 className="text-foreground text-title-small-emph">
								职业与自定义资源（{derived.resources.length}）
							</h3>
							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{derived.resources.map((resource) => (
									<div
										key={resource.id}
										className="flex items-center justify-between gap-2 rounded-xl bg-md-surface-container px-3.5 py-2.5"
									>
										<span className="text-foreground text-body-medium-emph select-text">
											{resource.name}
										</span>
										<span className="text-foreground-secondary text-label-small tabular-nums">
											上限 {resource.max} · {rechargeLabel(resource.recharge)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}
				</SheetSection>
			) : null}

			<SheetSection title="专长、语言与背景笔记">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
						<span className="text-foreground text-title-small-emph">
							{t("dnd5r.proficiencies.feats")}（{sheet.feats.length}）
						</span>
						{sheet.feats.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">无</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{sheet.feats.map((feat) => (
									<Badge key={feat} variant="soft" tone="default" size="sm">
										{feat}
									</Badge>
								))}
							</div>
						)}
					</div>
					<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
						<span className="text-foreground text-title-small-emph">
							语言（{sheet.languages.length}）
						</span>
						{sheet.languages.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">无</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{sheet.languages.map((language) => (
									<Badge key={language} variant="soft" tone="default" size="sm">
										{language}
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>

				{background.trim() ? (
					<div className="flex flex-col gap-1.5 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<BookOpen className="text-foreground-secondary size-4" />
							<span className="text-foreground text-title-small-emph">
								角色背景
							</span>
						</div>
						<p className="text-foreground-secondary whitespace-pre-wrap text-body-medium select-text">
							{background}
						</p>
					</div>
				) : null}

				{sheet.notes.trim() ? (
					<div className="flex flex-col gap-1.5 rounded-2xl bg-md-surface-container p-4">
						<span className="text-foreground text-title-small-emph">
							{t("dnd5r.details.notesTitle")}
						</span>
						<p className="text-foreground-secondary whitespace-pre-wrap text-body-medium select-text">
							{sheet.notes}
						</p>
					</div>
				) : null}

				{auditRows.length > 0 ? (
					<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
						<h3 className="text-foreground text-title-small-emph">
							永久修正审计（{auditRows.length}）
						</h3>
						{auditRows.map((audit) => (
							<div
								key={audit.id}
								className="flex flex-col gap-0.5 rounded-xl bg-md-surface-container-high/60 px-3 py-2 text-body-small"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-foreground font-medium">
										{abilityLabel(audit.field.replace("abilities.", ""))}：
										{audit.oldValue} → {audit.newValue}
									</span>
									<span className="text-foreground-tertiary text-label-small tabular-nums">
										{formatStamp(audit.createdAt)}
									</span>
								</div>
								{audit.reason ? (
									<p className="text-foreground-secondary text-label-small">
										原因：{audit.reason}
									</p>
								) : null}
							</div>
						))}
					</div>
				) : null}

				<DndSourceCredit />
			</SheetSection>
		</div>
	);
}
