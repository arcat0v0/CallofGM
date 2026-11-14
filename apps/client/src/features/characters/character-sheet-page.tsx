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
import { ImageCropDialog } from "@/components/shared/image-crop-dialog";
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
	const [activeMainTab, setActiveMainTab] = useState(
		canEditSheet ? "sheet" : "profile",
	);
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const [saving, setSaving] = useState(false);
	const [sheetContext, setSheetContext] =
		useState<CharacterSheetContextResponse | null>(null);
	const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
	const [cropFileName, setCropFileName] = useState("portrait.png");

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

	useEffect(() => {
		return () => {
			if (cropSourceUrl) {
				URL.revokeObjectURL(cropSourceUrl);
			}
		};
	}, [cropSourceUrl]);

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
		const serializedBackground =
			sheetData === undefined
				? background
				: (rule.serializeBackground?.(sheetData, background) ?? background);
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

	async function uploadCroppedPortrait(blob: Blob) {
		try {
			const body = new FormData();
			body.append("file", blob, cropFileName);
			body.append("purpose", "portrait");
			body.append("filename", cropFileName);
			const asset = await api<{ id: string }>("/media/upload", {
				method: "POST",
				body,
			});
			await api(`${basePath}/${encodeURIComponent(character.id)}/portraits`, {
				method: "POST",
				body: JSON.stringify({
					label: t("expressions.defaultLabel"),
					portraitAssetId: asset.id,
					isDefault: true,
				}),
			});
			setCropSourceUrl(null);
			await refreshPortraits();
			toast.success(t("characterProfile.saved"));
		} catch (error) {
			toast.error(
				t("characterCreation.portraitUploadFailed", {
					reason: errorText(error, "error.fallback"),
				}),
			);
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

			<div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-4 py-6 md:px-6 lg:py-8">
				{canEditSheet ? null : (
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
								characterName={name}
								onCharacterNameChange={setName}
								background={background}
								onBackgroundChange={setBackground}
								portraitPreviewUrl={portraitUrl}
								onPickPortraitFile={(file) => {
									setCropFileName(file.name || "portrait.png");
									setCropSourceUrl(URL.createObjectURL(file));
								}}
								onManageExpressions={() => setActiveMainTab("profile")}
								sheetContext={sheetContext}
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
			<ImageCropDialog
				open={cropSourceUrl !== null}
				onOpenChange={(next) => {
					if (!next) {
						setCropSourceUrl(null);
					}
				}}
				imageUrl={cropSourceUrl}
				title={t("characterCreation.portraitCropTitle")}
				confirmLabel={t("characterCreation.portraitCropConfirm")}
				onConfirm={(blob) => void uploadCroppedPortrait(blob)}
			/>
		</>
	);
}
