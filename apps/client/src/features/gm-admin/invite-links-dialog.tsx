import type { CharacterInviteDto } from "@cogm/shared";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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

function inviteUrl(token: string): string {
	return `${location.origin}/submit/${token}`;
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
	const [invites, setInvites] = useState<CharacterInviteDto[]>([]);
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const list = await api<
				CharacterInviteDto[] | { items: CharacterInviteDto[] }
			>("/gm/invites");
			const all = Array.isArray(list) ? list : (list.items ?? []);
			setInvites(
				all.filter(
					(item) => item.scope === scope && item.targetId === targetId,
				),
			);
		} catch (error) {
			toast.error(isApiError(error) ? error.message : t("gm.invites.empty"));
		} finally {
			setLoading(false);
		}
	}, [scope, targetId]);

	useEffect(() => {
		if (open) {
			void load();
		}
	}, [open, load]);

	async function create() {
		setPending(true);
		try {
			await api("/gm/invites", {
				method: "POST",
				body: JSON.stringify({ scope, targetId, expiresInDays: 7 }),
			});
			toast.success(t("gm.invites.created"));
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.invites.created"));
		} finally {
			setPending(false);
		}
	}

	async function revoke(invite: CharacterInviteDto) {
		try {
			await api(`/gm/invites/${invite.id}`, { method: "DELETE" });
			await load();
		} catch (error) {
			toast.error(errorText(error, "gm.invites.revoked"));
		}
	}

	async function copy(invite: CharacterInviteDto) {
		if (!invite.token) {
			return;
		}
		try {
			await navigator.clipboard.writeText(inviteUrl(invite.token));
			toast.success(t("gm.invites.copied"));
		} catch {
			toast.error(t("gm.invites.copyFailed"));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
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

					{loading ? (
						<p className="text-foreground-tertiary text-body-small">
							{t("common.loading")}
						</p>
					) : invites.length === 0 ? (
						<p className="text-foreground-tertiary text-body-small">
							{t("gm.invites.empty")}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{invites.map((invite) => (
								<div
									key={invite.id}
									className="bg-surface-tertiary flex items-center gap-2 rounded-lg px-3 py-2"
								>
									<Link2 className="text-foreground-tertiary size-4 shrink-0" />
									<Input
										readOnly
										value={invite.token ? inviteUrl(invite.token) : ""}
										className="h-8 flex-1 font-mono text-label-small"
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title={t("gm.invites.copy")}
										onClick={() => void copy(invite)}
									>
										<Copy />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title={t("gm.invites.revoke")}
										onClick={() => void revoke(invite)}
									>
										<Trash2 />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
