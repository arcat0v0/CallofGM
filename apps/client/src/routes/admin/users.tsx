import type { UserDto } from "@cogm/shared";
import { createFileRoute } from "@tanstack/react-router";
import {
	Ellipsis,
	KeyRound,
	Plus,
	ShieldCheck,
	Trash2,
	UserCheck,
	Users,
	UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ListSkeleton } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { AdminShell } from "@/features/admin/admin-shell";
import { t, useI18nVersion } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { requireAccount } from "@/lib/identity";
import { useIdentityStore } from "@/stores/identity-store";

export const Route = createFileRoute("/admin/users")({
	beforeLoad: () => requireAccount(["admin"]),
	component: AdminUsersPage,
});

const ROLES = ["admin", "gm", "pl"] as const;

type UserFilter = "all" | "enabled" | "disabled" | "deleted";

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

function stateTone(user: UserDto): "success" | "warning" | "danger" {
	if (user.deletedAt !== null) {
		return "danger";
	}
	if (user.disabledAt !== null) {
		return "warning";
	}
	return "success";
}

function matchesFilter(user: UserDto, filter: UserFilter): boolean {
	if (filter === "all") {
		return true;
	}
	if (filter === "deleted") {
		return user.deletedAt !== null;
	}
	if (user.deletedAt !== null) {
		return false;
	}
	if (filter === "disabled") {
		return user.disabledAt !== null;
	}
	return user.disabledAt === null;
}

function AdminUsersPage() {
	useI18nVersion();
	const currentUserId = useIdentityStore(
		(state) => state.account?.userId ?? null,
	);
	const [users, setUsers] = useState<UserDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<UserFilter>("all");
	const [createOpen, setCreateOpen] = useState(false);
	const [resetTarget, setResetTarget] = useState<UserDto | null>(null);
	const [disableTarget, setDisableTarget] = useState<UserDto | null>(null);
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

	const counts = {
		all: users.length,
		enabled: users.filter((user) => matchesFilter(user, "enabled")).length,
		disabled: users.filter((user) => matchesFilter(user, "disabled")).length,
		deleted: users.filter((user) => matchesFilter(user, "deleted")).length,
	};
	const visible = users.filter((user) => matchesFilter(user, filter));

	return (
		<AdminShell>
			<div className="flex flex-col gap-6">
				<PageHeader
					title={t("admin.title")}
					description={t("admin.description")}
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

				{loading ? (
					<ListSkeleton rows={4} />
				) : users.length === 0 ? (
					<EmptyState
						icon={Users}
						title={t("admin.usersEmpty")}
						action={
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
				) : (
					<div className="flex flex-col gap-4">
						<div className="overflow-x-auto">
							<SegmentedControl
								value={filter}
								onValueChange={setFilter}
								className="w-max min-w-full"
								itemClassName="shrink-0"
								options={[
									{
										value: "all",
										label: t("admin.filterAll", { count: counts.all }),
									},
									{
										value: "enabled",
										label: t("admin.filterEnabled", { count: counts.enabled }),
									},
									{
										value: "disabled",
										label: t("admin.filterDisabled", {
											count: counts.disabled,
										}),
									},
									{
										value: "deleted",
										label: t("admin.filterDeleted", { count: counts.deleted }),
									},
								]}
							/>
						</div>

						{visible.length === 0 ? (
							<EmptyState icon={Users} title={t("admin.filterEmpty")} />
						) : (
							<div className="overflow-hidden rounded-2xl bg-md-surface-container">
								<div className="border-separator-secondary/60 text-foreground-secondary hidden grid-cols-[minmax(0,1fr)_7rem_7rem_3.5rem] gap-4 border-b px-5 py-2.5 text-label-large md:grid">
									<span>{t("admin.username")}</span>
									<span>{t("admin.roleLabel")}</span>
									<span>{t("admin.state")}</span>
									<span />
								</div>
								{visible.map((user) => (
									<div
										key={user.id}
										className="border-separator-secondary/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_7rem_7rem_3.5rem] md:gap-4 md:px-5"
									>
										<div className="flex min-w-0 items-center gap-3">
											<Avatar
												size="sm"
												className="bg-md-surface-container-high"
											>
												<AvatarFallback className="text-label-large-emph">
													{initialsOf(user.username)}
												</AvatarFallback>
											</Avatar>
											<div className="flex min-w-0 flex-col gap-0.5">
												<div className="flex min-w-0 flex-wrap items-center gap-2">
													<span className="text-foreground truncate text-label-large-emph">
														{user.username}
													</span>
													{user.id === currentUserId ? (
														<Badge variant="soft" tone="accent" size="sm">
															{t("admin.you")}
														</Badge>
													) : null}
												</div>
												<div className="flex flex-wrap items-center gap-1.5 md:hidden">
													<Badge variant="soft" tone="default" size="sm">
														{roleLabel(user.role)}
													</Badge>
													<Badge
														variant="soft"
														tone={stateTone(user)}
														size="sm"
													>
														{stateLabel(user)}
													</Badge>
												</div>
											</div>
										</div>

										<div className="hidden md:block">
											<Badge
												variant="soft"
												tone={user.role === "admin" ? "accent" : "default"}
												size="sm"
											>
												{roleLabel(user.role)}
											</Badge>
										</div>
										<div className="hidden md:block">
											<Badge variant="soft" tone={stateTone(user)} size="sm">
												{stateLabel(user)}
											</Badge>
										</div>

										<div className="flex justify-end">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														className="text-foreground-secondary"
														aria-label={`${t("admin.actions")} ${user.username}`}
													>
														<Ellipsis />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => {
															setResetTarget(user);
															setPassword("");
														}}
													>
														<KeyRound />
														{t("admin.resetPassword")}
													</DropdownMenuItem>
													{user.deletedAt !== null ? (
														<DropdownMenuItem
															onClick={() =>
																void patchUser(user, { deleted: false })
															}
														>
															<UserCheck />
															{t("admin.restore")}
														</DropdownMenuItem>
													) : (
														<>
															<DropdownMenuItem
																onClick={() => {
																	if (user.disabledAt === null) {
																		setDisableTarget(user);
																	} else {
																		void patchUser(user, { disabled: false });
																	}
																}}
															>
																{user.disabledAt === null ? (
																	<UserX />
																) : (
																	<ShieldCheck />
																)}
																{user.disabledAt === null
																	? t("admin.disable")
																	: t("admin.enable")}
															</DropdownMenuItem>
															<DropdownMenuItem
																variant="destructive"
																onClick={() =>
																	void patchUser(user, { deleted: true })
																}
															>
																<Trash2 />
																{t("admin.delete")}
															</DropdownMenuItem>
														</>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

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
					<FormField
						label={t("account.newPassword")}
						htmlFor="reset-password"
						description={t("admin.passwordHint")}
					>
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

			<ConfirmDialog
				open={disableTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDisableTarget(null);
					}
				}}
				icon={UserX}
				confirmIcon={UserX}
				title={t("admin.disableTitle", {
					username: disableTarget?.username ?? "",
				})}
				description={t("admin.disableDescription")}
				confirmLabel={t("admin.disableConfirm")}
				variant="warning"
				onConfirm={() => {
					const target = disableTarget;
					setDisableTarget(null);
					if (target) {
						void patchUser(target, { disabled: true });
					}
				}}
			/>
		</AdminShell>
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
					<FormField
						label={t("account.newPassword")}
						htmlFor="new-password"
						description={t("admin.passwordHint")}
					>
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
