import type { CharacterDto } from "@cogm/shared";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useRuleOptions } from "@/lib/rules-api";
import { getRuleComponent } from "@/rules/registry";

export function CreateCharacterDialog({
	open,
	onOpenChange,
	onCreated,
	defaultKind = "pc",
	lockKind = false,
	fixedRuleId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: (created: CharacterDto) => void;
	defaultKind?: "pc" | "npc";
	lockKind?: boolean;
	fixedRuleId?: string;
}) {
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"pc" | "npc">(defaultKind);
	const [pending, setPending] = useState(false);
	const ruleOptions = useRuleOptions();
	const rules = ruleOptions.rules;
	const ruleId = fixedRuleId ?? ruleOptions.ruleId;
	const setRuleId = ruleOptions.setRuleId;
	const rulesLoading = ruleOptions.loading;

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
					ruleId,
					sheetData: getRuleComponent(ruleId).createEmptySheet(),
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
					{lockKind ? null : (
						<SegmentedControl
							value={kind}
							options={[
								{ value: "pc", label: t("common.pc") },
								{ value: "npc", label: t("common.npc") },
							]}
							onValueChange={(value) => setKind(value as "pc" | "npc")}
						/>
					)}
					{fixedRuleId ? null : (
						<div className="flex flex-col gap-1.5">
							<span className="text-md-on-surface-variant text-label-medium">
								{t("rules.label")}
								<span className="text-foreground-tertiary ml-1.5 text-label-small">
									{t("rules.hint")}
								</span>
							</span>
							<Select
								value={ruleId}
								onValueChange={setRuleId}
								disabled={rulesLoading}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("rules.loading")} />
								</SelectTrigger>
								<SelectContent>
									{rules.map((rule) => (
										<SelectItem key={rule.id} value={rule.id}>
											{rule.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
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
