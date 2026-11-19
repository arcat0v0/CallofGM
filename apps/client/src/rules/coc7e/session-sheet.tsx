import { coc7e } from "@cogm/shared";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/i18n";
import type { RuleSessionSheetProps } from "../types";
import {
	cocAttributeEntries,
	cocAttributeKeys,
	cocOverview,
	deriveStats,
	parseCocSheet,
	parseCocState,
	sheetSections,
	skillKeysFor,
	skillValue,
	statusLabels,
} from "./sheet-data";

export function CocSessionSheet({
	target,
	search,
	onSearchChange,
	canPerform,
	onPerform,
}: RuleSessionSheetProps) {
	const sheet = parseCocSheet(target.sheet);
	const state = parseCocState(target.state);
	const derived = sheet ? deriveStats(sheet) : null;
	const overview = sheet ? cocOverview(sheet, true) : [];
	const sections = sheet ? sheetSections(sheet) : [];
	const skillKeys = useMemo(
		() => skillKeysFor(target).filter((key) => !cocAttributeKeys.includes(key)),
		[target],
	);
	const visibleSkills = skillKeys.filter((key) => {
		const keyword = search.trim().toLowerCase();
		if (!keyword) {
			return true;
		}
		return (
			key.toLowerCase().includes(keyword) ||
			coc7e.coc7eSkillLabel(key).toLowerCase().includes(keyword)
		);
	});
	if (!sheet || !derived)
		return (
			<p className="text-foreground-tertiary text-body-medium">
				{t("sheet.empty")}
			</p>
		);
	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				{overview.map(({ label, value }, index) => (
					<Badge
						key={label}
						variant="soft"
						tone={index === 0 && sheet.occupation.name ? "accent" : "default"}
						size="sm"
					>
						{value}
					</Badge>
				))}
				{target.kind === "npc" ? (
					<Badge variant="soft" tone="default" size="sm">
						{t("common.npc")}
					</Badge>
				) : null}
			</div>
			{state ? (
				<div className="grid grid-cols-3 gap-2 text-center text-label-medium">
					<div className="bg-md-error-container text-md-on-error-container rounded-lg py-1.5">
						HP {state.hp}/{state.maxHp}
					</div>
					<div className="bg-md-secondary-container text-md-on-secondary-container rounded-lg py-1.5">
						MP {state.mp}/{state.maxMp}
					</div>
					<div className="bg-md-tertiary-container text-md-on-tertiary-container rounded-lg py-1.5">
						SAN {state.san}/{state.maxSan}
					</div>
				</div>
			) : null}
			<Button
				type="button"
				variant="tertiary"
				className="bg-md-surface-container flex h-auto w-full items-stretch justify-between gap-4 px-4 py-3 text-left"
				disabled={!canPerform}
				onClick={() => onPerform("luck", undefined, t("sheet.destinyCheck"))}
			>
				<span className="flex flex-col gap-0.5">
					<span className="text-foreground-secondary text-label-small tracking-[0.14em]">
						{t("sheet.destiny")}
					</span>
					<span className="text-title-large-emph text-foreground font-serif tabular-nums">
						{canPerform ? (state?.luck ?? derived.luck) : derived.luck}
					</span>
					<span className="text-foreground-tertiary text-label-small">
						{canPerform ? t("sheet.currentLuck") : t("sheet.initialLuck")}
					</span>
				</span>
				<span className="grid grid-cols-2 gap-2 self-center text-right">
					<span className="flex flex-col">
						<span className="text-foreground-tertiary text-label-small">
							{t("sheet.halfValue")}
						</span>
						<span className="text-foreground text-title-medium-emph tabular-nums">
							{Math.floor(
								(canPerform ? (state?.luck ?? derived.luck) : derived.luck) / 2,
							)}
						</span>
					</span>
					<span className="flex flex-col">
						<span className="text-foreground-tertiary text-label-small">
							{t("sheet.fifthValue")}
						</span>
						<span className="text-foreground text-title-medium-emph tabular-nums">
							{Math.floor(
								(canPerform ? (state?.luck ?? derived.luck) : derived.luck) / 5,
							)}
						</span>
					</span>
				</span>
			</Button>
			<Tabs defaultValue="stats" className="gap-3">
				<TabsList className="w-full">
					<TabsTrigger value="stats">{t("sheet.statsTab")}</TabsTrigger>
					<TabsTrigger value="records">{t("sheet.recordsTab")}</TabsTrigger>
				</TabsList>
				<TabsContent value="stats" className="flex flex-col gap-3">
					<div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-md-surface-container-high sm:grid-cols-2 lg:grid-cols-3">
						{[
							[t("sheet.maxHp"), derived.hp.max],
							[t("sheet.maxMp"), derived.mp.max],
							[t("sheet.initialSan"), derived.san.current],
							[t("sheet.maxSan"), derived.san.max],
							[t("sheet.mov"), derived.mov],
							[t("sheet.damageBonus"), derived.damageBonus ?? "—"],
							[t("sheet.build"), derived.build ?? "—"],
							[t("sheet.majorWound"), derived.majorWound ?? "—"],
							[t("sheet.luck"), derived.luck],
						].map(([label, value]) => (
							<div
								key={String(label)}
								className="flex flex-col gap-0.5 bg-md-surface-container px-3 py-2"
							>
								<span className="text-foreground-secondary text-label-small">
									{label}
								</span>
								<span className="text-title-medium-emph text-foreground tabular-nums">
									{value}
								</span>
							</div>
						))}
					</div>
					<div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
						{cocAttributeEntries(sheet).map(({ key, label, value }) => (
							<Button
								key={key}
								type="button"
								variant="tertiary"
								className="bg-md-surface-container h-auto justify-between px-3 py-2 text-body-medium"
								disabled={!canPerform}
								onClick={() => onPerform(key)}
							>
								<span>{label}</span>
								<span className="tabular-nums">{value}</span>
							</Button>
						))}
					</div>
					<div className="flex items-center gap-2">
						<InputGroup className="h-9">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={search}
								aria-label={t("sheet.searchSkills")}
								placeholder={t("sheet.searchSkills")}
								onChange={(event) => onSearchChange(event.target.value)}
							/>
						</InputGroup>
					</div>
					<div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
						{visibleSkills.map((key) => {
							const value = skillValue(target, key);
							return (
								<Button
									key={key}
									type="button"
									variant="ghost"
									className="h-8 justify-between px-2 text-body-medium"
									disabled={!canPerform || value === null}
									onClick={() => onPerform(key)}
								>
									<span>{coc7e.coc7eSkillLabel(key)}</span>
									<span className="tabular-nums">{value ?? "—"}</span>
								</Button>
							);
						})}
					</div>
					{state && state.growthMarks.length > 0 ? (
						<p className="text-foreground-tertiary text-label-small select-text">
							{t("sheet.growthMarks", {
								marks: state.growthMarks
									.map((key) => coc7e.coc7eSkillLabel(key))
									.join(t("common.listSeparator")),
							})}
						</p>
					) : null}
					{state && state.statuses.length > 0 ? (
						<p className="text-warning text-label-small select-text">
							{statusLabels(state.statuses).join(t("common.listSeparator"))}
						</p>
					) : null}
				</TabsContent>
				<TabsContent value="records" className="flex flex-col gap-4">
					{sections.length === 0 ? (
						<p className="text-foreground-tertiary text-body-medium">
							{t("sheet.publicSummaryOnly")}
						</p>
					) : (
						sections.map((section) => (
							<section key={section.id} className="flex flex-col gap-2">
								<h3 className="text-foreground text-title-medium-emph">
									{section.title}
								</h3>
								{section.rows.length > 0 ? (
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
										{section.rows.map((row) => (
											<div
												key={row.label}
												className="rounded-xl bg-md-surface-container px-3 py-2"
											>
												<span className="text-foreground-secondary text-label-small">
													{row.label}
												</span>
												<p className="text-foreground text-body-medium select-text">
													{row.value}
												</p>
											</div>
										))}
									</div>
								) : null}
								{section.items.length > 0 ? (
									<div className="flex flex-col gap-2">
										{section.items.map((item) => (
											<div
												key={`${section.id}-${item.name}-${item.lines.join("\u0000")}`}
												className="rounded-xl bg-md-surface-container px-3 py-2"
											>
												<p className="text-foreground text-label-large-emph select-text">
													{item.name}
												</p>
												{item.lines.map((line) => (
													<p
														key={`${item.name}-${line}`}
														className="text-foreground-secondary whitespace-pre-wrap text-body-small select-text"
													>
														{line}
													</p>
												))}
											</div>
										))}
									</div>
								) : null}
							</section>
						))
					)}
				</TabsContent>
			</Tabs>
		</>
	);
}
