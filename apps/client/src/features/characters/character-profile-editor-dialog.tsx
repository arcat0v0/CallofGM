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
import { Textarea } from "@/components/ui/textarea";
import type { PortraitBasePath } from "@/features/characters/expression-manager";
import { ExpressionManager } from "@/features/characters/expression-manager";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";

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
	const characterRef = useRef(character);

	useEffect(() => {
		setName(character.name);
		setBackground(character.background);
		setVersion(character.version);
	}, [character.id, character.version]);

	useEffect(() => {
		characterRef.current = character;
	}, [character]);

	async function save() {
		if (saving) {
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
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{t("characterProfile.editTitle")}</DialogTitle>
					<DialogDescription>
						{t("characterProfile.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex items-end gap-3">
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<span className="text-md-on-surface-variant text-label-medium">
								{t("characterProfile.name")}
							</span>
							<Input
								value={name}
								maxLength={100}
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
					<ExpressionManager
						characterId={character.id}
						portraits={character.portraits}
						basePath={basePath}
						onChange={() => void refreshPortraits()}
					/>
				</div>
				<DialogFooter>
					<Button type="button" variant="tertiary" onClick={onClose}>
						{t("common.close")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={saving || !name.trim()}
						onClick={() => void save()}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
