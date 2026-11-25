import {
	type SnapshotCharacter,
	STAGE_MAX_ITEMS,
	STAGE_MAX_PRESETS,
	type StageComposition,
	type StagePortraitItem,
	type StagePresetDto,
} from "@cogm/shared";
import {
	ArrowDown,
	ArrowDownToLine,
	ArrowUp,
	ArrowUpToLine,
	BookmarkPlus,
	Check,
	Eye,
	EyeOff,
	FlipHorizontal2,
	RefreshCw,
	RotateCcw,
	Search,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	addCharacterToComposition,
	applyQuickPreset,
	clampStageScale,
	clampStageX,
	clampStageY,
	removeCharacterFromComposition,
	reorderLayerInComposition,
	STAGE_SCALE_MAX,
	STAGE_SCALE_MIN,
	STAGE_X_MAX,
	STAGE_X_MIN,
	STAGE_Y_MAX,
	STAGE_Y_MIN,
	type StageQuickPresetId,
} from "@/features/session-stage/portrait-layout";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { expressionLabel, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK_PRESETS: ReadonlyArray<{
	id: StageQuickPresetId;
	labelKey: string;
	danger?: boolean;
}> = [
	{ id: "auto", labelKey: "gm.stageStudio.preset.auto" },
	{ id: "center", labelKey: "gm.stageStudio.preset.center" },
	{ id: "left", labelKey: "gm.stageStudio.preset.left" },
	{ id: "right", labelKey: "gm.stageStudio.preset.right" },
	{ id: "spread", labelKey: "gm.stageStudio.preset.spread" },
	{ id: "duel", labelKey: "gm.stageStudio.preset.duel" },
	{ id: "trio", labelKey: "gm.stageStudio.preset.trio" },
	{ id: "clear", labelKey: "gm.stageStudio.preset.clear", danger: true },
];

type SidebarTab = "cast" | "presets";

export function StageStudioSidebar({
	characters,
	composition,
	selectedId,
	onSelect,
	onChangeComposition,
	onCommitComposition,
	expressionOverrides,
	onSetExpressionOverride,
	presets,
	presetSaving,
	onSavePreset,
	onOverwritePreset,
	onDeletePreset,
	onLoadPreset,
}: {
	characters: SnapshotCharacter[];
	composition: StageComposition;
	selectedId: string | null;
	onSelect: (characterId: string | null) => void;
	onChangeComposition: (next: StageComposition) => void;
	onCommitComposition: (next: StageComposition) => void;
	expressionOverrides: Record<string, string>;
	onSetExpressionOverride: (characterId: string, key: string | null) => void;
	presets: StagePresetDto[];
	presetSaving: boolean;
	onSavePreset: (name: string) => Promise<boolean>;
	onOverwritePreset: (preset: StagePresetDto) => Promise<void>;
	onDeletePreset: (preset: StagePresetDto) => Promise<void>;
	onLoadPreset: (preset: StagePresetDto) => void;
}) {
	const [tab, setTab] = useState<SidebarTab>("cast");
	const [search, setSearch] = useState("");
	const [presetName, setPresetName] = useState("");

	const stagedMap = new Map(
		composition.items.map((item) => [item.characterId, item]),
	);
	const selectedItem = selectedId ? (stagedMap.get(selectedId) ?? null) : null;
	const selectedCharacter = selectedId
		? (characters.find((character) => character.characterId === selectedId) ??
			null)
		: null;

	const keyword = search.trim();
	const filteredCharacters = characters
		.filter((character) => !keyword || character.name.includes(keyword))
		.sort((a, b) => {
			const aOn = stagedMap.has(a.characterId);
			const bOn = stagedMap.has(b.characterId);
			if (aOn !== bOn) return aOn ? -1 : 1;
			if (aOn && bOn) {
				return (
					(stagedMap.get(b.characterId)?.zIndex ?? 0) -
					(stagedMap.get(a.characterId)?.zIndex ?? 0)
				);
			}
			return Number(a.kind === "npc") - Number(b.kind === "npc");
		});

	function updateSelectedItem(
		patch: Partial<StagePortraitItem>,
		commit: boolean,
	) {
		if (!selectedItem) return;
		const next: StageComposition = {
			...composition,
			mode: "custom",
			items: composition.items.map((item) =>
				item.characterId === selectedItem.characterId
					? { ...item, ...patch }
					: item,
			),
		};
		onChangeComposition(next);
		if (commit) {
			onCommitComposition(next);
		}
	}

	function toggleCharacterOnStage(character: SnapshotCharacter) {
		const isOn = stagedMap.has(character.characterId);
		if (isOn) {
			const next = removeCharacterFromComposition(
				composition,
				character.characterId,
			);
			onChangeComposition(next);
			onCommitComposition(next);
			if (selectedId === character.characterId) {
				onSelect(next.items[0]?.characterId ?? null);
			}
			return;
		}
		if (composition.items.length >= STAGE_MAX_ITEMS) {
			toast.error(
				t("gm.stageStudio.castLimitReached", { max: STAGE_MAX_ITEMS }),
			);
			return;
		}
		const next = addCharacterToComposition(composition, character.characterId);
		onChangeComposition(next);
		onCommitComposition(next);
		onSelect(character.characterId);
	}

	function handleReorder(action: "front" | "forward" | "backward" | "back") {
		if (!selectedItem) return;
		const next = reorderLayerInComposition(
			composition,
			selectedItem.characterId,
			action,
		);
		onChangeComposition(next);
		onCommitComposition(next);
	}

	async function handleCreatePreset() {
		const trimmed = presetName.trim();
		if (!trimmed) return;
		const ok = await onSavePreset(trimmed);
		if (ok) {
			setPresetName("");
		}
	}

	return (
		<aside className="bg-md-surface-container-low border-md-outline-variant/40 flex w-full shrink-0 flex-col overflow-hidden border-t lg:w-[348px] lg:border-t-0 lg:border-l">
			<div className="border-md-outline-variant/30 shrink-0 border-b p-3">
				<SegmentedControl
					value={tab}
					options={[
						{ value: "cast", label: t("gm.stageStudio.tabCast") },
						{ value: "presets", label: t("gm.stageStudio.tabPresets") },
					]}
					onValueChange={setTab}
					className="h-9"
					itemClassName="h-full text-label-medium"
				/>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
				{tab === "cast" ? (
					<>
						<section className="bg-md-surface-container flex flex-col gap-3 rounded-2xl p-3.5">
							<div className="flex items-center justify-between gap-2">
								<span className="text-md-on-surface text-label-large-emph">
									{t("gm.stageStudio.selectedTitle")}
								</span>
								{selectedCharacter && selectedItem ? (
									<div className="flex items-center gap-1">
										<Button
											type="button"
											variant={selectedItem.flipX ? "secondary" : "ghost"}
											size="icon-sm"
											className="size-7 [&_svg]:size-3.5"
											aria-label={t("gm.stageStudio.flipX")}
											title={t("gm.stageStudio.flipX")}
											onClick={() =>
												updateSelectedItem({ flipX: !selectedItem.flipX }, true)
											}
										>
											<FlipHorizontal2 className="size-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="size-7 [&_svg]:size-3.5"
											aria-label={t("gm.stageStudio.resetTransform")}
											title={t("gm.stageStudio.resetTransform")}
											onClick={() =>
												updateSelectedItem(
													{ x: 50, y: 0, scale: 1, flipX: false },
													true,
												)
											}
										>
											<RotateCcw className="size-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="text-danger size-7 [&_svg]:size-3.5"
											aria-label={t("gm.stageStudio.takeOffStage")}
											title={t("gm.stageStudio.takeOffStage")}
											onClick={() => toggleCharacterOnStage(selectedCharacter)}
										>
											<EyeOff className="size-3.5" />
										</Button>
									</div>
								) : null}
							</div>

							{selectedCharacter && selectedItem ? (
								<div className="flex flex-col gap-3">
									<div className="bg-md-surface-container-high/70 flex items-center gap-2.5 rounded-xl px-2.5 py-2">
										<CharacterThumb character={selectedCharacter} />
										<div className="flex min-w-0 flex-1 flex-col">
											<span className="text-md-on-surface truncate text-label-large-emph">
												{selectedCharacter.name}
											</span>
											<span className="text-md-on-surface-variant text-label-small">
												{selectedCharacter.kind === "pc"
													? t("common.pc")
													: t("common.npc")}
											</span>
										</div>
									</div>

									{selectedCharacter.portraits.length > 1 ? (
										<div className="flex flex-col gap-1.5">
											<span className="text-md-on-surface-variant text-label-small">
												{t("gm.stageStudio.previewExpression")}
											</span>
											<Select
												value={
													expressionOverrides[selectedCharacter.characterId] ??
													"__live__"
												}
												onValueChange={(value) =>
													onSetExpressionOverride(
														selectedCharacter.characterId,
														value === "__live__" ? null : value,
													)
												}
											>
												<SelectTrigger className="h-8 text-label-medium">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="__live__">
														{t("gm.stageStudio.previewExpressionLive")}
													</SelectItem>
													{selectedCharacter.portraits.map((portrait) => (
														<SelectItem
															key={portrait.expressionKey}
															value={portrait.expressionKey}
														>
															{expressionLabel(
																portrait.expressionKey,
																portrait.label ?? null,
															)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									) : null}

									<SliderRow
										label={t("gm.stageStudio.axisX")}
										valueText={`${Math.round(selectedItem.x)}%`}
										value={selectedItem.x}
										min={STAGE_X_MIN}
										max={STAGE_X_MAX}
										step={1}
										onChange={(val) =>
											updateSelectedItem({ x: clampStageX(val) }, false)
										}
										onCommit={(val) =>
											updateSelectedItem({ x: clampStageX(val) }, true)
										}
									/>

									<SliderRow
										label={t("gm.stageStudio.axisY")}
										valueText={`${selectedItem.y > 0 ? "+" : ""}${Math.round(selectedItem.y)}%`}
										value={selectedItem.y}
										min={STAGE_Y_MIN}
										max={STAGE_Y_MAX}
										step={1}
										onChange={(val) =>
											updateSelectedItem({ y: clampStageY(val) }, false)
										}
										onCommit={(val) =>
											updateSelectedItem({ y: clampStageY(val) }, true)
										}
									/>

									<SliderRow
										label={t("gm.stageStudio.scale")}
										valueText={`${Math.round(selectedItem.scale * 100)}%`}
										value={Math.round(selectedItem.scale * 100)}
										min={Math.round(STAGE_SCALE_MIN * 100)}
										max={Math.round(STAGE_SCALE_MAX * 100)}
										step={2}
										onChange={(val) =>
											updateSelectedItem(
												{ scale: clampStageScale(val / 100) },
												false,
											)
										}
										onCommit={(val) =>
											updateSelectedItem(
												{ scale: clampStageScale(val / 100) },
												true,
											)
										}
									/>

									<div className="flex items-center justify-between gap-2 pt-0.5">
										<span className="text-md-on-surface-variant text-label-medium">
											{t("gm.stageStudio.layerOrder")}
										</span>
										<div className="flex items-center gap-1">
											<Button
												type="button"
												variant="tertiary"
												size="icon-sm"
												className="size-7 [&_svg]:size-3.5"
												aria-label={t("gm.stageStudio.layerBack")}
												title={t("gm.stageStudio.layerBack")}
												onClick={() => handleReorder("back")}
											>
												<ArrowDownToLine className="size-3.5" />
											</Button>
											<Button
												type="button"
												variant="tertiary"
												size="icon-sm"
												className="size-7 [&_svg]:size-3.5"
												aria-label={t("gm.stageStudio.layerBackward")}
												title={t("gm.stageStudio.layerBackward")}
												onClick={() => handleReorder("backward")}
											>
												<ArrowDown className="size-3.5" />
											</Button>
											<Button
												type="button"
												variant="tertiary"
												size="icon-sm"
												className="size-7 [&_svg]:size-3.5"
												aria-label={t("gm.stageStudio.layerForward")}
												title={t("gm.stageStudio.layerForward")}
												onClick={() => handleReorder("forward")}
											>
												<ArrowUp className="size-3.5" />
											</Button>
											<Button
												type="button"
												variant="tertiary"
												size="icon-sm"
												className="size-7 [&_svg]:size-3.5"
												aria-label={t("gm.stageStudio.layerFront")}
												title={t("gm.stageStudio.layerFront")}
												onClick={() => handleReorder("front")}
											>
												<ArrowUpToLine className="size-3.5" />
											</Button>
										</div>
									</div>
								</div>
							) : (
								<p className="text-md-on-surface-variant text-body-small">
									{t("gm.stageStudio.selectedEmpty")}
								</p>
							)}
						</section>

						<section className="bg-md-surface-container flex min-h-0 flex-1 flex-col gap-2.5 rounded-2xl p-3.5">
							<div className="flex items-center justify-between gap-2">
								<span className="text-md-on-surface text-label-large-emph">
									{t("gm.stageStudio.castTitle")}
								</span>
								<Badge variant="soft" tone="default" size="sm">
									{t("gm.stageStudio.castCount", {
										count: composition.items.length,
										max: STAGE_MAX_ITEMS,
									})}
								</Badge>
							</div>

							{characters.length > 6 ? (
								<InputGroup className="h-8">
									<InputGroupAddon>
										<Search className="size-3.5" />
									</InputGroupAddon>
									<InputGroupInput
										value={search}
										aria-label={t("gm.stageStudio.castSearch")}
										placeholder={t("gm.stageStudio.castSearch")}
										onChange={(event) => setSearch(event.target.value)}
									/>
								</InputGroup>
							) : null}

							{characters.length === 0 ? (
								<p className="text-md-on-surface-variant text-body-small">
									{t("gm.stageStudio.castEmpty")}
								</p>
							) : (
								<div className="flex flex-col gap-1.5">
									{filteredCharacters.map((character) => {
										const isOnStage = stagedMap.has(character.characterId);
										const isSelected = selectedId === character.characterId;
										return (
											<div
												key={character.characterId}
												className={cn(
													"flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150",
													isSelected
														? "bg-md-primary-container/55 ring-md-primary/60 ring-1"
														: "bg-md-surface-container-high/55 hover:bg-md-surface-container-high",
												)}
											>
												<button
													type="button"
													onClick={() => {
														if (isOnStage) {
															onSelect(character.characterId);
														} else {
															toggleCharacterOnStage(character);
														}
													}}
													className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
												>
													<CharacterThumb character={character} />
													<div className="flex min-w-0 flex-1 flex-col">
														<span className="text-md-on-surface truncate text-label-large">
															{character.name}
														</span>
														<span className="text-md-on-surface-variant text-label-small">
															{character.kind === "pc"
																? t("common.pc")
																: t("common.npc")}
															{" · "}
															{isOnStage
																? t("gm.stageStudio.onStageBadge")
																: t("gm.stageStudio.offStageBadge")}
														</span>
													</div>
												</button>
												<Button
													type="button"
													variant={isOnStage ? "secondary" : "tertiary"}
													size="xs"
													className="h-7 shrink-0 gap-1 px-2.5 text-label-small"
													onClick={() => toggleCharacterOnStage(character)}
												>
													{isOnStage ? (
														<>
															<EyeOff className="size-3.5" />
															{t("gm.stageStudio.takeOffStage")}
														</>
													) : (
														<>
															<Eye className="size-3.5" />
															{t("gm.stageStudio.putOnStage")}
														</>
													)}
												</Button>
											</div>
										);
									})}
								</div>
							)}
						</section>
					</>
				) : (
					<>
						<section className="bg-md-surface-container flex flex-col gap-2.5 rounded-2xl p-3.5">
							<div className="flex flex-col gap-0.5">
								<span className="text-md-on-surface text-label-large-emph">
									{t("gm.stageStudio.quickPresetsTitle")}
								</span>
								<span className="text-md-on-surface-variant text-label-small">
									{t("gm.stageStudio.quickPresetsHint")}
								</span>
							</div>
							<div className="grid grid-cols-2 gap-1.5">
								{QUICK_PRESETS.map((preset) => (
									<Button
										key={preset.id}
										type="button"
										variant="tertiary"
										size="sm"
										className={cn(
											"bg-md-surface-container-high h-9 justify-center rounded-xl text-label-medium",
											preset.danger && "text-danger",
										)}
										onClick={() => {
											const next = applyQuickPreset(
												preset.id,
												composition,
												characters,
											);
											onChangeComposition(next);
											onCommitComposition(next);
											if (next.items.length === 0) {
												onSelect(null);
											} else if (
												!selectedId ||
												!next.items.some(
													(item) => item.characterId === selectedId,
												)
											) {
												onSelect(next.items[0]?.characterId ?? null);
											}
										}}
									>
										{t(preset.labelKey)}
									</Button>
								))}
							</div>
						</section>

						<section className="bg-md-surface-container flex items-center justify-between gap-3 rounded-2xl p-3.5">
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="text-md-on-surface text-label-large-emph">
									{t("gm.stageStudio.emphasizeSpeaker")}
								</span>
								<span className="text-md-on-surface-variant text-label-small">
									{t("gm.stageStudio.emphasizeSpeakerHint")}
								</span>
							</div>
							<Switch
								size="sm"
								checked={composition.emphasizeSpeaker}
								aria-label={t("gm.stageStudio.emphasizeSpeaker")}
								onCheckedChange={(checked) => {
									const next: StageComposition = {
										...composition,
										emphasizeSpeaker: checked,
									};
									onChangeComposition(next);
									onCommitComposition(next);
								}}
							/>
						</section>

						<section className="bg-md-surface-container flex flex-col gap-3 rounded-2xl p-3.5">
							<div className="flex items-center justify-between gap-2">
								<span className="text-md-on-surface text-label-large-emph">
									{t("gm.stageStudio.savedPresetsTitle")}
								</span>
								<Badge variant="soft" tone="default" size="sm">
									{t("gm.stageStudio.savedPresetsCount", {
										count: presets.length,
										max: STAGE_MAX_PRESETS,
									})}
								</Badge>
							</div>

							<form
								className="flex items-center gap-1.5"
								onSubmit={(event) => {
									event.preventDefault();
									void handleCreatePreset();
								}}
							>
								<Input
									value={presetName}
									maxLength={40}
									placeholder={t("gm.stageStudio.presetNamePlaceholder")}
									aria-label={t("gm.stageStudio.presetNamePlaceholder")}
									className="h-9 flex-1 text-body-small"
									disabled={presetSaving || presets.length >= STAGE_MAX_PRESETS}
									onChange={(event) => setPresetName(event.target.value)}
								/>
								<Button
									type="submit"
									variant="secondary"
									size="sm"
									className="h-9 shrink-0 gap-1.5 px-3"
									disabled={
										presetSaving ||
										presetName.trim().length === 0 ||
										presets.length >= STAGE_MAX_PRESETS
									}
								>
									<BookmarkPlus className="size-4" />
									{t("gm.stageStudio.presetSave")}
								</Button>
							</form>

							{presets.length === 0 ? (
								<p className="text-md-on-surface-variant text-body-small">
									{t("gm.stageStudio.savedPresetsEmpty")}
								</p>
							) : (
								<div className="flex flex-col gap-1.5">
									{presets.map((preset) => (
										<div
											key={preset.id}
											className="bg-md-surface-container-high/65 flex items-center gap-2 rounded-xl px-2.5 py-2"
										>
											<div className="flex min-w-0 flex-1 flex-col">
												<span className="text-md-on-surface truncate text-label-large">
													{preset.name}
												</span>
												<span className="text-md-on-surface-variant text-label-small">
													{preset.composition.items.length > 0
														? t("gm.stageStudio.presetItemCount", {
																count: preset.composition.items.length,
															})
														: t("gm.stageStudio.presetEmptyCount")}
												</span>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<Button
													type="button"
													variant="tertiary"
													size="xs"
													className="h-7 gap-1 px-2 text-label-small"
													onClick={() => onLoadPreset(preset)}
												>
													<Check className="size-3.5" />
													{t("gm.stageStudio.presetLoad")}
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													className="size-7 [&_svg]:size-3.5"
													disabled={presetSaving}
													aria-label={t("gm.stageStudio.presetUpdate")}
													title={t("gm.stageStudio.presetUpdate")}
													onClick={() => void onOverwritePreset(preset)}
												>
													<RefreshCw className="size-3.5" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													disabled={presetSaving}
													className="text-danger size-7 [&_svg]:size-3.5"
													aria-label={t("gm.stageStudio.presetDelete")}
													title={t("gm.stageStudio.presetDelete")}
													onClick={() => void onDeletePreset(preset)}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</section>
					</>
				)}
			</div>
		</aside>
	);
}

function CharacterThumb({ character }: { character: SnapshotCharacter }) {
	const portrait =
		character.portraits.find(
			(item) => item.expressionKey === character.currentExpressionKey,
		) ??
		character.portraits.find((item) => item.isDefault) ??
		character.portraits[0];
	const src = portrait ? mediaUrl(portrait.portraitAssetId) : null;
	if (src) {
		return (
			<img
				src={src}
				alt=""
				className="bg-md-surface-container-highest size-8 shrink-0 rounded-full object-cover object-top"
			/>
		);
	}
	return (
		<span
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-full text-label-small-emph",
				character.kind === "pc"
					? "bg-md-primary-container text-md-on-primary-container"
					: "bg-md-surface-container-highest text-md-on-surface-variant",
			)}
		>
			{initialsOf(character.name)}
		</span>
	);
}

function SliderRow({
	label,
	valueText,
	value,
	min,
	max,
	step,
	onChange,
	onCommit,
}: {
	label: string;
	valueText: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	onCommit: (value: number) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-2 text-label-medium">
				<span className="text-md-on-surface-variant">{label}</span>
				<span className="text-md-on-surface tabular-nums">{valueText}</span>
			</div>
			<Slider
				size="sm"
				value={[value]}
				min={min}
				max={max}
				step={step}
				aria-label={label}
				onValueChange={(values) => {
					const next = values[0];
					if (next !== undefined) onChange(next);
				}}
				onValueCommit={(values) => {
					const next = values[0];
					if (next !== undefined) onCommit(next);
				}}
			/>
		</div>
	);
}
