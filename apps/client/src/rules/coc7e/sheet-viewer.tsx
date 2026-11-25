import { coc7e } from "@cogm/shared";
import {
	Backpack,
	BookOpen,
	Coins,
	History,
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
import { Coc7eBackgroundSummaryView } from "./background-summary";
import { cocAttributeEntries, deriveStats, parseCocSheet } from "./sheet-data";

const ASSET_CATEGORY_LABELS: Record<
	coc7e.Coc7eAssetDetail["category"],
	string
> = {
	transport: "交通工具",
	residence: "房产住所",
	luxury: "贵重收藏",
	securities: "证券存款",
	other: "其他资产",
};

const EXPERIENCE_SOURCE_LABELS: Record<
	coc7e.Coc7eExperienceEntry["sourceType"],
	string
> = {
	manual: "手动记录",
	record: "卡面记录",
	session_phase: "团阶段记录",
};

type SkillRow = {
	key: string;
	label: string;
	base: number;
	value: number;
	occupationSpent: number;
	interestSpent: number;
	experienceSpent: number;
	isOccupation: boolean;
	isCustom: boolean;
	invested: boolean;
};

function formatMoney(currency: string, amount: number): string {
	const formatted = Number.isInteger(amount)
		? amount.toLocaleString("zh-CN")
		: amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
	return `${currency}${formatted}`;
}

function keyedItems<T>(
	items: readonly T[],
	baseKey: (item: T) => string,
): Array<{ item: T; key: string }> {
	const counts = new Map<string, number>();
	return items.map((item) => {
		const raw = baseKey(item);
		const seen = (counts.get(raw) ?? 0) + 1;
		counts.set(raw, seen);
		return { item, key: seen === 1 ? raw : `${raw}#${seen}` };
	});
}

export function Coc7eSheetViewer({
	sheet: rawSheet,
	background,
	sheetContext,
	history,
}: RuleSheetViewerProps) {
	const sheet = parseCocSheet(rawSheet);
	const [skillFilter, setSkillFilter] = useState<"invested" | "all">(
		"invested",
	);
	const [skillSearch, setSkillSearch] = useState("");

	const derived = useMemo(() => (sheet ? deriveStats(sheet) : null), [sheet]);
	const ledger = useMemo(
		() => (sheet ? coc7e.deriveCoc7eSplitLedger(sheet) : null),
		[sheet],
	);

	const allSkills = useMemo<SkillRow[]>(() => {
		if (!sheet) return [];
		const seen = new Set<string>();
		const keys: string[] = [];
		const pushKey = (raw: string) => {
			const key = coc7e.canonicalizeCoc7eSkillKey(raw) ?? raw;
			if (!key || seen.has(key)) return;
			seen.add(key);
			keys.push(key);
		};
		for (const entry of coc7e.COC7E_SKILL_CATALOG) {
			if (entry.modernOnly && sheet.era !== "modern") continue;
			pushKey(entry.key);
		}
		for (const key of Object.keys(sheet.customSkills)) {
			pushKey(key);
		}
		for (const key of Object.keys(sheet.skills)) {
			pushKey(key);
		}
		const standardKeys = new Set(
			coc7e.COC7E_SKILL_CATALOG.map((entry) => entry.key),
		);
		return keys
			.map((key) => {
				const base = coc7e.coc7eSkillBaseValue(sheet, key) ?? 0;
				const value = coc7e.coc7eSkillTargetValue(sheet, key) ?? base;
				const alloc = coc7e.coc7eSkillAllocationForEntry(sheet, key);
				const isCustom = !standardKeys.has(key);
				const isOccupation = coc7e.coc7eIsOccupationalSkill(
					sheet.occupation,
					key,
				);
				const invested =
					value !== base ||
					alloc.occupation > 0 ||
					alloc.interest > 0 ||
					alloc.experience > 0 ||
					isCustom ||
					(key === "信用评级" && value > 0) ||
					(key === "克苏鲁神话" && value > 0);
				return {
					key,
					label: coc7e.coc7eSkillLabel(key),
					base,
					value,
					occupationSpent: alloc.occupation,
					interestSpent: alloc.interest,
					experienceSpent: alloc.experience,
					isOccupation,
					isCustom,
					invested,
				};
			})
			.sort((a, b) => {
				if (a.invested !== b.invested) return a.invested ? -1 : 1;
				if (b.value !== a.value) return b.value - a.value;
				return a.label.localeCompare(b.label, "zh-Hans-CN");
			});
	}, [sheet]);

	const investedCount = useMemo(
		() => allSkills.filter((item) => item.invested).length,
		[allSkills],
	);

	const effectiveFilter =
		skillFilter === "invested" && investedCount === 0 ? "all" : skillFilter;

	const visibleSkills = useMemo(() => {
		const keyword = skillSearch.trim().toLowerCase();
		return allSkills.filter((skill) => {
			if (effectiveFilter === "invested" && !skill.invested) {
				return false;
			}
			if (!keyword) return true;
			return (
				skill.key.toLowerCase().includes(keyword) ||
				skill.label.toLowerCase().includes(keyword)
			);
		});
	}, [allSkills, effectiveFilter, skillSearch]);

	if (!sheet || !derived || !ledger) {
		return (
			<p className="text-foreground-tertiary text-body-medium">
				{t("sheet.empty")}
			</p>
		);
	}

	const eraLabel = sheet.era === "modern" ? "现代" : "1920 年代";
	const creditRating = coc7e.coc7eSkillTargetValue(sheet, "信用评级") ?? 0;
	const occupationSkills = Array.from(
		new Set([
			...sheet.occupation.skillKeys,
			...Object.values(sheet.occupation.choiceSelections).flat(),
			...sheet.occupation.freeSkillKeys,
		]),
	);

	const detailedBackground = coc7e
		.stripSerializedCoc7eBackground(background)
		.trim();
	const growthRows =
		history && history.growth.length > 0
			? history.growth
			: (sheetContext?.growthRecords ?? []);
	const auditRows = history?.audits ?? [];
	const hasOccultOrExperience =
		sheet.spells.length > 0 ||
		sheet.mythosTomes.length > 0 ||
		sheet.encounters.length > 0 ||
		sheet.experiences.length > 0;

	return (
		<div className="flex flex-col gap-5">
			<SheetSection
				title="基础资料与衍生数值"
				description="完整展示调查员身份设定、职业信息与由规则推导的核心数值。"
			>
				<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
					{[
						{ label: "HP 上限", value: String(derived.hp.max) },
						{ label: "MP 上限", value: String(derived.mp.max) },
						{
							label: "理智 SAN",
							value: `${derived.san.current}/${derived.san.max}`,
						},
						{ label: "幸运", value: String(derived.luck) },
						{ label: "移动力 MOV", value: String(derived.mov) },
						{ label: "伤害加值 DB", value: String(derived.damageBonus ?? "0") },
						{ label: "体格 Build", value: String(derived.build ?? 0) },
						{ label: "重伤阈值", value: String(derived.majorWound ?? "—") },
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
						{ label: "时代", value: eraLabel },
						{
							label: "年龄",
							value: sheet.age === null ? "未填写" : `${sheet.age} 岁`,
						},
						{ label: "性别", value: sheet.profile.gender || "未填写" },
						{
							label: "职业",
							value: sheet.occupation.name || "未填写",
						},
						{ label: "住地", value: sheet.profile.residence || "未填写" },
						{ label: "故乡", value: sheet.profile.birthplace || "未填写" },
						{
							label: "信用评级范围",
							value: `${sheet.occupation.creditMin} – ${sheet.occupation.creditMax}（当前 ${creditRating}）`,
						},
						{
							label: "调查员经历包",
							value: sheet.profile.storiedInvestigator
								? `已启用（+${sheet.profile.experienceBonusPoints} 点）`
								: "标准调查员",
						},
					].map((item) => (
						<div
							key={item.label}
							className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-md-surface-container px-3.5 py-2.5"
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

				{occupationSkills.length > 0 ? (
					<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container px-4 py-3">
						<span className="text-foreground-secondary text-label-medium">
							本职技能清单（{occupationSkills.length}）
						</span>
						<div className="flex flex-wrap gap-1.5">
							{occupationSkills.map((skillKey) => (
								<Badge key={skillKey} variant="soft" tone="default" size="sm">
									{coc7e.coc7eSkillLabel(skillKey)}
								</Badge>
							))}
						</div>
					</div>
				) : null}
			</SheetSection>

			<SheetSection
				title="九项属性"
				description="括号内依次为常规 / 困难（1/2）/ 极难（1/5）成功阈值。"
			>
				<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
					{cocAttributeEntries(sheet).map(({ key, label, value }) => {
						const abbr =
							coc7e.COC7E_ATTRIBUTE_LABELS[key]?.abbr ?? key.toUpperCase();
						return (
							<div
								key={key}
								className="flex flex-col gap-2 rounded-2xl bg-md-surface-container px-4 py-3"
							>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-foreground text-label-large-emph">
										{label}
									</span>
									<span className="text-foreground-tertiary font-mono text-label-small">
										{abbr}
									</span>
								</div>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-foreground font-serif text-headline-small-emph tabular-nums select-text">
										{value}
									</span>
									<span className="text-foreground-secondary font-mono text-label-small tabular-nums select-text">
										{Math.floor(value / 2)} / {Math.floor(value / 5)}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</SheetSection>

			<SheetSection
				title="技能清单与点数分配"
				description="默认展示已加点与重点技能，可切换查看全部基础技能或按名称检索。"
			>
				<div className="flex flex-wrap items-center gap-2">
					<Badge
						variant="soft"
						tone={ledger.occupation.remaining < 0 ? "danger" : "accent"}
						size="sm"
					>
						职业点数：{ledger.occupation.spent} / {ledger.occupation.budget}
					</Badge>
					<Badge
						variant="soft"
						tone={ledger.interest.remaining < 0 ? "danger" : "default"}
						size="sm"
					>
						兴趣点数：{ledger.interest.spent} / {ledger.interest.budget}
					</Badge>
					{sheet.profile.storiedInvestigator ? (
						<Badge
							variant="soft"
							tone={ledger.experience.remaining < 0 ? "danger" : "default"}
							size="sm"
						>
							经历点数：{ledger.experience.spent} / {ledger.experience.budget}
						</Badge>
					) : null}
					{ledger.excludedPoints > 0 ? (
						<Badge variant="soft" tone="default" size="sm">
							神话技能投入：{ledger.excludedPoints}
						</Badge>
					) : null}
				</div>

				<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
					<SegmentedControl
						aria-label="技能筛选"
						value={effectiveFilter}
						onValueChange={(value) =>
							setSkillFilter(value === "all" ? "all" : "invested")
						}
						options={[
							{
								value: "invested",
								label: `已加点 / 重点 (${investedCount})`,
							},
							{
								value: "all",
								label: `全部技能 (${allSkills.length})`,
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

				{visibleSkills.length === 0 ? (
					<p className="text-foreground-tertiary text-body-medium">
						没有匹配的技能。
					</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{visibleSkills.map((skill) => {
							const breakdown: string[] = [];
							if (skill.occupationSpent > 0) {
								breakdown.push(`职+${skill.occupationSpent}`);
							}
							if (skill.interestSpent > 0) {
								breakdown.push(`兴+${skill.interestSpent}`);
							}
							if (skill.experienceSpent > 0) {
								breakdown.push(`经+${skill.experienceSpent}`);
							}
							return (
								<div
									key={skill.key}
									className={cn(
										"flex flex-col gap-1 rounded-2xl px-3.5 py-2.5",
										skill.invested
											? "bg-md-surface-container-high/80"
											: "bg-md-surface-container",
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex min-w-0 items-center gap-1.5">
											<span className="text-foreground truncate text-body-medium-emph select-text">
												{skill.label}
											</span>
											{skill.isOccupation ? (
												<Badge variant="soft" tone="accent" size="sm">
													本职
												</Badge>
											) : null}
											{skill.isCustom ? (
												<Badge variant="soft" tone="default" size="sm">
													自定义
												</Badge>
											) : null}
										</div>
										<div className="flex shrink-0 items-baseline gap-1.5 font-mono tabular-nums select-text">
											<span className="text-foreground text-title-medium-emph">
												{skill.value}
											</span>
											<span className="text-foreground-tertiary text-label-small">
												{Math.floor(skill.value / 2)}/
												{Math.floor(skill.value / 5)}
											</span>
										</div>
									</div>
									<div className="text-foreground-tertiary flex items-center justify-between gap-2 text-label-small tabular-nums">
										<span>基础 {skill.base}</span>
										{breakdown.length > 0 ? (
											<span className="truncate">{breakdown.join(" · ")}</span>
										) : skill.value !== skill.base ? (
											<span>
												{skill.value > skill.base
													? `+${skill.value - skill.base}`
													: String(skill.value - skill.base)}
											</span>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</SheetSection>

			<SheetSection
				title="战斗、装备与资产"
				description="查看全部武器、护甲、背包物品与信用资产明细。"
			>
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="flex flex-col gap-2.5 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Swords className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">
								武器（{sheet.weapons.length}）
							</h3>
						</div>
						{sheet.weapons.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">
								未登记武器
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{keyedItems(
									sheet.weapons,
									(weapon) =>
										`${weapon.name}|${weapon.skillKey}|${weapon.damage}`,
								).map(({ item: weapon, key }) => {
									const skillVal = coc7e.coc7eSkillTargetValue(
										sheet,
										weapon.skillKey,
									);
									const meta = [
										weapon.range ? `射程 ${weapon.range}` : "",
										weapon.attacks ? `每轮 ${weapon.attacks} 次` : "",
										weapon.ammo === null ? "" : `装弹 ${weapon.ammo}`,
										weapon.malfunction === null
											? ""
											: `故障 ${weapon.malfunction}`,
									].filter(Boolean);
									return (
										<div
											key={key}
											className="flex flex-col gap-1 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
										>
											<div className="flex flex-wrap items-center justify-between gap-2">
												<span className="text-foreground text-label-large-emph select-text">
													{weapon.name}
												</span>
												<div className="flex flex-wrap items-center gap-1.5">
													<Badge variant="soft" tone="accent" size="sm">
														{weapon.damage}
														{weapon.applyDamageBonus ? " + DB" : ""}
													</Badge>
													{weapon.impale ? (
														<Badge variant="soft" tone="default" size="sm">
															贯穿
														</Badge>
													) : null}
												</div>
											</div>
											<p className="text-foreground-secondary text-body-small select-text">
												使用技能：{coc7e.coc7eSkillLabel(weapon.skillKey)}
												{skillVal !== null ? `（${skillVal}）` : ""}
												{meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
											</p>
										</div>
									);
								})}
							</div>
						)}
					</div>

					<div className="flex flex-col gap-2.5 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Shield className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">护甲</h3>
						</div>
						{sheet.armor.name || sheet.armor.value > 0 ? (
							<div className="grid grid-cols-2 gap-2.5 text-body-small">
								<div className="rounded-xl bg-md-surface-container-high/60 px-3 py-2">
									<span className="text-foreground-tertiary text-label-small">
										名称
									</span>
									<p className="text-foreground text-body-medium select-text">
										{sheet.armor.name || "未命名护甲"}
									</p>
								</div>
								<div className="rounded-xl bg-md-surface-container-high/60 px-3 py-2">
									<span className="text-foreground-tertiary text-label-small">
										护甲值
									</span>
									<p className="text-foreground text-body-medium tabular-nums select-text">
										{sheet.armor.value}
									</p>
								</div>
								<div className="rounded-xl bg-md-surface-container-high/60 px-3 py-2">
									<span className="text-foreground-tertiary text-label-small">
										覆盖部位
									</span>
									<p className="text-foreground text-body-medium select-text">
										{sheet.armor.locations || "—"}
									</p>
								</div>
								<div className="rounded-xl bg-md-surface-container-high/60 px-3 py-2">
									<span className="text-foreground-tertiary text-label-small">
										敏捷/动作惩罚
									</span>
									<p className="text-foreground text-body-medium tabular-nums select-text">
										{sheet.armor.penalty}
									</p>
								</div>
							</div>
						) : (
							<p className="text-foreground-tertiary text-body-small">
								未穿戴护甲
							</p>
						)}
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<div className="flex flex-col gap-2.5 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Backpack className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">
								随身装备与背包（{sheet.gear.length}）
							</h3>
						</div>
						{sheet.gear.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small">
								暂无装备物品
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{keyedItems(
									sheet.gear,
									(item) =>
										`${item.name}|${item.slot ?? "none"}|${item.status ?? "in_use"}`,
								).map(({ item, key }) => (
									<div
										key={key}
										className="flex flex-col gap-1 rounded-xl bg-md-surface-container-high/60 px-3 py-2"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="text-foreground text-body-medium-emph select-text">
												{item.name}
											</span>
											<div className="flex flex-wrap items-center gap-1.5">
												<Badge variant="soft" tone="default" size="sm">
													× {item.quantity}
												</Badge>
												{item.slot && item.slot !== "none" ? (
													<Badge variant="soft" tone="default" size="sm">
														{t(`characterCreation.slot.${item.slot}`)}
													</Badge>
												) : null}
												{item.status && item.status !== "in_use" ? (
													<Badge variant="soft" tone="warning" size="sm">
														{t(`characterCreation.gearStatus.${item.status}`)}
													</Badge>
												) : null}
												{item.linkedPossession ? (
													<Badge variant="soft" tone="accent" size="sm">
														宝贵之物
													</Badge>
												) : null}
											</div>
										</div>
										{item.note ? (
											<p className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text">
												{item.note}
											</p>
										) : null}
									</div>
								))}
							</div>
						)}
					</div>

					<div className="flex flex-col gap-2.5 rounded-2xl bg-md-surface-container p-4">
						<div className="flex items-center gap-2">
							<Coins className="text-foreground-secondary size-4" />
							<h3 className="text-foreground text-title-small-emph">
								信用与资产
							</h3>
						</div>
						<div className="grid grid-cols-2 gap-2">
							{[
								{ label: "信用评级", value: String(creditRating) },
								{
									label: "消费水平",
									value: formatMoney(
										sheet.assets.currency,
										sheet.assets.spendingLevel,
									),
								},
								{
									label: "现金",
									value: formatMoney(sheet.assets.currency, sheet.assets.cash),
								},
								{
									label: "其他资产",
									value: formatMoney(
										sheet.assets.currency,
										sheet.assets.otherAssets,
									),
								},
							].map((row) => (
								<div
									key={row.label}
									className="rounded-xl bg-md-surface-container-high/60 px-3 py-2"
								>
									<span className="text-foreground-tertiary text-label-small">
										{row.label}
									</span>
									<p className="text-foreground text-body-medium tabular-nums select-text">
										{row.value}
									</p>
								</div>
							))}
						</div>
						{sheet.assets.details.length > 0 ? (
							<div className="flex flex-col gap-1.5 pt-1">
								{keyedItems(
									sheet.assets.details,
									(detail) =>
										`${detail.category}|${detail.name}|${detail.value}`,
								).map(({ item: detail, key }) => (
									<div
										key={key}
										className="flex items-center justify-between gap-2 rounded-xl bg-md-surface-container-high/60 px-3 py-2 text-body-small"
									>
										<div className="flex min-w-0 items-center gap-2">
											<Badge variant="soft" tone="default" size="sm">
												{ASSET_CATEGORY_LABELS[detail.category]}
											</Badge>
											<span className="text-foreground truncate select-text">
												{detail.name}
											</span>
										</div>
										<span className="text-foreground shrink-0 tabular-nums select-text">
											{formatMoney(sheet.assets.currency, detail.value)}
										</span>
									</div>
								))}
							</div>
						) : null}
					</div>
				</div>
			</SheetSection>

			<SheetSection
				title="背景故事与重要关系"
				description="展示调查员八项结构化背景、关键链接、同伴关系与独立书写的详细背景描述。"
			>
				<Coc7eBackgroundSummaryView
					sheet={sheet}
					includeIdentity={false}
					showEmptyFields
				/>
				<div className="flex flex-col gap-1.5 rounded-2xl bg-md-surface-container p-4">
					<span className="text-foreground text-title-small-emph">
						{t("characterProfile.detailedBackground")}
					</span>
					<p
						className={cn(
							"whitespace-pre-wrap text-body-medium select-text",
							detailedBackground
								? "text-foreground-secondary"
								: "text-foreground-tertiary",
						)}
					>
						{detailedBackground ||
							t("characterProfile.detailedBackgroundEmpty")}
					</p>
				</div>
			</SheetSection>

			{hasOccultOrExperience ? (
				<SheetSection
					title="法术、神话典籍、遭遇与经历"
					description="调查员记录的神秘学知识、第三类接触与历次冒险经历。"
				>
					<div className="grid gap-4 lg:grid-cols-2">
						{sheet.spells.length > 0 ? (
							<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
								<div className="flex items-center gap-2">
									<Sparkles className="text-foreground-secondary size-4" />
									<h3 className="text-foreground text-title-small-emph">
										法术（{sheet.spells.length}）
									</h3>
								</div>
								{keyedItems(
									sheet.spells,
									(spell) => `${spell.name}|${spell.mpCost}|${spell.sanCost}`,
								).map(({ item: spell, key }) => (
									<div
										key={key}
										className="flex flex-col gap-1 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
									>
										<span className="text-foreground text-label-large-emph select-text">
											{spell.name}
										</span>
										<p className="text-foreground-secondary text-body-small select-text">
											{[
												spell.mpCost ? `MP ${spell.mpCost}` : "",
												spell.sanCost ? `SAN ${spell.sanCost}` : "",
												spell.castingTime ? `施法 ${spell.castingTime}` : "",
											]
												.filter(Boolean)
												.join(" · ") || "无消耗记录"}
										</p>
										{spell.effect ? (
											<p className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text">
												{spell.effect}
											</p>
										) : null}
									</div>
								))}
							</div>
						) : null}

						{sheet.mythosTomes.length > 0 ? (
							<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
								<div className="flex items-center gap-2">
									<BookOpen className="text-foreground-secondary size-4" />
									<h3 className="text-foreground text-title-small-emph">
										神话典籍（{sheet.mythosTomes.length}）
									</h3>
								</div>
								{keyedItems(
									sheet.mythosTomes,
									(tome) => `${tome.name}|${tome.sanLoss}|${tome.mythosGain}`,
								).map(({ item: tome, key }) => (
									<div
										key={key}
										className="flex flex-col gap-1 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
									>
										<span className="text-foreground text-label-large-emph select-text">
											{tome.name}
										</span>
										<p className="text-foreground-secondary text-body-small select-text">
											{[
												tome.sanLoss ? `SAN ${tome.sanLoss}` : "",
												tome.mythosGain > 0
													? `克苏鲁神话 +${tome.mythosGain}`
													: "",
												tome.studyHours > 0
													? `研读 ${tome.studyHours} 小时`
													: "",
											]
												.filter(Boolean)
												.join(" · ") || "无数值备注"}
										</p>
										{tome.spells ? (
											<p className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text">
												所载法术：{tome.spells}
											</p>
										) : null}
									</div>
								))}
							</div>
						) : null}

						{sheet.encounters.length > 0 ? (
							<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
								<h3 className="text-foreground text-title-small-emph">
									神话遭遇（{sheet.encounters.length}）
								</h3>
								{keyedItems(
									sheet.encounters,
									(enc) => `${enc.name}|${enc.sanLoss}|${enc.count}`,
								).map(({ item: enc, key }) => (
									<div
										key={key}
										className="flex flex-col gap-1 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="text-foreground text-label-large-emph select-text">
												{enc.name}
											</span>
											<Badge variant="soft" tone="default" size="sm">
												× {enc.count}
											</Badge>
										</div>
										<p className="text-foreground-secondary text-body-small select-text">
											{[
												enc.sanLoss ? `SAN ${enc.sanLoss}` : "",
												enc.mythosGain > 0
													? `克苏鲁神话 +${enc.mythosGain}`
													: "",
											]
												.filter(Boolean)
												.join(" · ") || "无损失记录"}
										</p>
										{enc.notes ? (
											<p className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text">
												{enc.notes}
											</p>
										) : null}
									</div>
								))}
							</div>
						) : null}

						{sheet.experiences.length > 0 ? (
							<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
								<h3 className="text-foreground text-title-small-emph">
									冒险经历（{sheet.experiences.length}）
								</h3>
								{sheet.experiences.map((exp) => (
									<div
										key={exp.id}
										className="flex flex-col gap-1.5 rounded-xl bg-md-surface-container-high/60 px-3 py-2.5"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="text-foreground text-label-large-emph select-text">
												{exp.title}
											</span>
											<div className="flex flex-wrap items-center gap-1.5">
												<Badge variant="soft" tone="default" size="sm">
													{EXPERIENCE_SOURCE_LABELS[exp.sourceType]}
												</Badge>
												{exp.occurredLabel ? (
													<span className="text-foreground-tertiary text-label-small">
														{exp.occurredLabel}
													</span>
												) : null}
											</div>
										</div>
										{exp.changes.length > 0 ? (
											<div className="flex flex-wrap gap-1.5">
												{exp.changes.map((change) => (
													<Badge
														key={`${exp.id}-${change}`}
														variant="soft"
														tone="accent"
														size="sm"
													>
														{change}
													</Badge>
												))}
											</div>
										) : null}
										{exp.summary ? (
											<p className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text">
												{exp.summary}
											</p>
										) : null}
									</div>
								))}
							</div>
						) : null}
					</div>
				</SheetSection>
			) : null}

			{growthRows.length > 0 || auditRows.length > 0 ? (
				<SheetSection
					title="成长与永久修正历史"
					description="跨团追加式技能成长记录与主持人终生属性修改审计。"
				>
					<div className="grid gap-4 lg:grid-cols-2">
						{growthRows.length > 0 ? (
							<div className="flex flex-col gap-2 rounded-2xl bg-md-surface-container p-4">
								<div className="flex items-center gap-2">
									<History className="text-foreground-secondary size-4" />
									<h3 className="text-foreground text-title-small-emph">
										技能成长（{growthRows.length}）
									</h3>
								</div>
								{growthRows.map((entry) => (
									<div
										key={entry.id}
										className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-md-surface-container-high/60 px-3 py-2 text-body-small"
									>
										<span className="text-foreground font-medium">
											{coc7e.coc7eSkillLabel(entry.skillKey)}：{entry.oldValue}{" "}
											→ {entry.newValue}
										</span>
										<span className="text-foreground-tertiary text-label-small tabular-nums">
											{entry.reason ? `${entry.reason} · ` : ""}
											{formatStamp(entry.createdAt)}
										</span>
									</div>
								))}
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
												{coc7e.COC7E_ATTRIBUTE_LABELS[audit.field]?.label ??
													audit.field}
												：{audit.oldValue} → {audit.newValue}
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
					</div>
				</SheetSection>
			) : null}
		</div>
	);
}
