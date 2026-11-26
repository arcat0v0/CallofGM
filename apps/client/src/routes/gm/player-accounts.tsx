import type { CreatePlayerAccountRequest, UserDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PlayerAccountForm } from "@/features/accounts/player-account-form";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { t, useI18nVersion } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/player-accounts")({
	beforeLoad: requireGmAuth,
	component: PlayerAccountsPage,
});

const ACCOUNTS_PATH = "/gm/player-accounts";

function PlayerAccountsPage() {
	useI18nVersion();
	const [players, setPlayers] = useState<UserDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [open, setOpen] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await api<{ items: UserDto[] }>(ACCOUNTS_PATH);
			setPlayers(result.items);
		} catch (cause) {
			setError(errorText(cause, "gm.playerAccounts.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function create(credentials: CreatePlayerAccountRequest) {
		await api<UserDto>(ACCOUNTS_PATH, {
			method: "POST",
			body: JSON.stringify(credentials),
		});
		setOpen(false);
		toast.success(t("gm.playerAccounts.created"));
		await load();
	}

	return (
		<AdminLayout>
			<div className="flex flex-col gap-5">
				<PageHeader
					title={t("gm.playerAccounts.title")}
					description={t("gm.playerAccounts.description")}
					actions={
						<Dialog open={open} onOpenChange={setOpen}>
							<DialogTrigger asChild>
								<Button variant="primary">
									<Plus data-icon="inline-start" />
									{t("gm.playerAccounts.create")}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>{t("gm.playerAccounts.create")}</DialogTitle>
									<DialogDescription>
										{t("gm.playerAccounts.createHint")}
									</DialogDescription>
								</DialogHeader>
								<PlayerAccountForm
									submitLabel={t("admin.createUser")}
									onSubmit={create}
								/>
							</DialogContent>
						</Dialog>
					}
				/>
				{loading ? (
					<ListSkeleton />
				) : error ? (
					<EmptyState
						icon={Users}
						title={error}
						action={
							<Button variant="outline" onClick={() => void load()}>
								{t("common.retry")}
							</Button>
						}
					/>
				) : players.length === 0 ? (
					<EmptyState icon={Users} title={t("gm.playerAccounts.empty")} />
				) : (
					<Table aria-label={t("gm.playerAccounts.title")}>
						<TableHeader>
							<TableRow>
								<TableHead scope="col">{t("admin.username")}</TableHead>
								<TableHead scope="col">
									{t("gm.playerAccounts.source")}
								</TableHead>
								<TableHead scope="col">{t("admin.state")}</TableHead>
								<TableHead scope="col">
									{t("gm.playerAccounts.createdAt")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{players.map((player) => (
								<TableRow key={player.id}>
									<TableCell className="text-label-large-emph">
										{player.username}
									</TableCell>
									<TableCell>
										{t(`gm.playerAccounts.source.${player.creationSource}`)}
									</TableCell>
									<TableCell>
										<Badge
											variant="soft"
											size="sm"
											tone={player.disabledAt === null ? "success" : "warning"}
										>
											{t(
												player.disabledAt === null
													? "admin.enabled"
													: "admin.disabled",
											)}
										</Badge>
									</TableCell>
									<TableCell className="tabular-nums">
										{formatStamp(player.createdAt)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>
		</AdminLayout>
	);
}
