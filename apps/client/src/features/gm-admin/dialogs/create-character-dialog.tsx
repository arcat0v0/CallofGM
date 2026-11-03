import type { CharacterDto, coc7e } from "@cogm/shared";
import { useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
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
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";

const DEFAULT_SHEET: coc7e.Coc7eCharacterSheet = {
	schemaVersion: 1,
	attributes: {
		str: 50,
		con: 50,
		siz: 50,
		dex: 50,
		app: 50,
		int: 50,
		pow: 50,
		edu: 50,
		luck: 50,
	},
	skills: {},
};

export function CreateCharacterDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: (created: CharacterDto) => void;
}) {
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"pc" | "npc">("pc");
	const [pending, setPending] = useState(false);

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error(t("gm.createCharacter.nameRequired"));
			return;
		}
		setPending(true);
		try {
			const created = await api<CharacterDto>("/gm/characters", {
				method: "POST",
				body: JSON.stringify({
					name: trimmed,
					kind,
					ruleId: "coc7e",
					sheetData: DEFAULT_SHEET,
				}),
			});
			onOpenChange(false);
			setName("");
			onCreated?.(created);
		} catch (error) {
			toast.error(errorText(error, "gm.createCharacter.createFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("gm.createCharacter.title")}</DialogTitle>
					<DialogDescription>
						{t("gm.createCharacter.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="character-name">
							{t("gm.createCharacter.name")}
						</Label>
						<Input
							id="character-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<SegmentedControl
						value={kind}
						options={[
							{ value: "pc", label: t("common.pc") },
							{ value: "npc", label: t("common.npc") },
						]}
						onValueChange={(value) => setKind(value as "pc" | "npc")}
					/>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="tertiary"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={pending}
						onClick={() => void submit()}
					>
						{t("gm.createCharacter.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
