import type { CharacterDetailDto, CharacterDto } from "@cogm/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CharacterBackgroundSummary } from "@/features/characters/character-background-summary";
import type { PortraitBasePath } from "@/features/characters/expression-manager";
import { ExpressionManager } from "@/features/characters/expression-manager";
import { SheetFullEditor } from "@/features/characters/sheet-full-editor";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { getRuleComponent } from "@/rules/registry";

export function CharacterProfileEditorDialog({
	scope,
	character,
	open,
	onClose,
	onSaved,
}: {
	scope: "gm" | "pl";
	character: CharacterDetailDto;
	open: boolean;
	onClose: () => void;
	onSaved: (character: CharacterDetailDto) => void;
}) {
	const basePath: PortraitBasePath =
		scope === "gm" ? "/gm/characters" : "/pl/characters";
	const [name, setName] = useState(character.name);
	const [background, setBackground] = useState(character.background);
	const [version, setVersion] = useState(character.version);
	const [saving, setSaving] = useState(false);
	const [showValidation, setShowValidation] = useState(false);
	const [sheetValid, setSheetValid] = useState(true);
	const characterRef = useRef(character);
	const rule = getRuleComponent(character.ruleId);
	const canEditCharacter = scope === "pl" || character.ownerKind === "gm";
	const initialSheet = rule.parseSheetJson(character.sheetJson);
	const [fullSheet, setFullSheet] = useState<unknown>(
		initialSheet ?? rule.createEmptySheet(),
	);
	const backgroundIsDerived = rule.backgroundSource === "sheet";
	const backgroundSummary = backgroundIsDerived
		? (rule.serializeBackground?.(fullSheet, background) ?? background)
		: background;

	useEffect(() => {
		setName(character.name);
		setBackground(character.background);
		setVersion(character.version);
		setShowValidation(false);
		setFullSheet(
			rule.parseSheetJson(character.sheetJson) ?? rule.createEmptySheet(),
		);
	}, [
		character.version,
		character.name,
		character.background,
		character.sheetJson,
		rule,
	]);

	useEffect(() => {
		characterRef.current = character;
	}, [character]);

	async function save() {
		if (saving || !canEditCharacter) {
			return;
		}
		const sheetData = canEditCharacter
			? rule.parseSheet(fullSheet)
			: undefined;
		if (canEditCharacter && (!sheetData || !sheetValid)) {
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
			onSaved({
				...characterRef.current,
				...next,
			});
		} catch (error) {
			toast.error(errorText(error, "characterProfile.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	async function refreshPortraits() {
		try {
			const detail = await api<CharacterDetailDto>(
				`${basePath}/${encodeURIComponent(character.id)}`,
			);
			onSaved(detail);
		} catch (error) {
			toast.error(errorText(error, "characterProfile.refreshFailed"));
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
			<DialogContent
				className="flex max-h-[calc(100dvh-2rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0"
				onEscapeKeyDown={(event) => {
					const active = document.activeElement;
					if (
						active instanceof HTMLElement &&
						active.dataset.slot === "expression-rename-input"
					) {
						event.preventDefault();
					}
				}}
			>
				<DialogHeader className="border-separator-secondary/50 shrink-0 border-b px-6 pt-6 pb-4">
					<DialogTitle>{t("characterProfile.editTitle")}</DialogTitle>
					<DialogDescription>
						{t("characterProfile.description")}
					</DialogDescription>
				</DialogHeader>
				<Tabs
					defaultValue={canEditCharacter ? "sheet" : "profile"}
					className="min-h-0 flex-1 gap-0"
				>
					<TabsList className="mx-6 mt-4 shrink-0">
						{canEditCharacter ? (
							<TabsTrigger value="sheet">
								{t("characterProfile.sheetTab")}
							</TabsTrigger>
						) : null}
						<TabsTrigger value="profile">
							{t("characterProfile.profileTab")}
						</TabsTrigger>
					</TabsList>
					<TabsContent
						value="profile"
						className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
					>
						<div className="flex items-end gap-3">
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("characterProfile.name")}
								</span>
								<Input
									value={name}
									maxLength={100}
									readOnly={!canEditCharacter}
									onChange={(event) => setName(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("characterProfile.rule")}
								</span>
								<Badge variant="soft" tone="accent">
									{character.ruleId}
								</Badge>
							</div>
						</div>
						{backgroundIsDerived ? (
							<CharacterBackgroundSummary background={backgroundSummary} />
						) : (
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("characterProfile.background")}
								</span>
								<Textarea
									value={background}
									maxLength={4000}
									rows={4}
									onChange={(event) => setBackground(event.target.value)}
								/>
							</div>
						)}
						{canEditCharacter ? (
							<ExpressionManager
								characterId={character.id}
								portraits={character.portraits}
								basePath={basePath}
								onChange={() => void refreshPortraits()}
							/>
						) : null}
						{canEditCharacter ? null : (
							<p className="text-foreground-secondary text-body-medium">
								{t("characterProfile.permanentOnly")}
							</p>
						)}
						<Separator />
					</TabsContent>
					{canEditCharacter ? (
						<TabsContent
							value="sheet"
							className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
						>
							<SheetFullEditor
								ruleId={character.ruleId}
								sheet={fullSheet}
								onChange={setFullSheet}
								showValidation={showValidation}
								onValidityChange={setSheetValid}
							/>
						</TabsContent>
					) : null}
				</Tabs>
				<DialogFooter className="border-separator-secondary/50 shrink-0 border-t px-6 py-4">
					<Button type="button" variant="tertiary" onClick={onClose}>
						{t("common.close")}
					</Button>
						{canEditCharacter ? (
							<Button
								type="button"
								variant="primary"
								disabled={saving || !name.trim()}
								onClick={() => void save()}
							>
								{t("common.save")}
							</Button>
						) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
