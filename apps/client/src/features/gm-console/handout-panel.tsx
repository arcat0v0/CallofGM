import { Link } from "@tanstack/react-router";
import { Check, Eye, EyeOff, Search, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { HandoutPreview } from "@/features/session-live/handout-preview";
import { t } from "@/i18n";
import { formatClock, initialsOf } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { GmPanelShell } from "./gm-panel-fields";

type Scope = "public" | "secret";

function HandoutPanel({ onClose }: { onClose: () => void }) {
	const handouts = usePlayStore((state) => state.catalogHandouts);
	const grants = usePlayStore((state) => state.handoutGrants);
	const characters = usePlayStore((state) => state.characters);
	const presence = usePlayStore((state) => state.presence);
	const moduleId = usePlayStore((state) => state.moduleId);
	const ended = usePlayStore((state) => state.status === "ended");
	const [handoutId, setHandoutId] = useState("");
	const [scope, setScope] = useState<Scope>("secret");
	const [selection, setSelection] = useState<string[]>([]);
	const [pending, setPending] = useState(false);
	const [query, setQuery] = useState("");

	const pcs = useMemo(
		() => characters.filter((character) => character.kind === "pc"),
		[characters],
	);
	const keyword = query.trim();
	const visibleHandouts = useMemo(
		() =>
			handouts.filter(
				(handout) =>
					!keyword ||
					handout.title.includes(keyword) ||
					handout.content.includes(keyword),
			),
		[handouts, keyword],
	);
	const selected =
		handouts.find((handout) => handout.id === handoutId) ?? handouts[0] ?? null;

	const selectedGrants = useMemo(
		() =>
			selected
				? grants
						.filter((grant) => grant.handoutId === selected.id)
						.sort((a, b) => b.grantedAt - a.grantedAt)
				: [],
		[grants, selected],
	);
	const publicGrant = selectedGrants.find((grant) => grant.isPublic) ?? null;
	const secretGrants = selectedGrants.filter((grant) => !grant.isPublic);
	const secretTarget = secretGrants[0] ?? null;

	const received = useMemo(() => {
		const map = new Map<string, boolean>();
		for (const grant of secretGrants) {
			for (const recipient of grant.recipients) {
				map.set(
					recipient.characterId,
					(map.get(recipient.characterId) ?? false) || recipient.read,
				);
			}
		}
		return map;
	}, [secretGrants]);

	const candidates = pcs.filter(
		(character) => !received.has(character.characterId),
	);
	const candidateIds = useMemo(
		() => new Set(candidates.map((character) => character.characterId)),
		[candidates],
	);
	const validSelection = selection.filter((id) => candidateIds.has(id));
	const unreadCount = [...received.values()].filter((read) => !read).length;

	useEffect(() => {
		if (selected && !handouts.some((item) => item.id === handoutId)) {
			setHandoutId(selected.id);
		}
	}, [selected, handouts, handoutId]);

	function selectHandout(id: string) {
		setHandoutId(id);
		setSelection([]);
		setScope("secret");
	}

	function toggleRecipient(characterId: string) {
		setSelection((current) =>
			current.includes(characterId)
				? current.filter((id) => id !== characterId)
				: [...current, characterId],
		);
	}

	function submit() {
		if (!selected || ended || pending) {
			return;
		}
		setPending(true);
		const sent =
			scope === "public"
				? sendSessionCommand("handout:grant", {
						handoutId: selected.id,
						recipientCharacterIds: [],
					})
				: secretTarget
					? sendSessionCommand("handout:append", {
							grantId: secretTarget.grantId,
							recipientCharacterIds: validSelection,
						})
					: sendSessionCommand("handout:grant", {
							handoutId: selected.id,
							recipientCharacterIds: validSelection,
						});
		if (!sent) {
			setPending(false);
			toast.error(t("chat.notConnected"));
			return;
		}
		setSelection([]);
		setTimeout(() => setPending(false), 1500);
	}

	const buttonLabel = publicGrant
		? t("gm.workbench.publicGranted")
		: scope === "public"
			? t("gm.workbench.grantPublic")
			: secretTarget
				? t("gm.workbench.appendSecretCount", { count: validSelection.length })
				: t("gm.workbench.grantSecretCount", { count: validSelection.length });
	const canSubmit =
		!ended &&
		!pending &&
		!publicGrant &&
		(scope === "public" || validSelection.length > 0);
	const footerHint =
		scope === "public"
			? t("gm.workbench.scopePublicHint")
			: validSelection.length === 0
				? t("gm.workbench.scopeSecretHint")
				: t("gm.workbench.secretSelectedHint", {
						count: validSelection.length,
					});

	return (
		<GmPanelShell
			title={t("gm.workbench.handoutTitle")}
			subtitle={t("gm.workbench.handoutSubtitle")}
			onClose={onClose}
			className="w-[min(760px,calc(100vw-48px))]"
			footer={
				selected ? (
					publicGrant ? (
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="text-md-on-surface-variant flex min-w-0 items-center gap-2 text-label-medium">
								<Eye className="text-md-primary size-4 shrink-0" />
								<span className="truncate">
									{t("gm.workbench.publicGrantedHint")}
								</span>
							</span>
							<span className="text-md-on-surface-variant shrink-0 text-label-medium tabular-nums">
								{t("gm.workbench.handoutReadCount", {
									read: publicGrant.readCount,
									total: publicGrant.audienceCount,
								})}
							</span>
						</div>
					) : (
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="text-md-on-surface-variant flex min-w-0 items-center gap-2 text-label-medium">
								{scope === "secret" ? (
									<EyeOff className="size-4 shrink-0" />
								) : (
									<Eye className="size-4 shrink-0" />
								)}
								<span className="truncate">{footerHint}</span>
							</span>
							<Button
								type="button"
								variant="primary"
								size="sm"
								className="h-12 shrink-0 px-4"
								disabled={!canSubmit}
								onClick={submit}
							>
								<Send className="size-4" />
								{buttonLabel}
							</Button>
						</div>
					)
				) : undefined
			}
		>
			{handouts.length === 0 ? (
				<div className="flex flex-col items-start gap-3">
					<p className="text-md-on-surface-variant text-body-medium">
						{t("gm.console.noHandouts")}
					</p>
					{moduleId ? (
						<Button
							asChild
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest h-10"
						>
							<Link to="/gm/module/$moduleId" params={{ moduleId }}>
								{t("gm.workbench.manageHandouts")}
							</Link>
						</Button>
					) : null}
				</div>
			) : (
				<div className="grid h-full min-h-0 grid-cols-[236px_minmax(0,1fr)] gap-4">
					<div className="flex min-h-0 flex-col gap-2">
						<InputGroup className="h-9 shrink-0">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								aria-label={t("gm.workbench.handoutSearch")}
								placeholder={t("gm.workbench.handoutSearch")}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</InputGroup>
						<div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
							{visibleHandouts.length === 0 ? (
								<p className="text-md-on-surface-variant px-1 text-label-small">
									{t("gm.workbench.handoutSearchEmpty")}
								</p>
							) : (
								visibleHandouts.map((handout) => {
									const handoutGrants = grants.filter(
										(grant) => grant.handoutId === handout.id,
									);
									const isPublic = handoutGrants.some(
										(grant) => grant.isPublic,
									);
									const recipientIds = new Set(
										handoutGrants
											.filter((grant) => !grant.isPublic)
											.flatMap((grant) =>
												grant.recipients.map(
													(recipient) => recipient.characterId,
												),
											),
									);
									const handoutUnread = handoutGrants
										.filter((grant) => !grant.isPublic)
										.flatMap((grant) => grant.recipients)
										.filter((recipient) => !recipient.read).length;
									const active = selected?.id === handout.id;
									return (
										<button
											key={handout.id}
											type="button"
											onClick={() => selectHandout(handout.id)}
											className={cn(
												"flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
												active
													? "border-md-primary/30 bg-md-primary-container text-md-on-primary-container"
													: "bg-md-surface-container border-md-outline-variant/50 text-md-on-surface hover:bg-md-surface-container-high",
											)}
										>
											<span className="flex items-center gap-2">
												<span className="min-w-0 flex-1 truncate text-label-large-emph">
													{handout.title}
												</span>
												{isPublic ? (
													<Badge variant="soft" tone="success" size="sm">
														{t("gm.workbench.handoutStatusPublic")}
													</Badge>
												) : recipientIds.size > 0 ? (
													<Badge variant="soft" tone="warning" size="sm">
														{t("gm.workbench.handoutStatusSecret", {
															count: recipientIds.size,
														})}
													</Badge>
												) : (
													<Badge variant="soft" size="sm">
														{t("gm.workbench.handoutStatusNone")}
													</Badge>
												)}
											</span>
											<span className="line-clamp-2 text-label-small opacity-80">
												{handout.content}
											</span>
											{handoutUnread > 0 ? (
												<span className="text-warning text-label-small">
													{t("gm.workbench.handoutUnread", {
														count: handoutUnread,
													})}
												</span>
											) : null}
										</button>
									);
								})
							)}
						</div>
						{moduleId ? (
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="h-8 shrink-0 justify-start px-1 text-label-small"
							>
								<Link to="/gm/module/$moduleId" params={{ moduleId }}>
									{t("gm.workbench.manageHandouts")}
								</Link>
							</Button>
						) : null}
					</div>

					{selected ? (
						<div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
							<HandoutPreview
								title={selected.title}
								content={selected.content}
								imageAssetId={selected.imageAssetId}
								imageAlt={selected.title}
							/>

							<div className="flex flex-col gap-2">
								<span className="text-md-on-surface-variant text-label-medium-emph">
									{t("gm.workbench.grantStatus")}
								</span>
								{selectedGrants.length === 0 ? (
									<p className="text-md-on-surface-variant text-label-small">
										{t("gm.workbench.handoutStatusNone")}
									</p>
								) : publicGrant ? (
									<div className="bg-md-primary-container/40 border-md-primary/25 flex items-center gap-2 rounded-lg border px-3 py-2">
										<Eye className="text-md-primary size-4 shrink-0" />
										<span className="text-md-on-primary-container min-w-0 flex-1 truncate text-label-medium">
											{t("gm.workbench.publicGrantedHint")}
										</span>
										<span className="text-md-on-primary-container shrink-0 text-label-small tabular-nums">
											{t("gm.workbench.handoutReadCount", {
												read: publicGrant.readCount,
												total: publicGrant.audienceCount,
											})}
										</span>
									</div>
								) : (
									<div className="flex flex-col gap-1.5">
										<div className="flex items-center gap-2">
											<EyeOff className="text-warning size-4 shrink-0" />
											<span className="text-md-on-surface-variant min-w-0 flex-1 text-label-medium">
												{t("gm.workbench.secretGrantedSummary", {
													count: received.size,
													read: received.size - unreadCount,
												})}
											</span>
											<span className="text-md-on-surface-variant/70 shrink-0 text-label-small">
												{formatClock(secretTarget?.grantedAt ?? Date.now())}
											</span>
										</div>
										<div className="flex flex-wrap gap-1.5">
											{[...received.entries()].map(([characterId, read]) => (
												<Badge
													key={characterId}
													variant="soft"
													tone={read ? "success" : "warning"}
													size="sm"
												>
													{characters.find(
														(character) =>
															character.characterId === characterId,
													)?.name ?? t("chat.role.character")}
													{read
														? ` · ${t("gm.workbench.handoutRead")}`
														: ` · ${t("gm.workbench.handoutUnreadShort")}`}
												</Badge>
											))}
										</div>
									</div>
								)}
							</div>

							{publicGrant ? null : (
								<>
									<SegmentedControl
										value={scope}
										options={[
											{
												value: "public",
												label: t("gm.workbench.grantPublic"),
											},
											{
												value: "secret",
												label: t("gm.workbench.grantSecret"),
											},
										]}
										onValueChange={(value) => {
											setScope(value);
											setSelection([]);
										}}
										className="h-9"
										itemClassName="h-full text-label-medium"
									/>

									{scope === "secret" ? (
										<div className="flex flex-col gap-2">
											<div className="flex items-center justify-between gap-2">
												<span className="text-md-on-surface-variant text-label-medium">
													{t("gm.workbench.recipients")}
												</span>
												<div className="flex items-center gap-1">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-7 px-2 text-label-small"
														disabled={candidates.length === 0}
														onClick={() =>
															setSelection(
																candidates.map(
																	(character) => character.characterId,
																),
															)
														}
													>
														{t("gm.workbench.selectAllCandidates")}
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-7 px-2 text-label-small"
														disabled={validSelection.length === 0}
														onClick={() => setSelection([])}
													>
														{t("gm.workbench.clearSelection")}
													</Button>
												</div>
											</div>
											{candidates.length === 0 ? (
												<p className="text-md-on-surface-variant text-label-small">
													{t("gm.workbench.noCandidates")}
												</p>
											) : (
												<div className="flex flex-col gap-1.5">
													{candidates.map((character) => {
														const checked = validSelection.includes(
															character.characterId,
														);
														const claim = character.claim;
														const claimOnline = claim
															? presence.some(
																	(player) =>
																		player.holderKind === claim.holderKind &&
																		player.holderId === claim.holderId,
																)
															: false;
														const claimLabel = claim
															? (claim.displayName ??
																t("gm.workbench.claimShort", {
																	id: claim.holderId.slice(0, 8),
																}))
															: t("gm.workbench.unclaimed");
														return (
															<button
																key={character.characterId}
																type="button"
																aria-pressed={checked}
																onClick={() =>
																	toggleRecipient(character.characterId)
																}
																className={cn(
																	"flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
																	checked
																		? "bg-md-primary-container border-md-primary/25 text-md-on-primary-container"
																		: "bg-md-surface-container text-md-on-surface hover:bg-md-surface-container-high border-md-outline-variant/50",
																)}
															>
																<span
																	className={cn(
																		"grid size-8 shrink-0 place-items-center rounded-full text-label-medium-emph",
																		checked
																			? "bg-md-primary-container border-md-primary/25 text-md-on-primary-container border"
																			: "bg-md-surface-container-high text-md-on-surface-variant",
																	)}
																>
																	{initialsOf(character.name)}
																</span>
																<span className="flex min-w-0 flex-1 flex-col gap-0.5">
																	<span className="truncate text-label-large">
																		{character.name}
																	</span>
																	<span
																		className={cn(
																			"truncate text-label-small",
																			checked
																				? "text-md-on-primary-container"
																				: "text-md-on-surface-variant",
																		)}
																	>
																		{claimLabel}
																		{claimOnline
																			? ` · ${t("gm.workbench.claimOnline")}`
																			: ""}
																	</span>
																</span>
																<span
																	className={cn(
																		"grid size-5 shrink-0 place-items-center rounded-xs border-2",
																		checked
																			? "border-accent bg-accent text-accent-foreground"
																			: "border-md-on-surface-variant",
																	)}
																>
																	{checked ? (
																		<Check className="size-3" strokeWidth={3} />
																	) : null}
																</span>
															</button>
														);
													})}
												</div>
											)}
											{received.size > 0 ? (
												<div className="flex flex-col gap-1.5 border-t border-separator-secondary pt-3">
													<span className="text-md-on-surface-variant flex items-center gap-2 text-label-small">
														<Users className="size-3.5 shrink-0" />
														{t("gm.workbench.alreadyReceived")}
													</span>
													<div className="flex flex-wrap gap-1.5">
														{pcs
															.filter((character) =>
																received.has(character.characterId),
															)
															.map((character) => {
																const read =
																	received.get(character.characterId) ?? false;
																return (
																	<Badge
																		key={character.characterId}
																		variant="soft"
																		tone={read ? "success" : "warning"}
																		size="sm"
																	>
																		{character.name}
																		{read
																			? ` · ${t("gm.workbench.handoutRead")}`
																			: ` · ${t("gm.workbench.handoutUnreadShort")}`}
																	</Badge>
																);
															})}
													</div>
												</div>
											) : null}
										</div>
									) : (
										<p className="text-md-on-surface-variant text-label-small">
											{t("gm.workbench.scopePublicHint")}
										</p>
									)}
								</>
							)}
						</div>
					) : null}
				</div>
			)}
		</GmPanelShell>
	);
}

export { HandoutPanel };
