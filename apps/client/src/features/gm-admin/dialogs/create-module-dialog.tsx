import type { ThemeSummaryDto } from "@cogm/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";

function CreateModuleDialog({
	open,
	onOpenChange,
	themes,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	themes: ThemeSummaryDto[];
	onCreated?: () => void;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [themeId, setThemeId] = useState("");
	const [pending, setPending] = useState(false);

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error(t("gm.modules.nameRequired"));
			return;
		}
		setPending(true);
		try {
			await api("/gm/modules", {
				method: "POST",
				body: JSON.stringify({
					name: trimmed,
					description: description.trim(),
					ruleId: "coc7e",
					themeId: themeId || null,
				}),
			});
			onOpenChange(false);
			setName("");
			setDescription("");
			setThemeId("");
			onCreated?.();
		} catch (error) {
			toast.error(errorText(error, "gm.modules.createFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("gm.modules.createTitle")}</DialogTitle>
					<DialogDescription>{t("gm.modules.description")}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="module-name">{t("gm.modules.nameLabel")}</Label>
						<Input
							id="module-name"
							value={name}
							maxLength={100}
							placeholder={t("gm.modules.namePlaceholder")}
							autoFocus
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="module-description">
							{t("gm.modules.descriptionLabel")}
						</Label>
						<Textarea
							id="module-description"
							value={description}
							rows={3}
							placeholder={t("gm.modules.descriptionPlaceholder")}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<span className="text-md-on-surface-variant text-label-medium">
							{t("gm.modules.themeLabel")}
						</span>
						<Select
							value={themeId || "default"}
							onValueChange={(value) =>
								setThemeId(value === "default" ? "" : value)
							}
						>
							<SelectTrigger
								className="h-11"
								aria-label={t("gm.modules.theme")}
							>
								<SelectValue placeholder={t("gm.modules.themeDefault")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{t("gm.modules.themeDefault")}
								</SelectItem>
								{themes.map((theme) => (
									<SelectItem key={theme.id} value={theme.id}>
										{theme.name} ({theme.version})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
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
						disabled={pending || !name.trim()}
						onClick={() => void submit()}
					>
						<Plus />
						{t("gm.modules.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { CreateModuleDialog };
