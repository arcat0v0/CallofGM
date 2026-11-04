import type { ModuleDto, TemplateDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Ellipsis, Layers, Plus, Rocket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/templates")({
	beforeLoad: () => requireGmAuth(),
	component: TemplatesPage,
});

function TemplatesPage() {
	useI18nVersion();
	const [templates, setTemplates] = useState<TemplateDto[]>([]);
	const [modules, setModules] = useState<ModuleDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [sourceModuleId, setSourceModuleId] = useState<string>("");
	const [pending, setPending] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [list, moduleList] = await Promise.all([
				fetchAllPages<TemplateDto>("/gm/templates"),
				fetchAllPages<ModuleDto>("/gm/modules"),
			]);
			setTemplates(list);
			setModules(moduleList);
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("gm.templates.empty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleCreate() {
		if (!name.trim() || !sourceModuleId) {
			return;
		}
		setPending(true);
		try {
			const source = modules.find((item) => item.id === sourceModuleId);
			await api("/gm/templates", {
				method: "POST",
				body: JSON.stringify({
					name: name.trim(),
					description: "",
					ruleId: source?.ruleId ?? "coc7e",
					sourceModuleId,
				}),
			});
			toast.success(t("gm.templates.created"));
			setCreateOpen(false);
			setName("");
			setSourceModuleId("");
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.templates.created"));
		} finally {
			setPending(false);
		}
	}

	async function instantiate(template: TemplateDto, quickStart: boolean) {
		try {
			const result = await api<{ moduleId: string; sessionId: string | null }>(
				`/gm/templates/${template.id}/instantiate`,
				{
					method: "POST",
					body: JSON.stringify(
						quickStart
							? { quickStart: true, sessionName: template.name }
							: { name: `${template.name} 副本` },
					),
				},
			);
			toast.success(
				quickStart
					? t("gm.templates.quickStarted")
					: t("gm.templates.instantiated"),
			);
			await load();
			return result;
		} catch (error) {
			toast.error(errorText(error, "gm.templates.instantiated"));
			return null;
		}
	}

	async function saveVersion(template: TemplateDto) {
		try {
			await api(`/gm/templates/${template.id}/versions`, {
				method: "POST",
				body: JSON.stringify({}),
			});
			toast.success(t("gm.templates.saveVersion"));
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.templates.saveVersion"));
		}
	}

	async function remove(template: TemplateDto) {
		try {
			await api(`/gm/templates/${template.id}`, { method: "DELETE" });
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.templates.delete"));
		}
	}

	return (
		<AdminLayout>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("gm.templates.title")}
					description={t("gm.templates.description")}
					actions={
						<Button
							type="button"
							variant="primary"
							onClick={() => setCreateOpen(true)}
						>
							<Plus />
							{t("gm.templates.create")}
						</Button>
					}
				/>

				{loading ? (
					<ListSkeleton rows={3} />
				) : templates.length === 0 ? (
					<EmptyState
						icon={Layers}
						title={t("gm.templates.empty")}
						description={t("gm.templates.emptyHint")}
						action={
							<Button
								type="button"
								variant="primary"
								onClick={() => setCreateOpen(true)}
							>
								<Plus />
								{t("gm.templates.create")}
							</Button>
						}
					/>
				) : (
					<div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container duration-500 ease-standard-default-spatial">
						{templates.map((template) => (
							<article
								key={template.id}
								className="border-separator-secondary/60 flex flex-col gap-4 border-b p-4 last:border-b-0 lg:flex-row lg:items-center lg:justify-between lg:gap-6"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="text-foreground truncate font-sans text-title-medium-emph">
											{template.name}
										</h2>
										<Badge variant="soft" tone="default" size="sm">
											v{template.currentVersion}
										</Badge>
									</div>
									<div className="text-foreground-tertiary text-label-small">
										{template.ruleId} ·{" "}
										{t("gm.templates.updatedAt", {
											time: formatStamp(template.updatedAt),
										})}
									</div>
									<div className="text-foreground-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-label-small">
										<span>
											{t("gm.templates.scenes")} {template.sceneCount}
										</span>
										<span>
											{t("gm.templates.handouts")} {template.handoutCount}
										</span>
										<span>
											{t("gm.templates.tracks")} {template.trackCount}
										</span>
										<span>
											{t("gm.templates.characters")} {template.characterCount}
										</span>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2 lg:shrink-0">
									<Button
										type="button"
										variant="primary"
										size="sm"
										onClick={() => void instantiate(template, false)}
									>
										{t("gm.templates.instantiate")}
									</Button>
									<Button
										type="button"
										variant="accentSoft"
										size="sm"
										onClick={() => void instantiate(template, true)}
									>
										<Rocket className="size-3.5" />
										{t("gm.templates.quickStart")}
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="text-foreground-secondary"
												aria-label={`${t("gm.templates.moreActions")} ${template.name}`}
											>
												<Ellipsis />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() => void saveVersion(template)}
											>
												<Layers />
												{t("gm.templates.saveVersion")}
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												onClick={() => void remove(template)}
											>
												<Trash2 />
												{t("gm.templates.delete")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</article>
						))}
					</div>
				)}
			</div>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("gm.templates.create")}</DialogTitle>
						<DialogDescription>{t("rules.hint")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<FormField label={t("gm.templates.name")} htmlFor="template-name">
							<Input
								id="template-name"
								value={name}
								maxLength={100}
								onChange={(event) => setName(event.target.value)}
							/>
						</FormField>
						<FormField label={t("gm.templates.source")}>
							<Select value={sourceModuleId} onValueChange={setSourceModuleId}>
								<SelectTrigger>
									<SelectValue />
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
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="primary"
							disabled={pending || !name.trim() || !sourceModuleId}
							onClick={() => void handleCreate()}
						>
							{t("gm.templates.create")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminLayout>
	);
}
