import type { ModuleDto, TemplateDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Layers, Plus, Rocket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
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
		<div className="flex flex-col gap-6">
			<PageHeader
				title={t("gm.templates.title")}
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
				<p className="text-foreground-tertiary">{t("common.loading")}</p>
			) : templates.length === 0 ? (
				<p className="text-foreground-tertiary">{t("gm.templates.empty")}</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{templates.map((template) => (
						<Card key={template.id} className="flex flex-col gap-3 p-5">
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className="truncate text-title-medium-emph">
										{template.name}
									</span>
									<span className="text-foreground-tertiary font-mono text-label-small">
										{template.ruleId} · v{template.currentVersion}
									</span>
								</div>
								<Badge variant="soft" tone="default" size="sm">
									<Layers className="size-3" />
								</Badge>
							</div>

							<div className="text-foreground-secondary flex flex-wrap gap-x-3 gap-y-1 text-label-small">
								<span>
									{t("gm.templates.scenes")} {template.sceneCount}
								</span>
								<span>
									{t("gm.templates.handouts")} {template.handoutCount}
								</span>
							</div>

							<div className="text-foreground-tertiary flex items-center gap-1 text-label-small">
								<Clock className="size-3" />
								{new Date(template.createdAt).toLocaleDateString()}
							</div>

							<div className="mt-auto flex flex-wrap gap-2">
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
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void saveVersion(template)}
								>
									{t("gm.templates.saveVersion")}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									title={t("gm.templates.delete")}
									onClick={() => void remove(template)}
								>
									<Trash2 />
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}

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
		</div>
	);
}
