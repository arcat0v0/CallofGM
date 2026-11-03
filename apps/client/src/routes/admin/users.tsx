import type { UserDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	KeyRound,
	Plus,
	ShieldCheck,
	Trash2,
	UserCheck,
	UserX,
} from "lucide-react";
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
import { formatClock } from "@/lib/format";
import { requireAccount } from "@/lib/identity";
import { useIdentityStore } from "@/stores/identity-store";

export const Route = createFileRoute("/admin/users")({
	beforeLoad: () => requireAccount(["admin"]),
	component: AdminUsersPage,
});

const ROLES = ["admin", "gm", "pl"] as const;

function roleLabel(role: string): string {
	if (role === "admin") {
		return t("role.admin");
	}
	if (role === "pl") {
		return t("role.pl");
	}
	return t("role.gm");
}

function stateLabel(user: UserDto): string {
	if (user.deletedAt !== null) {
		return t("admin.deleted");
	}
	if (user.disabledAt !== null) {
		return t("admin.disabled");
	}
	return t("admin.enabled");
}

function AdminUsersPage() {
	useI18nVersion();
	const currentUserId = useIdentityStore(
		(state) => state.account?.userId ?? null,
	);
	const [users, setUsers] = useState<UserDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [resetTarget, setResetTarget] = useState<UserDto | null>(null);
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const list = await api<{ items: UserDto[] } | UserDto[]>(
				"/admin/users?includeDeleted=true",
			);
			setUsers(Array.isArray(list) ? list : list.items);
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("admin.usersEmpty"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function patchUser(user: UserDto, body: Record<string, unknown>) {
		try {
			await api(`/admin/users/${user.id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			});
			toast.success(t("admin.updated"));
			await load();
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("admin.updated"));
		}
	}

	async function handleResetPassword() {
		if (!resetTarget || !password) {
			return;
		}
		setPending(true);
		try {
			await api(`/admin/users/${resetTarget.id}/password`, {
				method: "POST",
				body: JSON.stringify({ password }),
			});
			toast.success(t("admin.resetPasswordDone"));
			setResetTarget(null);
			setPassword("");
		} catch (error) {
			toast.error(
				isApiError(error) ? error.message : t("account.passwordFailed"),
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title={t("admin.title")}
				actions={
					<Button
						type="button"
						variant="primary"
						onClick={() => setCreateOpen(true)}
					>
						<Plus />
						{t("admin.createUser")}
					</Button>
				}
			/>

			<Card className="overflow-hidden p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("admin.username")}</TableHead>
							<TableHead>{t("admin.roleLabel")}</TableHead>
							<TableHead>{t("admin.state")}</TableHead>
							<TableHead>{t("admin.resetPassword")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={4}>{t("common.loading")}</TableCell>
							</TableRow>
						) : users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4}>{t("admin.usersEmpty")}</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow key={user.id}>
									<TableCell className="font-mono">
										{user.username}
										{user.id === currentUserId ? (
											<Badge
												variant="soft"
												tone="accent"
												size="sm"
												className="ml-2"
											>
												{t("admin.you")}
											</Badge>
										) : null}
									</TableCell>
									<TableCell>
										<Badge variant="soft" tone="default" size="sm">
											{roleLabel(user.role)}
										</Badge>
									</TableCell>
									<TableCell>{stateLabel(user)}</TableCell>
									<TableCell>
										<div className="flex items-center gap-1">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												title={t("admin.resetPassword")}
												onClick={() => {
													setResetTarget(user);
													setPassword("");
												}}
											>
												<KeyRound />
											</Button>
											{user.deletedAt !== null ? (
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													title={t("admin.restore")}
													onClick={() =>
														void patchUser(user, { deleted: false })
													}
												>
													<UserCheck />
												</Button>
											) : (
												<>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														title={
															user.disabledAt === null
																? t("admin.disable")
																: t("admin.enable")
														}
														onClick={() =>
															void patchUser(user, {
																disabled: user.disabledAt === null,
															})
														}
													>
														{user.disabledAt === null ? (
															<UserX />
														) : (
															<ShieldCheck />
														)}
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														title={t("admin.delete")}
														onClick={() =>
															void patchUser(user, { deleted: true })
														}
													>
														<Trash2 />
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>

			<CreateUserDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={() => void load()}
			/>

			<Dialog
				open={resetTarget !== null}
				onOpenChange={(open) => (open ? undefined : setResetTarget(null))}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("admin.resetPassword")}</DialogTitle>
						<DialogDescription>{resetTarget?.username ?? ""}</DialogDescription>
					</DialogHeader>
					<FormField label={t("account.newPassword")} htmlFor="reset-password">
						<Input
							id="reset-password"
							type="password"
							value={password}
							autoComplete="new-password"
							onChange={(event) => setPassword(event.target.value)}
						/>
					</FormField>
					<DialogFooter>
						<Button
							type="button"
							variant="primary"
							disabled={pending || password.length === 0}
							onClick={() => void handleResetPassword()}
						>
							{t("admin.resetPassword")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function CreateUserDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
}) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState<string>("pl");
	const [pending, setPending] = useState(false);

	async function handleCreate() {
		if (!username.trim() || !password) {
			return;
		}
		setPending(true);
		try {
			await api("/admin/users", {
				method: "POST",
				body: JSON.stringify({ username: username.trim(), password, role }),
			});
			toast.success(t("admin.created"));
			onOpenChange(false);
			setUsername("");
			setPassword("");
			setRole("pl");
			onCreated();
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("admin.created"));
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("admin.createUser")}</DialogTitle>
					<DialogDescription>{t("admin.roleLocked")}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<FormField label={t("admin.username")} htmlFor="new-username">
						<Input
							id="new-username"
							value={username}
							autoComplete="off"
							onChange={(event) => setUsername(event.target.value)}
						/>
					</FormField>
					<FormField label={t("admin.roleLabel")}>
						<Select value={role} onValueChange={setRole}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ROLES.map((item) => (
									<SelectItem key={item} value={item}>
										{roleLabel(item)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
					<FormField label={t("account.newPassword")} htmlFor="new-password">
						<Input
							id="new-password"
							type="password"
							value={password}
							autoComplete="new-password"
							onChange={(event) => setPassword(event.target.value)}
						/>
					</FormField>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="primary"
						disabled={pending || !username.trim() || !password}
						onClick={() => void handleCreate()}
					>
						{t("admin.createUser")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
