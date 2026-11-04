import type { TrashItemDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/trash")({
	beforeLoad: () => requireGmAuth(),
	component: TrashPage,
});

const TYPE_ORDER: TrashItemDto["entityType"][] = [
	"module",
	"scene",
	"track",
	"handout",
	"character",
	"session",
	"template",
	"media",
	"user",
];

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

	const groups = TYPE_ORDER.map((type) => ({
		type,
		items: items.filter((item) => item.entityType === type),
	})).filter((group) => group.items.length > 0);

	return (
		<AdminLayout>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("trash.title")}
					description={t("trash.description")}
				/>

				{loading ? (
					<ListSkeleton rows={3} />
				) : items.length === 0 ? (
					<EmptyState
						icon={Trash2}
						title={t("trash.empty")}
						description={t("trash.emptyHint")}
					/>
				) : (
					<div className="flex flex-col gap-4">
						<span className="text-foreground-secondary text-label-large">
							{t("trash.count", { count: items.length })}
						</span>
						{groups.map((group) => (
							<section
								key={group.type}
								className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container duration-500 ease-standard-default-spatial"
							>
								<div className="border-separator-secondary/60 flex items-center justify-between gap-3 border-b px-5 py-2.5">
									<h2 className="text-foreground font-sans text-title-medium-emph">
										{typeLabel(group.type)}
									</h2>
									<span className="text-foreground-secondary text-label-large tabular-nums">
										{group.items.length}
									</span>
								</div>
								{group.items.map((item) => (
									<div
										key={`${item.entityType}:${item.id}`}
										className="border-separator-secondary/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:px-5"
									>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="text-foreground truncate text-label-large-emph">
												{item.name}
											</span>
											<span className="text-foreground-tertiary text-label-small md:hidden">
												{new Date(item.deletedAt).toLocaleString()}
											</span>
										</div>
										<span className="text-foreground-tertiary hidden text-body-small md:block">
											{new Date(item.deletedAt).toLocaleString()}
										</span>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="justify-self-end"
											onClick={() => void restore(item)}
										>
											<RotateCcw className="size-3.5" />
											{t("trash.restore")}
										</Button>
									</div>
								))}
							</section>
						))}
					</div>
				)}
			</div>
		</AdminLayout>
	);
}
