import type {
	CharacterDetailDto,
	CharacterDto,
	CharacterSheetContextResponse,
} from "@cogm/shared";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SheetSection, TextField } from "@/components/shared/creation-form";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterBackgroundSummary } from "@/features/characters/character-background-summary";
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
	const canEditCharacter = scope === "pl" || character.ownerKind === "gm";
	const [name, setName] = useState(character.name);
	const [background, setBackground] = useState(character.background);
	const [version, setVersion] = useState(character.version);
	const [fullSheet, setFullSheet] = useState<unknown>(
		rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
	);
	const [activeMainTab, setActiveMainTab] = useState(
		canEditCharacter ? "sheet" : "profile",
	);
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const [saving, setSaving] = useState(false);
	const [sheetContext, setSheetContext] =
		useState<CharacterSheetContextResponse | null>(null);

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

	useEffect(() => {
		let cancelled = false;
		void api<CharacterSheetContextResponse>(
			`${basePath}/${encodeURIComponent(character.id)}/sheet-context`,
		)
			.then((context) => {
				if (!cancelled && context && Array.isArray(context.companions)) {
					setSheetContext(context);
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [basePath, character.id]);

	const overview = rule.sheetOverview(fullSheet);
	const defaultPortrait =
		character.portraits.find((portrait) => portrait.isDefault === 1) ??
		character.portraits[0];
	const portraitUrl = mediaUrl(defaultPortrait?.portraitAssetId);
	const backgroundIsDerived = rule.backgroundSource === "sheet";
	const backgroundSummary = backgroundIsDerived
		? (rule.capabilities?.sheetBackground?.serialize(fullSheet, background) ??
			background)
		: background;

	async function save() {
		if (saving || !canEditCharacter) {
			return;
		}
		const sheetData = canEditCharacter ? rule.parseSheet(fullSheet) : undefined;
		if (canEditCharacter && (!sheetData || !sheetValid)) {
			setShowValidation(true);
			toast.error(t("characterCreation.ruleValidationSummary"));
			return;
		}
		const serializedBackground =
			sheetData === undefined
				? background
				: (rule.capabilities?.sheetBackground?.serialize(
						sheetData,
						background,
					) ?? background);
		setSaving(true);
		try {
			const next = await api<CharacterDto>(
				`${basePath}/${encodeURIComponent(character.id)}`,
				{
					method: "PATCH",
					body: JSON.stringify({
						name: name.trim(),
						background: serializedBackground,
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
				<div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 py-3 md:px-6">
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
							{overview.map(({ label, value }) => (
								<Badge key={label} variant="soft" tone="default" size="sm">
									{value}
								</Badge>
							))}
							<span className="text-foreground-tertiary font-mono text-label-small">
								{t("characterSheet.version", { version })}
							</span>
						</div>
					</div>
					{canEditCharacter ? (
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
					) : null}
				</div>
			</header>

			<div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
				{canEditCharacter ? null : (
					<p
						role="status"
						className="rounded-xl bg-md-surface-container px-4 py-3 text-body-medium text-foreground-secondary"
					>
						{t("characterProfile.permanentOnly")}
					</p>
				)}
				<Tabs
					value={activeMainTab}
					onValueChange={setActiveMainTab}
					className="gap-4"
				>
					<div className="flex flex-col gap-2">
						<TabsList>
							{canEditCharacter ? (
								<TabsTrigger value="sheet">
									{t("characterProfile.sheetTab")}
								</TabsTrigger>
							) : null}
							<TabsTrigger value="profile">
								{t("characterProfile.profileTab")}
							</TabsTrigger>
						</TabsList>
						{activeMainTab === "sheet" ? (
							<p className="text-body-small text-foreground-tertiary">
								{t("characterProfile.sheetHint")}
							</p>
						) : null}
					</div>
					{canEditCharacter ? (
						<TabsContent value="sheet">
							<SheetFullEditor
								ruleId={character.ruleId}
								sheet={fullSheet}
								onChange={setFullSheet}
								showValidation={showValidation}
								onValidityChange={setSheetValid}
								sheetContext={sheetContext}
							/>
						</TabsContent>
					) : null}
					<TabsContent value="profile" className="flex flex-col gap-4">
						<SheetSection
							title={t("characterProfile.profileTab")}
							description={
								canEditCharacter
									? t("characterProfile.profileSectionHint")
									: t("characterProfile.profileReadOnlyHint")
							}
						>
							<div className="grid gap-4 md:grid-cols-2">
								{canEditCharacter ? (
									<TextField
										label={t("characterProfile.name")}
										value={name}
										required
										showValidation={showValidation}
										maxLength={100}
										onChange={setName}
									/>
								) : (
									<div className="flex min-w-0 flex-col gap-1.5">
										<span className="text-md-on-surface-variant text-label-medium">
											{t("characterProfile.name")}
										</span>
										<p className="text-body-large text-foreground">{name}</p>
									</div>
								)}
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
							{backgroundIsDerived ? (
								<CharacterBackgroundSummary background={backgroundSummary} />
							) : (
								<TextField
									label={t("characterProfile.background")}
									value={background}
									multiline
									maxLength={4000}
									onChange={setBackground}
								/>
							)}
						</SheetSection>
						{canEditCharacter ? (
							<ExpressionManager
								characterId={character.id}
								portraits={character.portraits}
								basePath={basePath}
								onChange={() => void refreshPortraits()}
							/>
						) : null}
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
