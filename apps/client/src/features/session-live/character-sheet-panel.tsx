import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
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
