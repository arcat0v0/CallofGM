import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/i18n";
import {
	parseCocSheet,
	parseCocState,
	skillKeysFor,
	skillValue,
} from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { getRuleComponent } from "@/rules/registry";
import { useBlockingDialog } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";

export function CharacterSheetPanel({
	open,
	onOpenChange,
	initialCharacterId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialCharacterId?: string | null;
}) {
	const isGm = usePlayStore((state) => state.viewer.isGm);
	const characters = usePlayStore((state) => state.characters);
	const viewerHolderKind = usePlayStore((state) => state.viewer.holderKind);
	const viewerHolderId = usePlayStore((state) => state.viewer.holderId);
	const claimed = characters.find(
		(character) =>
			character.claim?.holderKind === viewerHolderKind &&
			character.claim?.holderId === viewerHolderId &&
			character.claim.role === "pc",
	);
	const options = characters.filter((character) => character.sheet != null);
	const [selectedId, setSelectedId] = useState(initialCharacterId ?? "");
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (open && initialCharacterId) {
			setSelectedId(initialCharacterId);
		}
	}, [open, initialCharacterId]);

	const dialog = useBlockingDialog("sheet", open, onOpenChange);
	const target =
		options.find((character) => character.characterId === selectedId) ??
		options[0];
	const rule = getRuleComponent(target?.ruleId);
	const sheet = parseCocSheet(target?.sheet, target?.ruleId);
	const attributeKeys = useMemo(
		() => (sheet ? rule.attributeKeys(sheet) : []),
		[rule, sheet],
	);
	const state = parseCocState(target?.state);
	const derived = sheet ? rule.deriveStats(sheet) : null;
	const overview = sheet ? rule.sheetOverview(sheet) : null;
	const sections = sheet ? rule.sheetSections(sheet) : [];
	const canPerform =
		isGm ||
		(claimed !== undefined && target?.characterId === claimed.characterId);
	const skillKeys = useMemo(
		() => skillKeysFor(target).filter((key) => !attributeKeys.includes(key)),
		[target, attributeKeys],
	);
	const visibleSkills = skillKeys.filter((key) => {
		const keyword = search.trim().toLowerCase();
		if (!keyword) {
			return true;
		}
		return (
			key.toLowerCase().includes(keyword) ||
			rule.skillLabel(key).toLowerCase().includes(keyword)
		);
	});

	function perform(skillKey: string) {
		if (!target?.characterId) {
			return;
		}
		const sent = sendSessionCommand("check:perform", {
			characterId: target.characterId,
			skillKey,
			difficulty: "regular",
			bonusDice: 0,
			penaltyDice: 0,
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		toast.success(t("check.submitted", { skill: rule.skillLabel(skillKey) }));
	}

	return (
		<Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
			<DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-3 overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{target?.name ?? t("sheet.titleFallback")}</DialogTitle>
					<DialogDescription>
						{canPerform
							? t("sheet.description")
							: t("sheet.descriptionTeammate")}
					</DialogDescription>
				</DialogHeader>
				{options.length > 1 ? (
					<Select
						value={target?.characterId ?? ""}
						onValueChange={setSelectedId}
					>
						<SelectTrigger className="h-8 text-label-medium">
							<SelectValue placeholder={t("sheet.selectCharacter")} />
						</SelectTrigger>
						<SelectContent>
							{options.map((character) => (
								<SelectItem
									key={character.characterId}
									value={character.characterId}
								>
									{character.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				{!target || !sheet || !derived ? (
					<p className="text-foreground-tertiary text-body-medium">
						{t("sheet.empty")}
					</p>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-2">
							{overview?.profession ? (
								<Badge variant="soft" tone="accent" size="sm">
									{overview.profession}
								</Badge>
							) : null}
							{overview?.era ? (
								<Badge variant="soft" tone="default" size="sm">
									{overview.era}
								</Badge>
							) : null}
							{overview?.age !== null && overview?.age !== undefined ? (
								<Badge variant="soft" tone="default" size="sm">
									{overview.age} 岁
								</Badge>
							) : null}
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
						<Tabs defaultValue="stats" className="gap-3">
							<TabsList className="w-full">
								<TabsTrigger value="stats">{t("sheet.statsTab")}</TabsTrigger>
								<TabsTrigger value="records">
									{t("sheet.recordsTab")}
								</TabsTrigger>
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
									{rule.attributeEntries(sheet).map(({ key, label, value }) => (
										<Button
											key={key}
											type="button"
											variant="tertiary"
											className="bg-md-surface-container h-auto justify-between px-3 py-2 text-body-medium"
											disabled={!canPerform}
											onClick={() => perform(key)}
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
											onChange={(event) => setSearch(event.target.value)}
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
												onClick={() => perform(key)}
											>
												<span>{rule.skillLabel(key)}</span>
												<span className="tabular-nums">{value ?? "—"}</span>
											</Button>
										);
									})}
								</div>
								{state && state.growthMarks.length > 0 ? (
									<p className="text-foreground-tertiary text-label-small select-text">
										{t("sheet.growthMarks", {
											marks: state.growthMarks
												.map((key) => rule.skillLabel(key))
												.join(t("common.listSeparator")),
										})}
									</p>
								) : null}
								{state && state.statuses.length > 0 ? (
									<p className="text-warning text-label-small select-text">
										{rule
											.statusLabels(state.statuses)
											.join(t("common.listSeparator"))}
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
				)}
			</DialogContent>
		</Dialog>
	);
}
