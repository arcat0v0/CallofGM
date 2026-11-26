import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
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
	const pickerId = useId();
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
	const SessionSheet = rule.sessionSheet;
	const ruleState = usePlayStore((state) => state.ruleState);
	const canPerform =
		isGm ||
		(claimed !== undefined && target?.characterId === claimed.characterId);

	function perform(
		skillKey: string,
		options?: unknown,
		label = rule.skillLabel(skillKey),
	) {
		if (!target?.characterId) {
			return;
		}
		const sent = sendSessionCommand("check:perform", {
			characterId: target.characterId,
			skillKey,
			difficulty: "regular",
			bonusDice: 0,
			penaltyDice: 0,
			...(options ? { options } : {}),
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
			return;
		}
		toast.success(t("check.submitted", { skill: label }));
	}

	return (
		<Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
			<DialogContent className="max-w-3xl auto-rows-max gap-3">
				<DialogHeader className="pr-10">
					<DialogTitle>{target?.name ?? t("sheet.titleFallback")}</DialogTitle>
					<DialogDescription>
						{canPerform
							? t("sheet.description")
							: t("sheet.descriptionTeammate")}
					</DialogDescription>
				</DialogHeader>
				{options.length > 1 ? (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={pickerId}>{t("sheet.selectCharacter")}</Label>
						<Select
							value={target?.characterId ?? ""}
							onValueChange={setSelectedId}
						>
							<SelectTrigger id={pickerId} className="h-11">
								<SelectValue />
							</SelectTrigger>
							<SelectContent position="popper" align="start">
								<SelectGroup>
									{options.map((character) => (
										<SelectItem
											key={character.characterId}
											value={character.characterId}
										>
											{character.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				) : null}
				{target ? (
					<SessionSheet
						key={target.ruleId}
						target={target}
						characters={characters}
						isGm={isGm}
						canPerform={canPerform}
						ruleState={ruleState}
						search={search}
						onSearchChange={setSearch}
						onPerform={perform}
					/>
				) : (
					<p className="text-foreground-tertiary text-body-medium">
						{t("sheet.empty")}
					</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
