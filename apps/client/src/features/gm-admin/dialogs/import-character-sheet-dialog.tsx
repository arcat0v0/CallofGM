import type { CharacterImportPreviewResponse } from "@cogm/shared";
import {
	ArrowLeft,
	Check,
	CircleCheck,
	FileSpreadsheet,
	Info,
	TriangleAlert,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { FALLBACK_RULE_ID, getRuleComponent } from "@/rules/registry";

function ImportCharacterSheetDialog({
	open,
	onOpenChange,
	onImported,
	updateCharacterId,
	expectedVersion,
	ruleId = FALLBACK_RULE_ID,
	scope = "gm",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImported?: () => void;
	updateCharacterId?: string | null;
	expectedVersion?: number | undefined;
	ruleId?: string;
	scope?: "gm" | "pl";
}) {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<CharacterImportPreviewResponse | null>(
		null,
	);
	const [kind, setKind] = useState<"pc" | "npc">("pc");
	const [pending, setPending] = useState(false);

	async function uploadPreview(next: File) {
		setPending(true);
		try {
			const body = new FormData();
			body.append("file", next);
			body.append("ruleId", ruleId);
			const query = updateCharacterId
				? `?characterId=${encodeURIComponent(updateCharacterId)}`
				: "";
			const result = await api<CharacterImportPreviewResponse>(
				`/${scope}/characters/import/preview${query}`,
				{ method: "POST", body },
			);
			setFile(next);
			setPreview(result);
		} catch (error) {
			toast.error(errorText(error, "gm.importSheet.parseFailed"));
		} finally {
			setPending(false);
		}
	}

	async function confirm() {
		if (!preview) {
			return;
		}
		if (preview.preview.errors.length > 0) {
			toast.error(t("gm.importSheet.errors"));
			return;
		}
		setPending(true);
		try {
			await api(`/${scope}/characters/import/confirm`, {
				method: "POST",
				body: JSON.stringify({
					importToken: preview.importToken,
					kind: scope === "pl" ? "pc" : kind,
					...(updateCharacterId ? { characterId: updateCharacterId } : {}),
					...(expectedVersion === undefined ? {} : { expectedVersion }),
				}),
			});
			toast.success(
				updateCharacterId
					? t("gm.importSheet.updated")
					: t("gm.importSheet.imported"),
			);
			onOpenChange(false);
			setPreview(null);
			setFile(null);
			onImported?.();
		} catch (error) {
			toast.error(errorText(error, "gm.importSheet.importFailed"));
		} finally {
			setPending(false);
		}
	}

	const rule = getRuleComponent(ruleId);
	const sheet = preview ? rule.parseSheet(preview.preview.sheetData) : null;
	const attributes = Object.fromEntries(
		rule.attributeEntries(sheet).map(({ key, value }) => [key, value]),
	);
	const skills = (sheet ? rule.skillEntries(sheet) : []).slice(0, 6);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-160 gap-0 p-0" showCloseButton={false}>
				<DialogHeader className="flex-row items-center justify-between px-5 py-[18px]">
					<div className="flex flex-col gap-0.5">
						<DialogTitle>
							{updateCharacterId
								? t("gm.importSheet.updateTitle")
								: t("gm.importSheet.title")}
						</DialogTitle>
						<DialogDescription>
							{updateCharacterId
								? t("gm.importSheet.updateDescription")
								: t("gm.importSheet.description")}
						</DialogDescription>
					</div>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("gm.importSheet.close")}
						onClick={() => onOpenChange(false)}
					>
						<X />
					</Button>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-5 py-5">
					<Input
						type="file"
						accept=".xlsx,.xls"
						aria-label={t("gm.importSheet.chooseFile")}
						onChange={(event) => {
							const next = event.target.files?.[0];
							if (next) {
								void uploadPreview(next);
							}
						}}
					/>
					{file ? (
						<div className="flex items-center gap-2">
							<FileSpreadsheet className="text-accent-hover size-4" />
							<span className="text-foreground text-body-medium">
								{file.name}
							</span>
						</div>
					) : null}
					{preview ? (
						<>
							<div className="flex items-center gap-2">
								<span className="text-foreground font-sans text-title-medium-emph">
									{preview.preview.characterName}
								</span>
								<Badge
									variant="soft"
									tone={kind === "pc" ? "accent" : "default"}
									size="sm"
								>
									{kind.toUpperCase()}
								</Badge>
								<Button
									type="button"
									size="sm"
									variant="tertiary"
									className="h-7"
									disabled={scope === "pl"}
									onClick={() => setKind(kind === "pc" ? "npc" : "pc")}
								>
									{t("gm.importSheet.switchKind", {
										kind: kind === "pc" ? "NPC" : "PC",
									})}
								</Button>
							</div>
							<p className="text-foreground-secondary text-body-small">
								STR {attributes.str ?? "—"} / DEX {attributes.dex ?? "—"} / INT{" "}
								{attributes.int ?? "—"}
							</p>
							<p className="text-foreground-secondary text-body-small">
								{skills
									.map(({ key, value }) => `${rule.skillLabel(key)} ${value}`)
									.join(" · ")}
							</p>
							{preview.preview.providedFields.length > 0 ? (
								<p className="text-foreground-tertiary text-label-small">
									{t("gm.importSheet.providedFields", {
										count: preview.preview.providedFields.length,
									})}
								</p>
							) : null}
							{preview.preview.errors.length > 0 ? (
								<Alert>
									<AlertIcon>
										<TriangleAlert />
									</AlertIcon>
									<AlertDescription>
										{preview.preview.errors
											.map((error) => error.message)
											.join("；")}
									</AlertDescription>
								</Alert>
							) : (
								<Alert>
									<AlertIcon>
										<CircleCheck />
									</AlertIcon>
									<AlertDescription>
										{t("gm.importSheet.noErrors")}
									</AlertDescription>
								</Alert>
							)}
							{preview.preview.warnings.length > 0 ? (
								<Alert>
									<AlertIcon>
										<Info />
									</AlertIcon>
									<AlertDescription>
										{preview.preview.warnings
											.map((warning) => warning.message)
											.join("；")}
									</AlertDescription>
								</Alert>
							) : null}
						</>
					) : null}
				</div>
				<div className="bg-md-surface-container-low flex items-center justify-between rounded-b-xl px-5 py-4">
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						<ArrowLeft />
						{t("common.cancel")}
					</Button>
					<Button
						variant="primary"
						size="sm"
						disabled={!preview || pending}
						onClick={() => void confirm()}
					>
						<Check className={cn("size-4", pending && "opacity-50")} />
						{updateCharacterId
							? t("gm.importSheet.confirmUpdate")
							: t("gm.importSheet.confirm")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export { ImportCharacterSheetDialog };
