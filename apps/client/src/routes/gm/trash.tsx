import type { TrashItemDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/trash")({
	beforeLoad: () => requireGmAuth(),
	component: TrashPage,
});

function typeLabel(entityType: TrashItemDto["entityType"]): string {
	const key = `trash.type.${entityType}`;
	const label = t(key as never);
	return label === key ? entityType : label;
}

function TrashPage() {
	useI18nVersion();
	const [items, setItems] = useState<TrashItemDto[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const list = await api<{ items: TrashItemDto[] } | TrashItemDto[]>(
				"/trash",
			);
			setItems(Array.isArray(list) ? list : list.items);
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("trash.empty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function restore(item: TrashItemDto) {
		try {
			await api("/trash/restore", {
				method: "POST",
				body: JSON.stringify({ entityType: item.entityType, id: item.id }),
			});
			toast.success(t("trash.restored"));
			await load();
		} catch (error) {
			toast.error(errorText(error, "trash.restored"));
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title={t("trash.title")} />

			<Card className="overflow-hidden p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("trash.entityType")}</TableHead>
							<TableHead>{t("gm.templates.name")}</TableHead>
							<TableHead>{t("trash.deletedAt")}</TableHead>
							<TableHead>{t("trash.restore")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={4}>{t("common.loading")}</TableCell>
							</TableRow>
						) : items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4}>{t("trash.empty")}</TableCell>
							</TableRow>
						) : (
							items.map((item) => (
								<TableRow key={`${item.entityType}:${item.id}`}>
									<TableCell>
										<Badge variant="soft" tone="default" size="sm">
											{typeLabel(item.entityType)}
										</Badge>
									</TableCell>
									<TableCell className="truncate">{item.name}</TableCell>
									<TableCell className="text-foreground-tertiary">
										{new Date(item.deletedAt).toLocaleString()}
									</TableCell>
									<TableCell>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => void restore(item)}
										>
											<RotateCcw className="size-3.5" />
											{t("trash.restore")}
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}
