import type { CharacterSyncDiffDto, CharacterSyncField } from "@cogm/shared";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";

const FIELD_OPTIONS: Array<{ value: CharacterSyncField; labelKey: string }> = [
	{ value: "name", labelKey: "gm.sync.fieldName" },
	{ value: "background", labelKey: "gm.sync.fieldBackground" },
	{ value: "sheet", labelKey: "gm.sync.fieldSheet" },
];

export function CharacterSyncDialog({
	open,
	onOpenChange,
	sessionId,
	characterId,
	onSynced,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionId: string | null;
	characterId: string | null;
	onSynced?: () => void;
}) {
	const [preview, setPreview] = useState<CharacterSyncDiffDto | null>(null);
	const [fields, setFields] = useState<CharacterSyncField[]>([
		"name",
		"background",
		"sheet",
	]);
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!open || !sessionId || !characterId) {
			return;
		}
		let cancelled = false;
		setPreview(null);
		setLoading(true);
		setError("");
		setFields(["name", "background", "sheet"]);
		void api<CharacterSyncDiffDto>(
			`/gm/sessions/${encodeURIComponent(sessionId)}/characters/${encodeURIComponent(characterId)}/sync-preview`,
		)
			.then((value) => {
				if (!cancelled) {
					setPreview(value);
				}
			})
			.catch((reason) => {
				if (!cancelled) {
					setError(errorText(reason, "gm.sync.loadFailed"));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open, sessionId, characterId]);

	function toggleField(field: CharacterSyncField, checked: boolean) {
		setFields((current) =>
			checked
				? [...new Set([...current, field])]
				: current.filter((item) => item !== field),
		);
	}

	async function apply() {
		if (!sessionId || !characterId || !preview || pending) {
			return;
		}
		if (fields.length === 0) {
			setError(t("gm.sync.selectField"));
			return;
		}
		setPending(true);
		setError("");
		try {
			await api(
				`/gm/sessions/${encodeURIComponent(sessionId)}/characters/${encodeURIComponent(characterId)}/sync`,
				{
					method: "POST",
					body: JSON.stringify({
						fields,
						expectedVersion: preview.currentVersion,
					}),
				},
			);
			toast.success(t("gm.sync.applied"));
			onOpenChange(false);
			onSynced?.();
		} catch (reason) {
			setError(errorText(reason, "gm.sync.applyFailed"));
		} finally {
			setPending(false);
		}
	}

	const sheetChanged = preview
		? preview.currentSheetJson !== preview.baseSheetJson
		: false;
	const nameChanged = preview
		? preview.currentName !== preview.baseName
		: false;
	const backgroundChanged = preview
		? preview.currentBackground !== preview.baseBackground
		: false;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{t("gm.sync.title")}</DialogTitle>
					<DialogDescription>{t("gm.sync.description")}</DialogDescription>
				</DialogHeader>
				{loading ? (
					<p className="text-foreground-secondary text-body-medium">
						{t("gm.sync.loading")}
					</p>
				) : error && !preview ? (
					<p role="alert" className="text-danger text-body-medium">
						{error}
					</p>
				) : preview ? (
					<div className="flex flex-col gap-4">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-foreground text-title-medium-emph">
								{preview.currentName}
							</span>
							<Badge variant="soft" tone="default" size="sm">
								v{preview.currentVersion}
							</Badge>
							<Badge variant="soft" tone="default" size="sm">
								{preview.sessionName}
							</Badge>
						</div>
						{preview.staleReview ? (
							<p className="rounded-xl bg-warning-soft px-3 py-2 text-body-medium text-warning-soft-foreground">
								{t("gm.sync.staleReview")}
							</p>
						) : null}
						<div className="flex flex-col gap-2 rounded-xl bg-md-surface-container p-3">
							{FIELD_OPTIONS.map((option) => {
								const changed =
									option.value === "name"
										? nameChanged
										: option.value === "background"
											? backgroundChanged
											: sheetChanged;
								return (
									<label
										key={option.value}
										htmlFor={`sync-${option.value}`}
										className="flex items-center gap-2 text-body-medium"
									>
										<Checkbox
											id={`sync-${option.value}`}
											checked={fields.includes(option.value)}
											onCheckedChange={(checked) =>
												toggleField(option.value, checked === true)
											}
										/>
										<span className="flex-1">{t(option.labelKey)}</span>
										<Badge
											variant="soft"
											tone={changed ? "accent" : "default"}
											size="sm"
										>
											{changed ? t("gm.sync.changed") : t("gm.sync.unchanged")}
										</Badge>
									</label>
								);
							})}
						</div>
						{preview.statePreview ? (
							<div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-1 rounded-xl bg-md-surface-container-high px-3 py-2 text-label-medium tabular-nums">
								<span />
								<span className="text-foreground-secondary">HP</span>
								<span className="text-foreground-secondary">MP</span>
								<span className="text-foreground-secondary">SAN</span>
								<span className="text-foreground-secondary">
									{t("gm.sync.current")}
								</span>
								<span>
									{preview.statePreview.current.hp}/
									{preview.statePreview.current.maxHp}
								</span>
								<span>
									{preview.statePreview.current.mp}/
									{preview.statePreview.current.maxMp}
								</span>
								<span>
									{preview.statePreview.current.san}/
									{preview.statePreview.current.maxSan}
								</span>
								<span className="text-foreground-secondary">
									{t("gm.sync.after")}
								</span>
								<span>
									{preview.statePreview.next.hp}/
									{preview.statePreview.next.maxHp}
								</span>
								<span>
									{preview.statePreview.next.mp}/
									{preview.statePreview.next.maxMp}
								</span>
								<span>
									{preview.statePreview.next.san}/
									{preview.statePreview.next.maxSan}
								</span>
							</div>
						) : null}
						{error ? (
							<p role="alert" className="text-danger text-body-medium">
								{error}
							</p>
						) : null}
					</div>
				) : null}
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
						disabled={loading || pending || !preview}
						onClick={() => void apply()}
					>
						<RefreshCw className={pending ? "animate-spin" : undefined} />
						{t("gm.sync.apply")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
