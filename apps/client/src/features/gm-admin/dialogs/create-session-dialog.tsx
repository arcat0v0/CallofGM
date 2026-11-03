import type {
	CharacterDto,
	CreateSessionResponse,
	ModuleDto,
} from "@cogm/shared";
import { Link } from "@tanstack/react-router";
import { Check, Package, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SegmentedControl } from "@/components/shared/segmented-control";
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
import { api, fetchAllPages } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";

const statusOptions = ["waiting", "preparing", "active"] as const;

function kindLabel(kind: string): string {
	return kind.toLowerCase() === "npc" ? t("common.npc") : t("common.pc");
}

function CreateSessionDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: () => void;
}) {
	const [modules, setModules] = useState<ModuleDto[]>([]);
	const [characters, setCharacters] = useState<CharacterDto[]>([]);
	const [moduleId, setModuleId] = useState<string>("");
	const [name, setName] = useState("");
	const [selectedIds, setSelectedIds] = useState(new Set<string>());
	const [status, setStatus] =
		useState<(typeof statusOptions)[number]>("waiting");
	const [pending, setPending] = useState(false);
	const statusSegments = statusOptions.map((option) => ({
		value: option,
		label: t(`status.${option}`),
	}));

	useEffect(() => {
		if (!open) {
			return;
		}
		setName("");
		void (async () => {
			try {
				const nextModules = await fetchAllPages<ModuleDto>("/gm/modules");
				setModules(nextModules);
				setModuleId((current) => current || nextModules[0]?.id || "");
			} catch (error) {
				toast.error(errorText(error, "gm.createSession.loadModulesFailed"));
			}
		})();
	}, [open]);

	useEffect(() => {
		if (!open || !moduleId) {
			setCharacters([]);
			return;
		}
		setSelectedIds(new Set());
		void fetchAllPages<CharacterDto>(
			`/gm/modules/${encodeURIComponent(moduleId)}/characters`,
		)
			.then(setCharacters)
			.catch((error) =>
				toast.error(errorText(error, "gm.createSession.loadCharactersFailed")),
			);
	}, [open, moduleId]);

	function toggleCharacter(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function handleCreate() {
		if (!moduleId || pending) {
			return;
		}
		setPending(true);
		try {
			const created = await api<CreateSessionResponse>("/gm/sessions", {
				method: "POST",
				body: JSON.stringify({
					moduleId,
					name: name.trim() || undefined,
					characterIds: [...selectedIds],
				}),
			});
			if (status === "preparing") {
				await api(
					`/gm/sessions/${encodeURIComponent(created.session.id)}/status`,
					{
						method: "POST",
						body: JSON.stringify({ status: "preparing" }),
					},
				);
			}
			if (status === "active") {
				await api(
					`/gm/sessions/${encodeURIComponent(created.session.id)}/status`,
					{
						method: "POST",
						body: JSON.stringify({ status: "preparing" }),
					},
				);
				await api(
					`/gm/sessions/${encodeURIComponent(created.session.id)}/status`,
					{
						method: "POST",
						body: JSON.stringify({ status: "active" }),
					},
				);
			}
			onOpenChange(false);
			onCreated?.();
		} catch (error) {
			toast.error(errorText(error, "gm.createSession.createFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-140 gap-0 p-0" showCloseButton={false}>
				<DialogHeader className="flex-row items-center justify-between px-5 py-[18px]">
					<div className="flex flex-col gap-0.5">
						<DialogTitle>{t("gm.createSession.title")}</DialogTitle>
						<DialogDescription>
							{t("gm.createSession.description")}
						</DialogDescription>
					</div>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("gm.createSession.close")}
						onClick={() => onOpenChange(false)}
					>
						<X />
					</Button>
				</DialogHeader>

				<div className="flex flex-col gap-4 px-5 py-5">
					<FormField label={t("gm.createSession.nameLabel")}>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("gm.createSession.namePlaceholder")}
							maxLength={60}
							aria-label={t("gm.createSession.nameAria")}
							className="h-10"
						/>
					</FormField>

					<FormField label={t("gm.createSession.selectModule")}>
						<Select value={moduleId} onValueChange={setModuleId}>
							<SelectTrigger className="h-10 border-separator-secondary">
								<Package className="text-accent-hover" />
								<SelectValue placeholder={t("gm.createSession.selectModule")} />
							</SelectTrigger>
							<SelectContent>
								{modules.map((module) => (
									<SelectItem key={module.id} value={module.id}>
										{module.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>

					<FormField label={t("gm.createSession.participants")}>
						<div className="flex flex-col gap-1.5">
							{characters.length === 0 ? (
								<p className="text-foreground-tertiary text-body-small">
									{t("gm.createSession.noCharacters")}
									{moduleId ? (
										<>
											{" "}
											<Link
												to="/gm/module/$moduleId"
												params={{ moduleId }}
												className="text-accent"
											>
												{t("gm.createSession.goLink")}
											</Link>
										</>
									) : null}
								</p>
							) : (
								characters.map((character) => {
									const selected = selectedIds.has(character.id);
									const kind = kindLabel(character.kind);
									return (
										<Label
											key={character.id}
											className={cn(
												"cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left",
												selected ? "bg-accent-soft" : "bg-surface-tertiary",
											)}
										>
											<Checkbox
												checked={selected}
												onCheckedChange={() => toggleCharacter(character.id)}
											/>
											<span className="text-foreground font-sans text-label-large-emph">
												{character.name}
											</span>
											<span className="flex-1" />
											<Badge
												variant="soft"
												tone={kind === "NPC" ? "warning" : "accent"}
												size="sm"
											>
												{kind}
											</Badge>
											<Badge
												variant="soft"
												tone={selected ? "accent" : "default"}
												size="sm"
											>
												{selected
													? t("gm.createSession.selected")
													: t("gm.createSession.unselected")}
											</Badge>
										</Label>
									);
								})
							)}
						</div>
					</FormField>

					<FormField label={t("gm.createSession.initialStatus")}>
						<SegmentedControl
							value={status}
							options={statusSegments}
							onValueChange={setStatus}
							className="h-[38px] rounded-md p-[3px]"
							itemClassName="h-full text-label-large"
						/>
					</FormField>
				</div>

				<DialogFooter className="bg-md-surface-container-low flex-row items-center justify-between rounded-b-xl px-5 py-4 sm:justify-between">
					<span className="text-foreground-tertiary font-sans text-label-small">
						{t("gm.createSession.footerHint")}
					</span>
					<div className="flex items-center gap-2.5">
						<Button
							variant="tertiary"
							size="sm"
							onClick={() => onOpenChange(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							variant="primary"
							size="sm"
							disabled={!moduleId || pending}
							onClick={() => void handleCreate()}
						>
							<Check className="size-4" />
							{t("gm.createSession.create")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { CreateSessionDialog };
