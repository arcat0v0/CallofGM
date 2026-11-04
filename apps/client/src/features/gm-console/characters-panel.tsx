import type { SnapshotCharacter } from "@cogm/shared";
import {
	ChevronDown,
	ContactRound,
	Search,
	UserRoundCheck,
	UserRoundMinus,
	UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { SelectItem } from "@/components/ui/select";
import { CharacterSheetPanel } from "@/features/session-live/character-sheet-panel";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { parseCocState } from "@/lib/coc-live";
import { errorText } from "@/lib/errors";
import { expressionLabel, initialsOf } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { usePlayStore } from "@/stores/play-store";
import { AddNpcDialog } from "./add-npc-dialog";
import { GmPanelShell, GmSelectField, GmValueField } from "./gm-panel-fields";
import { GmStateEditor } from "./gm-state-editor";

function characterStatusLine(character: SnapshotCharacter): string {
	const state = parseCocState(character.state);
	const kind = character.kind === "pc" ? t("common.pc") : t("common.npc");
	if (character.kind === "npc") {
		return `${kind} · ${t("gm.workbench.npcHidden")}`;
	}
	const statuses = getRuleComponent(character.ruleId).statusLabelsOfState(
		character.state,
	);
	if (statuses.length > 0) {
		return `${kind} · ${statuses.join(t("common.listSeparator"))}`;
	}
	return `${kind} · ${t("gm.workbench.presenting")}`;
}

function CharactersPanel({ onClose }: { onClose: () => void }) {
	const characters = usePlayStore((state) => state.characters);
	const presence = usePlayStore((state) => state.presence);
	const sessionId = usePlayStore((state) => state.sessionId);
	const moduleId = usePlayStore((state) => state.moduleId);
	const ruleId = usePlayStore((state) => state.ruleId);
	const ended = usePlayStore((state) => state.status === "ended");
	const [overrides, setOverrides] = useState<Record<string, boolean>>({});
	const [editorCharacterId, setEditorCharacterId] = useState<string | null>(
		null,
	);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [sheetCharacterId, setSheetCharacterId] = useState<string | null>(null);
	const [claimPending, setClaimPending] = useState(false);
	const [query, setQuery] = useState("");
	const [kindFilter, setKindFilter] = useState<"all" | "pc" | "npc">("all");
	const [addNpcOpen, setAddNpcOpen] = useState(false);
	const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
	const editorCharacter =
		characters.find(
			(character) => character.characterId === editorCharacterId,
		) ?? null;
	const removeTarget =
		characters.find((character) => character.characterId === removeTargetId) ??
		null;
	const keyword = query.trim();
	const visibleCharacters = characters.filter(
		(character) =>
			(kindFilter === "all" || character.kind === kindFilter) &&
			(!keyword || character.name.includes(keyword)),
	);
	const orderedCharacters = [...visibleCharacters].sort(
		(a, b) => Number(a.kind === "npc") - Number(b.kind === "npc"),
	);

	async function assignClaim(userId: string, characterId: string) {
		if (!sessionId || claimPending) {
			return;
		}
		setClaimPending(true);
		try {
			await api(`/gm/sessions/${encodeURIComponent(sessionId)}/claims/assign`, {
				method: "POST",
				body: JSON.stringify({ userId, characterId }),
			});
			toast.success(
				t("gm.workbench.claimAssigned", { id: userId.slice(0, 8) }),
			);
		} catch (error) {
			toast.error(errorText(error, "gm.workbench.claimAssignFailed"));
		} finally {
			setClaimPending(false);
		}
	}

	async function releaseClaim(userId: string) {
		if (!sessionId || claimPending) {
			return;
		}
		setClaimPending(true);
		try {
			await api(
				`/gm/sessions/${encodeURIComponent(sessionId)}/claims/release`,
				{
					method: "POST",
					body: JSON.stringify({ userId }),
				},
			);
			toast.success(t("gm.workbench.claimReleased"));
		} catch (error) {
			toast.error(errorText(error, "gm.workbench.claimReleaseFailed"));
		} finally {
			setClaimPending(false);
		}
	}

	return (
		<>
			<GmPanelShell
				title={t("gm.workbench.charactersTitle")}
				subtitle={t("gm.workbench.charactersSubtitle")}
				onClose={onClose}
				footer={
					<span className="text-md-on-surface-variant text-label-medium">
						{t("gm.workbench.stateScope")}
					</span>
				}
			>
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<InputGroup className="h-9 flex-1">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								aria-label={t("gm.workbench.characterSearch")}
								placeholder={t("gm.workbench.characterSearch")}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</InputGroup>
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest h-9 shrink-0"
							disabled={ended}
							onClick={() => setAddNpcOpen(true)}
						>
							<UserRoundPlus className="size-4" />
							{t("gm.workbench.addNpc")}
						</Button>
					</div>
					<SegmentedControl
						value={kindFilter}
						options={[
							{
								value: "all",
								label: t("gm.workbench.filterAll", {
									count: characters.length,
								}),
							},
							{
								value: "pc",
								label: t("gm.workbench.filterPc", {
									count: characters.filter((item) => item.kind === "pc").length,
								}),
							},
							{
								value: "npc",
								label: t("gm.workbench.filterNpc", {
									count: characters.filter((item) => item.kind === "npc")
										.length,
								}),
							},
						]}
						onValueChange={setKindFilter}
						className="h-8"
						itemClassName="h-full text-label-small"
					/>
				</div>
				{characters.length === 0 ? (
					<p className="text-md-on-surface-variant text-body-medium">
						{t("gm.console.noCharacters")}
					</p>
				) : orderedCharacters.length === 0 ? (
					<p className="text-md-on-surface-variant text-body-medium">
						{t("gm.workbench.characterSearchEmpty")}
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{orderedCharacters.map((character) => {
							const state = parseCocState(character.state);
							const expanded =
								overrides[character.characterId] ?? character.kind === "pc";
							const portraits = character.portraits ?? [];
							const expressionKey =
								character.currentExpressionKey ??
								portraits.find((item) => item.isDefault)?.expressionKey ??
								portraits[0]?.expressionKey ??
								"";
							const critical = Boolean(state?.statuses.length);
							const claim = character.claim;
							const claimOnline = claim
								? presence.some(
										(player) =>
											player.holderKind === claim.holderKind &&
											player.holderId === claim.holderId,
									)
								: false;
							return (
								<div
									key={character.characterId}
									data-character-id={character.characterId}
									className="bg-md-surface-container flex flex-col gap-3 rounded-3xl border border-md-outline-variant/50 p-4"
								>
									<button
										type="button"
										aria-expanded={expanded}
										onClick={() =>
											setOverrides((current) => ({
												...current,
												[character.characterId]: !expanded,
											}))
										}
										className="flex w-full items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
									>
										<span
											className={cn(
												"grid size-10 shrink-0 place-items-center rounded-full text-label-medium-emph",
												character.kind === "pc"
													? "bg-md-primary-container text-md-on-primary-container"
													: "bg-md-surface-container-highest text-md-on-surface-variant",
											)}
										>
											{initialsOf(character.name)}
										</span>
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="flex min-w-0 items-center gap-2">
												<span className="text-md-on-surface truncate text-title-medium-emph">
													{character.name}
												</span>
												{character.kind === "pc" ? (
													<Badge
														variant="soft"
														tone={claim ? "accent" : "default"}
														size="sm"
														className="shrink-0"
													>
														{claim
															? t("gm.workbench.claimShort", {
																	id: claim.holderId.slice(0, 8),
																})
															: t("gm.workbench.unclaimed")}
													</Badge>
												) : null}
											</span>
											<span
												className={cn(
													"truncate text-label-medium",
													critical
														? "text-danger"
														: "text-md-on-surface-variant",
												)}
											>
												{characterStatusLine(character)}
											</span>
										</span>
										<ChevronDown
											className={cn(
												"text-md-on-surface-variant size-5 shrink-0 transition-transform duration-200 ease-standard-fast-effects",
												expanded && "rotate-180",
											)}
										/>
									</button>

									{expanded ? (
										<div className="flex flex-col gap-2">
											{character.kind === "pc" ? (
												<div className="bg-md-surface-container-high/70 border-md-outline-variant/40 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
													<div className="flex min-w-0 items-center gap-2">
														<span
															className={cn(
																"grid size-7 shrink-0 place-items-center rounded-full",
																claim
																	? "bg-md-primary-container text-md-on-primary-container"
																	: "bg-md-surface-container-highest text-md-on-surface-variant",
															)}
														>
															{claim ? (
																<UserRoundCheck className="size-4" />
															) : (
																<UserRoundPlus className="size-4" />
															)}
														</span>
														<div className="flex min-w-0 flex-col">
															<span className="text-md-on-surface truncate text-label-large">
																{claim
																	? t("gm.workbench.claimedBy", {
																			id: claim.holderId.slice(0, 8),
																		})
																	: t("gm.workbench.claimNone")}
															</span>
															<span className="text-md-on-surface-variant text-label-small">
																{claim
																	? claimOnline
																		? t("gm.workbench.claimOnline")
																		: t("gm.workbench.claimOffline")
																	: presence.length > 0
																		? t("gm.workbench.claimAssignHint")
																		: t("gm.workbench.noOnlinePlayers")}
															</span>
														</div>
													</div>
													{claim ? (
														<Button
															type="button"
															variant="tertiary"
															size="sm"
															className="bg-md-surface-container-highest h-8 px-3"
															disabled={claimPending}
															onClick={() => void releaseClaim(claim.holderId)}
														>
															<UserRoundMinus className="size-4" />
															{t("gm.workbench.releaseClaim")}
														</Button>
													) : (
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	type="button"
																	variant="tertiary"
																	size="sm"
																	className="bg-md-surface-container-highest h-8 gap-1.5 px-3"
																	disabled={
																		claimPending || presence.length === 0
																	}
																>
																	<UserRoundPlus className="size-4" />
																	{t("gm.workbench.assignClaim")}
																	<ChevronDown className="size-3.5" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end" className="w-64">
																{presence.map((player) => {
																	const current = characters.find(
																		(item) =>
																			item.claim?.holderKind ===
																				player.holderKind &&
																			item.claim?.holderId === player.holderId,
																	);
																	return (
																		<DropdownMenuItem
																			key={`${player.holderKind}:${player.holderId}`}
																			className="gap-2"
																			onClick={() =>
																				void assignClaim(
																					player.holderId,
																					character.characterId,
																				)
																			}
																		>
																			<span className="min-w-0 flex-1 truncate">
																				{t("gm.workbench.playerShort", {
																					id: player.holderId.slice(0, 8),
																				})}
																			</span>
																			<span className="text-md-on-surface-variant max-w-24 truncate text-label-small">
																				{current
																					? current.name
																					: player.role === "ob"
																						? t("common.ob")
																						: t("common.pc")}
																			</span>
																		</DropdownMenuItem>
																	);
																})}
															</DropdownMenuContent>
														</DropdownMenu>
													)}
												</div>
											) : null}
											<div className="flex items-stretch gap-2">
												{portraits.length > 0 ? (
													<GmSelectField
														label={t("gm.workbench.expression")}
														value={expressionKey}
														className="flex-1"
														onValueChange={(value) =>
															sendExpression(character.characterId, value)
														}
													>
														{portraits.map((portrait) => (
															<SelectItem
																key={portrait.expressionKey}
																value={portrait.expressionKey}
															>
																{expressionLabel(portrait.expressionKey)}
															</SelectItem>
														))}
													</GmSelectField>
												) : (
													<GmValueField
														label={t("gm.workbench.expression")}
														value={t("gm.console.noPortrait")}
														disabled
													/>
												)}
												<GmValueField
													label="HP"
													value={state ? `${state.hp} / ${state.maxHp}` : "—"}
													actionLabel={t("gm.workbench.editStateFor", {
														name: character.name,
													})}
													onClick={() =>
														setEditorCharacterId(character.characterId)
													}
												/>
												<GmValueField
													label="MP"
													value={state ? `${state.mp} / ${state.maxMp}` : "—"}
													actionLabel={t("gm.workbench.editStateFor", {
														name: character.name,
													})}
													onClick={() =>
														setEditorCharacterId(character.characterId)
													}
												/>
												<GmValueField
													label="SAN"
													value={state ? `${state.san} / ${state.maxSan}` : "—"}
													actionLabel={t("gm.workbench.editStateFor", {
														name: character.name,
													})}
													onClick={() =>
														setEditorCharacterId(character.characterId)
													}
												/>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<Button
													type="button"
													variant="tertiary"
													size="sm"
													className="bg-md-surface-container-highest h-9"
													disabled={!character.sheet}
													onClick={() => {
														setSheetCharacterId(character.characterId);
														setSheetOpen(true);
													}}
												>
													<ContactRound className="size-4" />
													{t("gm.workbench.openSheet")}
												</Button>
												{character.kind === "npc" ? (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-danger h-9 gap-1.5 px-3"
														disabled={ended}
														onClick={() =>
															setRemoveTargetId(character.characterId)
														}
													>
														<UserRoundMinus className="size-4" />
														{t("gm.workbench.removeNpc")}
													</Button>
												) : null}
											</div>
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</GmPanelShell>
			<GmStateEditor
				character={editorCharacter}
				open={editorCharacterId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setEditorCharacterId(null);
					}
				}}
			/>
			<CharacterSheetPanel
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				initialCharacterId={sheetCharacterId}
			/>
			<AddNpcDialog
				open={addNpcOpen}
				onOpenChange={setAddNpcOpen}
				sessionId={sessionId}
				moduleId={moduleId}
				ruleId={ruleId}
				existingIds={characters.map((character) => character.characterId)}
			/>
			<ConfirmDialog
				open={removeTargetId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setRemoveTargetId(null);
					}
				}}
				icon={UserRoundMinus}
				confirmIcon={UserRoundMinus}
				title={t("gm.workbench.removeNpcTitle")}
				description={t("gm.workbench.removeNpcDescription", {
					name: removeTarget?.name ?? "",
				})}
				confirmLabel={t("gm.workbench.removeNpcConfirm")}
				onConfirm={() => {
					const id = removeTargetId;
					setRemoveTargetId(null);
					if (!id || !sessionId) {
						return;
					}
					void api(
						`/gm/sessions/${encodeURIComponent(sessionId)}/npcs/${encodeURIComponent(id)}`,
						{ method: "DELETE" },
					)
						.then(() => toast.success(t("gm.workbench.npcRemoved")))
						.catch((error) =>
							toast.error(errorText(error, "gm.workbench.npcRemoveFailed")),
						);
				}}
			/>
		</>
	);
}

function sendExpression(characterId: string, expressionKey: string) {
	sendSessionCommand("expression:set", { characterId, expressionKey });
}

export { CharactersPanel };
