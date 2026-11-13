import { CharacterInviteDto } from "@cogm/shared";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { api, isApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatStamp } from "@/lib/format";

type Invite = CharacterInviteDto;
type IssuedInvite = Omit<Invite, "token"> & { token: string };
type FreshTokenEntry = { invite: Invite; token: string };
type TokenPayload = { token?: unknown };

function inviteUrl(token: string): string {
	return `${location.origin}/submit/${token}`;
}

function issuedToken(value: unknown): string {
	if (!value || typeof value !== "object") {
		throw new TypeError("invalid invite response");
	}
	const { token } = value as TokenPayload;
	if (typeof token !== "string" || token.length === 0) {
		throw new TypeError("invalid invite response");
	}
	return token;
}

function inviteStatus(invite: Invite): "revoked" | "expired" | "valid" {
	if (invite.revokedAt !== null) return "revoked";
	if (invite.expiresAt <= Date.now()) return "expired";
	return "valid";
}

function statusTone(status: "revoked" | "expired" | "valid") {
	if (status === "valid") return "success" as const;
	if (status === "expired") return "warning" as const;
	return "danger" as const;
}

export function InviteLinksDialog({
	open,
	onOpenChange,
	scope,
	targetId,
	targetName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	scope: "module" | "session";
	targetId: string;
	targetName: string;
}) {
	const [invites, setInvites] = useState<Invite[]>([]);
	const [freshTokens, setFreshTokens] = useState<Map<string, FreshTokenEntry>>(
		new Map(),
	);
	const [lastLoadFailed, setLastLoadFailed] = useState(false);
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const generationRef = useRef(0);
	const loadSeqRef = useRef(0);
	const lifecycleKey = JSON.stringify([open, scope, targetId]);

	const load = useCallback(
		async (expectedGeneration = generationRef.current) => {
			if (generationRef.current !== expectedGeneration) {
				return;
			}
			const loadId = ++loadSeqRef.current;
			setLoading(true);
			setLastLoadFailed(false);
			try {
				const list = await api<Invite[] | { items: Invite[] }>("/gm/invites");
				if (
					generationRef.current !== expectedGeneration ||
					loadSeqRef.current !== loadId
				) {
					return;
				}
				const all = Array.isArray(list) ? list : (list.items ?? []);
				const parsed = all.map((item) => CharacterInviteDto.parse(item));
				setInvites((current) => {
					const fallback = new Map(
						current.map((invite) => [invite.id, invite] as const),
					);
					return parsed
						.filter(
							(item) => item.scope === scope && item.targetId === targetId,
						)
						.map((item) => {
							if (item.token) return item;
							return { ...item, token: fallback.get(item.id)?.token ?? null };
						});
				});
			} catch (error) {
				if (
					generationRef.current !== expectedGeneration ||
					loadSeqRef.current !== loadId
				) {
					return;
				}
				setLastLoadFailed(true);
				toast.error(isApiError(error) ? error.message : t("gm.invites.empty"));
			} finally {
				if (
					generationRef.current === expectedGeneration &&
					loadSeqRef.current === loadId
				) {
					setLoading(false);
				}
			}
		},
		[scope, targetId],
	);

	useEffect(() => {
		void lifecycleKey;
		const generation = ++generationRef.current;
		loadSeqRef.current += 1;
		setFreshTokens(new Map());
		setInvites([]);
		setLastLoadFailed(false);
		setPending(false);
		if (open) {
			void load(generation);
		} else {
			setLoading(false);
		}
	}, [lifecycleKey, open, load]);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			generationRef.current += 1;
			loadSeqRef.current += 1;
			setFreshTokens(new Map());
			setInvites([]);
			setLastLoadFailed(false);
			setLoading(false);
			setPending(false);
		}
		onOpenChange(nextOpen);
	}

	async function create() {
		const generation = generationRef.current;
		setPending(true);
		try {
			const response = await api<unknown>("/gm/invites", {
				method: "POST",
				body: JSON.stringify({ scope, targetId, expiresInDays: 7 }),
			});
			if (generationRef.current !== generation) {
				return;
			}
			const token = issuedToken(response);
			const created = CharacterInviteDto.parse(response);
			setFreshTokens((current) => {
				const next = new Map(current);
				next.set(created.id, { invite: created, token });
				return next;
			});
			toast.success(t("gm.invites.created"));
			await load(generation);
		} catch (error) {
			if (generationRef.current !== generation) {
				return;
			}
			toast.error(errorText(error, "gm.invites.created"));
		} finally {
			if (generationRef.current === generation) {
				setPending(false);
			}
		}
	}

	async function revoke(invite: Invite) {
		const generation = generationRef.current;
		try {
			await api(`/gm/invites/${invite.id}`, { method: "DELETE" });
			if (generationRef.current !== generation) {
				return;
			}
			setFreshTokens((current) => {
				if (!current.has(invite.id)) return current;
				const next = new Map(current);
				next.delete(invite.id);
				return next;
			});
			await load(generation);
		} catch (error) {
			if (generationRef.current !== generation) {
				return;
			}
			toast.error(errorText(error, "gm.invites.revoked"));
		}
	}

	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(inviteUrl(token));
			toast.success(t("gm.invites.copied"));
		} catch {
			toast.error(t("gm.invites.copyFailed"));
		}
	}

	const active = new Map(freshTokens);
	for (const invite of invites) {
		const fresh = active.get(invite.id);
		if (!fresh) continue;
		if (invite.revokedAt !== null) {
			active.delete(invite.id);
		} else {
			active.set(invite.id, { ...fresh, invite });
		}
	}
	const rows: Array<Invite | IssuedInvite> = [
		...Array.from(active.values(), (entry) => ({
			...entry.invite,
			token: entry.token,
		})),
		...invites.filter((invite) => !active.has(invite.id)),
	];

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("gm.invites.title")}</DialogTitle>
					<DialogDescription>{targetName}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<Button
						type="button"
						variant="primary"
						disabled={pending}
						onClick={() => void create()}
					>
						<Plus />
						{t("gm.invites.create")}
					</Button>

					{active.size > 0 ? (
						<p className="text-foreground-tertiary text-body-small">
							{t("gm.invites.createdHint")}
						</p>
					) : null}

					{loading ? (
						<p className="text-foreground-tertiary text-body-small">
							{t("common.loading")}
						</p>
					) : rows.length === 0 && !lastLoadFailed ? (
						<p className="text-foreground-tertiary text-body-small">
							{t("gm.invites.empty")}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{rows.map((invite) => {
								const fresh = active.get(invite.id)?.token ?? null;
								const status = inviteStatus(invite);
								return (
									<div
										key={invite.id}
										data-invite-id={invite.id}
										className="bg-surface-tertiary flex flex-col gap-2 rounded-lg px-3 py-2"
									>
										<div className="flex flex-wrap items-center gap-2">
											<Link2 className="text-foreground-tertiary size-4 shrink-0" />
											<Badge variant="soft" tone={statusTone(status)} size="sm">
												{t(`gm.invites.status.${status}`)}
											</Badge>
											<span className="text-foreground-tertiary text-label-small">
												{t("gm.invites.expiry", {
													date: formatStamp(invite.expiresAt),
												})}
											</span>
										</div>
										<div className="flex items-center gap-2">
											{fresh ? (
												<>
													<Input
														readOnly
														aria-label={t("gm.invites.copy")}
														value={inviteUrl(fresh)}
														className="h-8 flex-1 font-mono text-label-small"
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														title={t("gm.invites.copy")}
														aria-label={t("gm.invites.copy")}
														onClick={() => void copy(fresh)}
													>
														<Copy />
													</Button>
												</>
											) : (
												<span className="text-foreground-tertiary flex-1 text-body-small">
													{t("gm.invites.historicalHint")}
												</span>
											)}
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												title={t("gm.invites.revoke")}
												aria-label={t("gm.invites.revoke")}
												onClick={() => void revoke(invite)}
											>
												<Trash2 />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
