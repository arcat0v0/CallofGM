import type {
	CharacterDetailDto,
	CharacterDto,
	CharacterHistoryResponse,
	CharacterSheetContextResponse,
} from "@cogm/shared";
import { ChevronLeft, Save, UserRound } from "lucide-react";
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
import { PortraitGalleryReadOnly } from "@/features/characters/portrait-gallery-readonly";
import { SheetFullEditor } from "@/features/characters/sheet-full-editor";
import { SheetFullViewer } from "@/features/characters/sheet-full-viewer";
import { t, useI18nVersion } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { getRuleComponent } from "@/rules/registry";

export function CharacterSheetPage({
	scope,
	characterId,
	backLabel,
	onBack,
}: {
	scope: "pl" | "gm";
	characterId: string;
	backLabel?: string;
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
					backLabel={backLabel}
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
									{backLabel ?? t("characterSheet.back")}
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
	backLabel,
	onCharacterChange,
	onBack,
}: {
	scope: "pl" | "gm";
	basePath: PortraitBasePath;
	character: CharacterDetailDto;
	backLabel?: string;
	onCharacterChange: (character: CharacterDetailDto) => void;
	onBack: () => void;
}) {
	const rule = getRuleComponent(character.ruleId);
	const canEditCharacter = scope === "pl" || character.ownerKind === "gm";
	const extractDetailedBackground = useCallback(
		(sheet: unknown, raw: string | undefined) =>
			rule.capabilities?.sheetBackground?.extractDetailedBackground?.(
				sheet,
				raw ?? "",
			) ??
			raw ??
			"",
		[rule],
	);
	const [name, setName] = useState(character.name);
	const [fullSheet, setFullSheet] = useState<unknown>(
		() => rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
	);
	const [background, setBackground] = useState(() =>
		extractDetailedBackground(
			rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
			character.background,
		),
	);
	const [version, setVersion] = useState(character.version);
	const [activeMainTab, setActiveMainTab] = useState("sheet");
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const [saving, setSaving] = useState(false);
	const [sheetContext, setSheetContext] =
		useState<CharacterSheetContextResponse | null>(null);
	const [history, setHistory] = useState<CharacterHistoryResponse | null>(null);

	useEffect(() => {
		const parsed =
			rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet();
		setName(character.name);
		setFullSheet(parsed);
		setBackground(extractDetailedBackground(parsed, character.background));
		setVersion(character.version);
		setShowValidation(false);
	}, [
		character.name,
		character.background,
		character.version,
		character.sheetJson,
		extractDetailedBackground,
		rule,
	]);

	useEffect(() => {
		let cancelled = false;
		setSheetContext(null);
		setHistory(null);
		void api<CharacterSheetContextResponse>(
			`${basePath}/${encodeURIComponent(character.id)}/sheet-context`,
		)
			.then((context) => {
				if (!cancelled && context && Array.isArray(context.companions)) {
					setSheetContext(context);
				}
			})
			.catch(() => undefined);
		void api<CharacterHistoryResponse>(
			`${basePath}/${encodeURIComponent(character.id)}/history`,
		)
			.then((nextHistory) => {
				if (
					!cancelled &&
					nextHistory &&
					Array.isArray(nextHistory.growth) &&
					Array.isArray(nextHistory.audits)
				) {
					setHistory(nextHistory);
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
	const hasStructuredBackground = Boolean(
		rule.capabilities?.sheetBackground?.renderSummary,
	);

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
		setSaving(true);
		try {
			const next = await api<CharacterDto>(
				`${basePath}/${encodeURIComponent(character.id)}`,
				{
					method: "PATCH",
					body: JSON.stringify({
						name: name.trim(),
						background: background.trim(),
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
						<ChevronLeft />
						{backLabel ?? t("characterSheet.back")}
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
							<TabsTrigger value="sheet">
								{t("characterProfile.sheetTab")}
							</TabsTrigger>
							<TabsTrigger value="profile">
								{t("characterProfile.profileTab")}
							</TabsTrigger>
						</TabsList>
						{activeMainTab === "sheet" ? (
							<p className="text-body-small text-foreground-tertiary">
								{canEditCharacter
									? t("characterProfile.sheetHint")
									: t("characterProfile.sheetReadOnlyHint")}
							</p>
						) : null}
					</div>
					<TabsContent value="sheet">
						{canEditCharacter ? (
							<SheetFullEditor
								ruleId={character.ruleId}
								sheet={fullSheet}
								onChange={setFullSheet}
								background={background}
								onBackgroundChange={setBackground}
								showValidation={showValidation}
								onValidityChange={setSheetValid}
								sheetContext={sheetContext}
							/>
						) : (
							<SheetFullViewer
								ruleId={character.ruleId}
								sheet={fullSheet}
								background={background}
								sheetContext={sheetContext}
								history={history}
							/>
						)}
					</TabsContent>
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
							{hasStructuredBackground ? (
								<CharacterBackgroundSummary
									ruleId={character.ruleId}
									sheet={fullSheet}
								/>
							) : null}
							{canEditCharacter ? (
								<TextField
									label={t("characterProfile.detailedBackground")}
									value={background}
									multiline
									maxLength={4000}
									placeholder={t("characterProfile.detailedBackgroundHint")}
									onChange={setBackground}
								/>
							) : (
								<div className="flex min-w-0 flex-col gap-1.5">
									<span className="text-md-on-surface-variant text-label-medium">
										{t("characterProfile.detailedBackground")}
									</span>
									<p className="text-foreground-secondary whitespace-pre-wrap rounded-2xl bg-md-surface-container px-4 py-3 text-body-medium select-text">
										{background.trim() ||
											t("characterProfile.detailedBackgroundEmpty")}
									</p>
								</div>
							)}
						</SheetSection>
						{canEditCharacter ? (
							<ExpressionManager
								characterId={character.id}
								portraits={character.portraits}
								basePath={basePath}
								onChange={() => void refreshPortraits()}
							/>
						) : (
							<PortraitGalleryReadOnly portraits={character.portraits} />
						)}
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
