import type {
	GmCharacterLibraryItemDto,
	GmCharacterLibraryResponse,
} from "@cogm/shared";
import { Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Check,
	Ellipsis,
	Link2,
	Plus,
	Search,
	Unlink,
	UserPlus,
	UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { monogramOf } from "@/features/gm-characters/library-model";
import { PortraitFrame } from "@/features/gm-characters/portrait-frame";
import { t } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";

function KindTag({ kind, overlay = false }: { kind: string; overlay?: boolean }) {
	const isPc = kind === "pc";
	return (
		<span
			className={cn(
				"rounded-xs border px-1.5 py-0.5 font-mono text-label-small tracking-[0.04em]",
				overlay
					? isPc
						? "border-md-outline/75 bg-md-surface-container-lowest/85 text-md-on-surface backdrop-blur-sm"
						: "border-md-outline-variant/65 bg-md-surface-container-lowest/85 text-md-on-surface-variant backdrop-blur-sm"
					: isPc
						? "border-md-outline/75 bg-md-surface-container-highest text-md-on-surface"
						: "border-md-outline-variant/60 bg-md-surface-container-low text-md-on-surface-variant",
			)}
		>
			{isPc ? t("gm.library.kindPc") : t("gm.library.kindNpc")}
		</span>
	);
}

function CharacterPortraitStage({
	character,
}: {
	character: GmCharacterLibraryItemDto;
}) {
	const [failed, setFailed] = useState(false);
	const src = character.portraitAssetId
		? mediaUrl(character.portraitAssetId)
		: null;
	const showImage = Boolean(src) && !failed;

	return (
		<div className="relative aspect-[3/4] w-full overflow-hidden border-b border-md-outline-variant/60 bg-md-surface-container-lowest after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-inset after:ring-md-on-surface/8">
			{showImage ? (
				<img
					src={src ?? undefined}
					alt={character.name}
					loading="lazy"
					decoding="async"
					onError={() => setFailed(true)}
					className="size-full object-cover object-top transition-transform duration-500 ease-standard-default-spatial group-hover:scale-[1.03]"
				/>
			) : (
				<div className="relative flex size-full flex-col items-center justify-center gap-2 bg-md-surface-container-lowest">
					<span
						aria-hidden
						className="pointer-events-none absolute inset-x-7 inset-y-12"
					>
						<span className="absolute top-0 left-0 size-2.5 border-t border-l border-md-outline/70" />
						<span className="absolute top-0 right-0 size-2.5 border-t border-r border-md-outline/70" />
						<span className="absolute bottom-0 left-0 size-2.5 border-b border-l border-md-outline/70" />
						<span className="absolute right-0 bottom-0 size-2.5 border-r border-b border-md-outline/70" />
					</span>
					<span
						aria-hidden
						className="select-none font-sans text-display-small text-md-on-surface-variant"
					>
						{monogramOf(character.name)}
					</span>
					<span className="text-label-medium text-md-on-surface-variant">
						{t("gm.module.noExpressions")}
					</span>
				</div>
			)}

			<div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5">
				<KindTag kind={character.kind} overlay />
			</div>
		</div>
	);
}

export function ModuleCharactersTab({
	moduleId,
	ruleId,
	onCountChange,
	onOpenInvites,
}: {
	moduleId: string;
	ruleId: string;
	onCountChange: (count: number) => void;
	onOpenInvites: () => void;
}) {
	const rule = getRuleComponent(ruleId);
	const [linked, setLinked] = useState<GmCharacterLibraryItemDto[]>([]);
	const [loading, setLoading] = useState(true);
	const [kindFilter, setKindFilter] = useState<"all" | "pc" | "npc">("all");
	const [query, setQuery] = useState("");
	const [busyId, setBusyId] = useState<string | null>(null);

	// 关联同规则人物弹窗状态
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerQuery, setPickerQuery] = useState("");
	const [pickerKind, setPickerKind] = useState<"all" | "pc" | "npc">("all");
	const [libraryItems, setLibraryItems] = useState<GmCharacterLibraryItemDto[]>(
		[],
	);
	const [pickerLoading, setPickerLoading] = useState(false);

	const loadLinked = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				ruleId,
				moduleId,
				limit: "100",
				sort: "name",
			});
			const page = await api<GmCharacterLibraryResponse>(
				`/gm/characters/library?${params.toString()}`,
			);
			const items = Array.isArray(page.items) ? page.items : [];
			setLinked(items);
			onCountChange(typeof page.total === "number" ? page.total : items.length);
		} catch (error) {
			toast.error(errorText(error, "gm.module.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, [moduleId, onCountChange, ruleId]);

	useEffect(() => {
		void loadLinked();
	}, [loadLinked]);

	const loadPicker = useCallback(async () => {
		setPickerLoading(true);
		try {
			const params = new URLSearchParams({
				ruleId,
				limit: "100",
				sort: "updated",
			});
			if (pickerKind !== "all") params.set("kind", pickerKind);
			if (pickerQuery.trim()) params.set("q", pickerQuery.trim());
			const page = await api<GmCharacterLibraryResponse>(
				`/gm/characters/library?${params.toString()}`,
			);
			setLibraryItems(page.items);
		} catch (error) {
			toast.error(errorText(error, "gm.module.loadFailed"));
		} finally {
			setPickerLoading(false);
		}
	}, [pickerKind, pickerQuery, ruleId]);

	useEffect(() => {
		if (!pickerOpen) return;
		const timer = window.setTimeout(() => {
			void loadPicker();
		}, 150);
		return () => window.clearTimeout(timer);
	}, [pickerOpen, loadPicker]);

	async function toggleLink(characterId: string, shouldLink: boolean) {
		setBusyId(characterId);
		try {
			if (shouldLink) {
				await api(`/gm/modules/${encodeURIComponent(moduleId)}/characters`, {
					method: "POST",
					body: JSON.stringify({ characterId }),
				});
			} else {
				await api(
					`/gm/modules/${encodeURIComponent(moduleId)}/characters/${encodeURIComponent(characterId)}`,
					{ method: "DELETE" },
				);
			}
			await loadLinked();
			if (pickerOpen) {
				await loadPicker();
			}
		} catch (error) {
			toast.error(errorText(error, "gm.module.operationFailed"));
		} finally {
			setBusyId(null);
		}
	}

	const linkedIds = new Set(linked.map((item) => item.id));
	const needle = query.trim().toLowerCase();
	const filteredLinked = linked.filter((item) => {
		if (kindFilter !== "all" && item.kind !== kindFilter) return false;
		if (needle && !item.name.toLowerCase().includes(needle)) return false;
		return true;
	});

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
					{linked.length > 0 ? (
						<>
							<InputGroup className="h-10 max-w-xs min-w-44 flex-1 rounded-full border-md-outline-variant/80 px-4">
								<InputGroupAddon className="text-md-on-surface-variant">
									<Search aria-hidden />
								</InputGroupAddon>
								<InputGroupInput
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={t("gm.library.searchPlaceholder")}
									aria-label={t("gm.library.searchAria")}
									className="placeholder:text-md-on-surface-variant/80"
								/>
							</InputGroup>
							<SegmentedControl
								aria-label={t("gm.library.groupKind")}
								value={kindFilter}
								onValueChange={(value) =>
									setKindFilter(value as "all" | "pc" | "npc")
								}
								className="border border-md-outline-variant/65 bg-md-surface-container-high"
								itemClassName="px-3.5"
								options={[
									{ value: "all", label: t("gm.module.filterAll") },
									{ value: "pc", label: t("gm.library.kindPc") },
									{ value: "npc", label: t("gm.library.kindNpc") },
								]}
							/>
						</>
					) : (
						<span className="text-body-small text-md-on-surface-variant">
							{t("gm.module.sameRuleCharactersHint", {
								rule: rule.shortName,
							})}
						</span>
					)}
				</div>
				<Button
					type="button"
					variant="primary"
					size="sm"
					onClick={() => setPickerOpen(true)}
				>
					<Plus />
					{t("gm.module.linkCharacter")}
				</Button>
			</div>

			{loading ? (
				<div
					className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
					aria-busy
				>
					{[0, 1, 2, 3].map((idx) => (
						<div
							key={idx}
							className="aspect-[3/4] animate-pulse rounded-lg bg-md-surface-container"
						/>
					))}
				</div>
			) : linked.length === 0 ? (
				<EmptyState
					icon={UserPlus}
					title={t("gm.module.emptyLinkedCharacters")}
					description={t("gm.module.emptyLinkedCharactersHint", {
						rule: rule.shortName,
					})}
					action={
						<div className="flex flex-wrap justify-center gap-2">
							<Button
								type="button"
								variant="primary"
								size="sm"
								onClick={() => setPickerOpen(true)}
							>
								<Plus />
								{t("gm.module.linkCharacter")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onOpenInvites}
							>
								<Link2 />
								{t("gm.invites.open")}
							</Button>
						</div>
					}
					className="rounded-lg border border-dashed border-md-outline-variant/60 bg-transparent py-14"
				/>
			) : filteredLinked.length === 0 ? (
				<EmptyState
					icon={Search}
					title={t("gm.module.noSearchResults")}
					action={
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setQuery("");
								setKindFilter("all");
							}}
						>
							{t("gm.library.clearFilters")}
						</Button>
					}
					className="bg-transparent py-12"
				/>
			) : (
				/* 竖版 3:4 角色定妆立绘卡，与场景宽屏舞台和兄弟页人物库保持一致的视觉陈列密度 */
				<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{filteredLinked.map((character) => {
						const spriteText =
							character.expressionCount > 0
								? t("gm.module.expressionCount", {
										count: character.expressionCount,
									})
								: t("gm.module.noExpressions");
						return (
							<li key={character.id} className="min-w-0">
								<article className="group flex h-full flex-col overflow-hidden rounded-lg border border-md-outline-variant/55 bg-md-surface-container transition-colors hover:border-md-outline">
									<Link
										to="/gm/characters/$characterId"
										params={{ characterId: character.id }}
										className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
									>
										<CharacterPortraitStage character={character} />
									</Link>

									<div className="flex items-center justify-between gap-2 py-2.5 pr-1.5 pl-3.5">
										<Link
											to="/gm/characters/$characterId"
											params={{ characterId: character.id }}
											className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
										>
											<h3 className="truncate text-title-small-emph text-md-on-surface transition-colors group-hover:text-accent">
												{character.name}
											</h3>
											<div className="flex min-w-0 items-center gap-1.5 text-body-small text-md-on-surface-variant">
												{!character.ownedByMe ? (
													<span className="inline-flex min-w-0 items-center gap-1 truncate">
														<UserRound
															className="size-3 shrink-0"
															aria-hidden
														/>
														<span className="truncate">
															{t("gm.library.ownerPlayer", {
																name: character.ownerName ?? "",
															})}
														</span>
													</span>
												) : (
													<span className="truncate">{spriteText}</span>
												)}
												{character.modules.length > 1 ? (
													<>
														<span
															aria-hidden
															className="text-md-on-surface-variant/60"
														>
															·
														</span>
														<span className="shrink-0">
															{t("gm.module.sharedModules", {
																count: character.modules.length,
															})}
														</span>
													</>
												) : null}
											</div>
										</Link>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													disabled={busyId === character.id}
													className="size-11 shrink-0 rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface sm:size-9"
													aria-label={t("gm.module.characterActionsAria", {
														name: character.name,
													})}
												>
													<Ellipsis className="size-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem asChild>
													<Link
														to="/gm/characters/$characterId"
														params={{ characterId: character.id }}
													>
														<ArrowUpRight />
														{t("gm.module.openCharacter")}
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													variant="destructive"
													onClick={() => void toggleLink(character.id, false)}
												>
													<Unlink />
													{t("gm.module.unlinkCharacterShort")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}

			{/* 从同规则人物库关联弹窗 */}
			<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
				<DialogContent className="flex max-h-[82vh] max-w-xl flex-col overflow-hidden">
					<DialogHeader className="shrink-0">
						<DialogTitle>{t("gm.module.linkCharacter")}</DialogTitle>
						<DialogDescription>
							{t("gm.module.sameRuleCharactersHint", {
								rule: rule.shortName,
							})}
						</DialogDescription>
					</DialogHeader>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<InputGroup className="h-10 min-w-0 flex-1 rounded-full px-4">
							<InputGroupAddon className="text-md-on-surface-variant">
								<Search aria-hidden />
							</InputGroupAddon>
							<InputGroupInput
								value={pickerQuery}
								autoFocus
								onChange={(event) => setPickerQuery(event.target.value)}
								placeholder={t("gm.library.searchPlaceholder")}
								aria-label={t("gm.library.searchAria")}
								className="placeholder:text-md-on-surface-variant/80"
							/>
						</InputGroup>
						<SegmentedControl
							aria-label={t("gm.library.groupKind")}
							value={pickerKind}
							onValueChange={(value) =>
								setPickerKind(value as "all" | "pc" | "npc")
							}
							itemClassName="px-3"
							options={[
								{ value: "all", label: t("gm.module.filterAll") },
								{ value: "pc", label: t("gm.library.kindPc") },
								{ value: "npc", label: t("gm.library.kindNpc") },
							]}
						/>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto border-y border-md-outline-variant/50 py-1">
						{pickerLoading ? (
							<div className="flex flex-col gap-2 py-2" aria-busy>
								{[0, 1, 2, 3].map((idx) => (
									<div
										key={idx}
										className="h-12 animate-pulse rounded-sm bg-md-surface-container-high"
									/>
								))}
							</div>
						) : libraryItems.length === 0 ? (
							<div className="flex flex-col items-center gap-3 py-10 text-center">
								<p className="text-body-medium text-md-on-surface-variant">
									{t("gm.module.noMatchingLibraryCharacters", {
										rule: rule.shortName,
									})}
								</p>
								<Button asChild type="button" variant="outline" size="sm">
									<Link to="/gm/characters" search={{ rule: ruleId }}>
										<ArrowUpRight />
										{t("gm.module.goCharacterLibrary")}
									</Link>
								</Button>
							</div>
						) : (
							<ul className="divide-y divide-md-outline-variant/35">
								{libraryItems.map((character) => {
									const isLinked = linkedIds.has(character.id);
									return (
										<li
											key={character.id}
											className="flex items-center gap-3 px-2 py-2"
										>
											<PortraitFrame
												name={character.name}
												src={mediaUrl(character.portraitAssetId)}
												size="thumb"
											/>
											<div className="flex min-w-0 flex-1 flex-col">
												<div className="flex items-center gap-2">
													<span className="truncate text-body-medium text-md-on-surface">
														{character.name}
													</span>
													<KindTag kind={character.kind} />
												</div>
												{!character.ownedByMe ? (
													<span className="truncate text-label-small text-md-on-surface-variant">
														{t("gm.library.ownerPlayer", {
															name: character.ownerName ?? "",
														})}
													</span>
												) : null}
											</div>
											<Button
												type="button"
												size="sm"
												variant={isLinked ? "accentSoft" : "outline"}
												disabled={busyId === character.id}
												className="h-8 shrink-0 px-3"
												onClick={() => void toggleLink(character.id, !isLinked)}
											>
												{isLinked ? (
													<Check className="size-3.5" />
												) : (
													<Plus className="size-3.5" />
												)}
												{isLinked
													? t("gm.module.linkedShort")
													: t("gm.module.link")}
											</Button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
