import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SheetSection, TextField } from "@/components/shared/creation-form";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortraitBasePath } from "@/features/characters/expression-manager";
import { ExpressionManager } from "@/features/characters/expression-manager";
import { SheetFullEditor } from "@/features/characters/sheet-full-editor";
import { t, useI18nVersion } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { getRuleComponent } from "@/rules/registry";

export function CharacterSheetPage({
	scope,
	characterId,
	onBack,
}: {
	scope: "pl" | "gm";
	characterId: string;
	onBack: () => void;
}) {
	useI18nVersion();
	const basePath: PortraitBasePath =
		scope === "gm" ? "/gm/characters" : "/pl/characters";
	const [character, setCharacter] = useState<CharacterDetailDto | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setCharacter(
				await api<CharacterDetailDto>(
					`${basePath}/${encodeURIComponent(characterId)}`,
				),
			);
		} catch (error) {
			setCharacter(null);
			toast.error(errorText(error, "characterSheet.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, [basePath, characterId]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<main className="bg-background flex min-h-dvh flex-col">
			{loading ? (
				<div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
					<ListSkeleton rows={3} />
				</div>
			) : character ? (
				<CharacterSheetView
					scope={scope}
					basePath={basePath}
					character={character}
					onCharacterChange={setCharacter}
					onBack={onBack}
				/>
			) : (
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6">
					<EmptyState
						icon={UserRound}
						title={t("characterSheet.loadFailed")}
						action={
							<div className="flex flex-wrap items-center justify-center gap-2">
								<Button
									type="button"
									variant="primary"
									onClick={() => void load()}
								>
									{t("characterSheet.retry")}
								</Button>
								<Button type="button" variant="tertiary" onClick={onBack}>
									{t("characterSheet.back")}
								</Button>
							</div>
						}
					/>
				</div>
			)}
		</main>
	);
}

function CharacterSheetView({
	scope,
	basePath,
	character,
	onCharacterChange,
	onBack,
}: {
	scope: "pl" | "gm";
	basePath: PortraitBasePath;
	character: CharacterDetailDto;
	onCharacterChange: (character: CharacterDetailDto) => void;
	onBack: () => void;
}) {
	const rule = getRuleComponent(character.ruleId);
	const canEditSheet = scope === "pl" || character.ownerKind === "gm";
	const [name, setName] = useState(character.name);
	const [background, setBackground] = useState(character.background);
	const [version, setVersion] = useState(character.version);
	const [fullSheet, setFullSheet] = useState<unknown>(
		rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
	);
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setName(character.name);
		setBackground(character.background);
		setVersion(character.version);
		setShowValidation(false);
		setFullSheet(
			rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
		);
	}, [
		character.name,
		character.background,
		character.version,
		character.sheetJson,
		rule,
	]);

	const derived = rule.deriveStats(fullSheet);
	const overview = rule.sheetOverview(fullSheet);
	const defaultPortrait =
		character.portraits.find((portrait) => portrait.isDefault === 1) ??
		character.portraits[0];
	const portraitUrl = mediaUrl(defaultPortrait?.portraitAssetId);

	async function save() {
		if (saving) {
			return;
		}
		const sheetData = canEditSheet ? rule.parseSheet(fullSheet) : undefined;
		if (canEditSheet && (!sheetData || !sheetValid)) {
			setShowValidation(true);
			toast.error(t("characterCreation.ruleValidationSummary"));
			return;
		}
		setSaving(true);
		try {
			const next = await api<CharacterDto>(
				`${basePath}/${encodeURIComponent(character.id)}`,
				{
					method: "PATCH",
					body: JSON.stringify({
						name: name.trim(),
						background,
						...(sheetData === undefined ? {} : { sheetData }),
						expectedVersion: version,
					}),
				},
			);
			toast.success(t("characterProfile.saved"));
			onCharacterChange({ ...character, ...next });
		} catch (error) {
			toast.error(errorText(error, "characterProfile.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	async function refreshPortraits() {
		try {
			onCharacterChange(
				await api<CharacterDetailDto>(
					`${basePath}/${encodeURIComponent(character.id)}`,
				),
			);
		} catch (error) {
			toast.error(errorText(error, "characterProfile.refreshFailed"));
		}
	}

	return (
		<>
			<header className="border-separator-secondary/60 bg-background sticky top-0 z-10 border-b">
				<div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						onClick={onBack}
					>
						<ArrowLeft />
						{t("characterSheet.back")}
					</Button>
					<div className="bg-surface-tertiary size-14 shrink-0 overflow-hidden rounded-t-full rounded-b-xl">
						{portraitUrl ? (
							<img
								src={portraitUrl}
								alt={character.name}
								className="size-full object-cover"
							/>
						) : (
							<div className="text-foreground-tertiary flex size-full items-center justify-center">
								<UserRound />
							</div>
						)}
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<h1 className="truncate font-sans text-title-large-emph text-foreground">
							{character.name}
						</h1>
						<div className="flex flex-wrap items-center gap-1.5">
							<Badge variant="soft" tone="accent" size="sm">
								{character.ruleId}
							</Badge>
							<Badge variant="soft" tone="default" size="sm">
								{t(character.kind === "npc" ? "common.npc" : "common.pc")}
							</Badge>
							{overview?.profession ? (
								<Badge variant="soft" tone="default" size="sm">
									{overview.profession}
								</Badge>
							) : null}
							{overview?.era ? (
								<Badge variant="soft" tone="default" size="sm">
									{overview.era}
								</Badge>
							) : null}
							<span className="text-foreground-tertiary font-mono text-label-small">
								{t("characterSheet.version", { version })}
							</span>
						</div>
					</div>
					<Button
						type="button"
						variant="primary"
						className="shrink-0"
						disabled={saving || !name.trim()}
						onClick={() => void save()}
					>
						<Save />
						{t("common.save")}
					</Button>
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:py-8">
				<div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
					<SheetSection title={t("characterCreation.derived")}>
						<div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
							{(
								[
									["HP", derived.hp],
									["MP", derived.mp],
									["SAN", derived.san],
								] as const
							).map(([label, value]) => (
								<div
									key={label}
									className="flex flex-col gap-0.5 rounded-xl bg-md-surface-container px-3 py-2"
								>
									<span className="text-foreground-secondary text-label-small">
										{label}
									</span>
									<span className="text-title-medium-emph text-foreground tabular-nums">
										{value.current}/{value.max}
									</span>
								</div>
							))}
						</div>
						<div className="grid grid-cols-2 gap-2">
							{(
								[
									[t("sheet.mov"), derived.mov],
									[t("sheet.luck"), derived.luck],
									[t("sheet.damageBonus"), derived.damageBonus ?? "—"],
									[t("sheet.build"), derived.build ?? "—"],
									[t("sheet.majorWound"), derived.majorWound ?? "—"],
								] as const
							).map(([label, value]) => (
								<div
									key={label}
									className="flex flex-col gap-0.5 rounded-xl bg-md-surface-container px-3 py-2"
								>
									<span className="text-foreground-secondary text-label-small">
										{label}
									</span>
									<span className="text-title-small-emph text-foreground tabular-nums">
										{value}
									</span>
								</div>
							))}
						</div>
					</SheetSection>
				</div>

				<div className="flex min-w-0 flex-col gap-4">
					{canEditSheet ? null : (
						<p
							role="status"
							className="rounded-xl bg-md-surface-container px-4 py-3 text-body-medium text-foreground-secondary"
						>
							{t("characterProfile.permanentOnly")}
						</p>
					)}
					<Tabs
						defaultValue={canEditSheet ? "sheet" : "profile"}
						className="gap-4"
					>
						<TabsList>
							{canEditSheet ? (
								<TabsTrigger value="sheet">
									{t("characterProfile.sheetTab")}
								</TabsTrigger>
							) : null}
							<TabsTrigger value="profile">
								{t("characterProfile.profileTab")}
							</TabsTrigger>
						</TabsList>
						{canEditSheet ? (
							<TabsContent value="sheet">
								<SheetFullEditor
									ruleId={character.ruleId}
									sheet={fullSheet}
									onChange={setFullSheet}
									showValidation={showValidation}
									onValidityChange={setSheetValid}
								/>
							</TabsContent>
						) : null}
						<TabsContent value="profile" className="flex flex-col gap-4">
							<SheetSection title={t("characterProfile.profileTab")}>
								<div className="grid gap-4 md:grid-cols-2">
									<TextField
										label={t("characterProfile.name")}
										value={name}
										required
										showValidation={showValidation}
										maxLength={100}
										onChange={setName}
									/>
									<div className="flex min-w-0 flex-col gap-1.5">
										<span className="text-md-on-surface-variant text-label-medium">
											{t("characterProfile.rule")}
										</span>
										<div>
											<Badge variant="soft" tone="accent">
												{character.ruleId}
											</Badge>
										</div>
									</div>
								</div>
								<TextField
									label={t("characterProfile.background")}
									value={background}
									multiline
									maxLength={4000}
									onChange={setBackground}
								/>
							</SheetSection>
							<ExpressionManager
								characterId={character.id}
								portraits={character.portraits}
								basePath={basePath}
								onChange={() => void refreshPortraits()}
							/>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</>
	);
}
