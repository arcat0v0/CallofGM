import type {
	CharacterDetailDto,
	CharacterHistoryResponse,
} from "@cogm/shared";
import { History } from "lucide-react";
import { useEffect, useState } from "react";
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
import { formatStamp } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";

export function CharacterPermanentFieldDialog({
	open,
	onOpenChange,
	characterId,
	sessionId,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	characterId: string | null;
	sessionId: string | null;
	onSaved?: () => void;
}) {
	const [character, setCharacter] = useState<CharacterDetailDto | null>(null);
	const [history, setHistory] = useState<CharacterHistoryResponse | null>(null);
	const [field, setField] = useState("");
	const [value, setValue] = useState("");
	const [reason, setReason] = useState("");
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const rule = getRuleComponent(character?.ruleId);
	const sheet = rule.parseSheetJson(character?.sheetJson ?? "");
	const attributes = rule.attributeEntries(sheet);
	const fields = rule.metadata.permanentSheetFields.map((key) => ({
		key,
		label: rule.attributeLabel(key) ?? key,
		value: attributes.find((entry) => entry.key === key)?.value ?? null,
	}));
	const selected = fields.find((entry) => entry.key === field) ?? fields[0];

	useEffect(() => {
		if (!open || !characterId) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError("");
		setCharacter(null);
		setHistory(null);
		setReason("");
		void Promise.all([
			api<CharacterDetailDto>(
				`/gm/characters/${encodeURIComponent(characterId)}`,
			),
			api<CharacterHistoryResponse>(
				`/gm/characters/${encodeURIComponent(characterId)}/history`,
			),
		])
			.then(([detail, audit]) => {
				if (cancelled) {
					return;
				}
				setCharacter(detail);
				setHistory(audit);
				const nextRule = getRuleComponent(detail.ruleId);
				const nextSheet = nextRule.parseSheetJson(detail.sheetJson);
				const entries = nextRule.attributeEntries(nextSheet);
				const first = nextRule.metadata.permanentSheetFields[0] ?? "";
				setField(first);
				setValue(
					String(entries.find((entry) => entry.key === first)?.value ?? ""),
				);
			})
			.catch((reasonValue) => {
				if (!cancelled) {
					setError(errorText(reasonValue, "gm.permanent.loadFailed"));
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
	}, [open, characterId]);

	function selectField(next: string) {
		setField(next);
		const entry = fields.find((item) => item.key === next);
		setValue(
			entry?.value === null || entry?.value === undefined
				? ""
				: String(entry.value),
		);
	}

	async function submit() {
		if (!characterId || !character || pending) {
			return;
		}
		const parsed = Number.parseInt(value, 10);
		if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
			setError(t("gm.permanent.invalidValue"));
			return;
		}
		if (!reason.trim()) {
			setError(t("gm.permanent.reasonRequired"));
			return;
		}
		setPending(true);
		setError("");
		try {
			await api(
				`/gm/characters/${encodeURIComponent(characterId)}/permanent-field`,
				{
					method: "POST",
					body: JSON.stringify({
						field,
						value: parsed,
						reason: reason.trim(),
						sessionId: sessionId ?? undefined,
						expectedVersion: character.version,
					}),
				},
			);
			toast.success(t("gm.permanent.saved"));
			onOpenChange(false);
			onSaved?.();
		} catch (reasonValue) {
			setError(errorText(reasonValue, "gm.permanent.saveFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{t("gm.permanent.title")}</DialogTitle>
					<DialogDescription>{t("gm.permanent.description")}</DialogDescription>
				</DialogHeader>
				{loading ? (
					<p className="text-foreground-secondary text-body-medium">
						{t("common.loading")}
					</p>
				) : character ? (
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-2">
							<span className="text-foreground text-title-medium-emph">
								{character.name}
							</span>
							<Badge variant="soft" tone="default" size="sm">
								v{character.version}
							</Badge>
						</div>
						<div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="permanent-field">
									{t("gm.permanent.field")}
								</Label>
								<Select value={selected?.key ?? ""} onValueChange={selectField}>
									<SelectTrigger id="permanent-field">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{fields.map((entry) => (
											<SelectItem key={entry.key} value={entry.key}>
												{entry.label}
												{entry.value === null ? "" : ` · ${entry.value}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="permanent-value">
									{t("gm.permanent.value")}
								</Label>
								<Input
									id="permanent-value"
									type="number"
									min={1}
									max={99}
									value={value}
									onInput={(event) => setValue(event.currentTarget.value)}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="permanent-reason">
								{t("gm.permanent.reason")}
							</Label>
							<Textarea
								id="permanent-reason"
								value={reason}
								maxLength={500}
								rows={2}
								placeholder={t("gm.permanent.reasonPlaceholder")}
								onChange={(event) => setReason(event.target.value)}
							/>
						</div>
						{error ? (
							<p role="alert" className="text-danger text-body-medium">
								{error}
							</p>
						) : null}
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<History className="text-foreground-secondary size-4" />
								<span className="text-foreground text-label-large-emph">
									{t("gm.permanent.auditTitle")}
								</span>
							</div>
							{history && history.audits.length > 0 ? (
								<div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
									{history.audits.slice(0, 8).map((audit) => (
										<div
											key={audit.id}
											className="rounded-lg bg-md-surface-container px-3 py-2 text-label-small"
										>
											<span className="text-foreground">
												{rule.attributeLabel(audit.field) ?? audit.field}{" "}
												{audit.oldValue} → {audit.newValue}
											</span>
											<span className="text-foreground-tertiary">
												{" · "}
												{formatStamp(audit.createdAt)}
												{audit.reason ? ` · ${audit.reason}` : ""}
											</span>
										</div>
									))}
								</div>
							) : (
								<p className="text-foreground-tertiary text-body-small">
									{t("gm.permanent.auditEmpty")}
								</p>
							)}
						</div>
					</div>
				) : (
					<p role="alert" className="text-danger text-body-medium">
						{error || t("gm.permanent.loadFailed")}
					</p>
				)}
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
						disabled={loading || pending || !character}
						onClick={() => void submit()}
					>
						{t("gm.permanent.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
