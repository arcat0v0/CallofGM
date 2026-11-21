import type {
	CharacterDetailDto,
	GmCharacterLibraryItemDto,
	GmCharacterLibraryFacets,
} from "@cogm/shared";
import {
	ChevronLeft,
	Ellipsis,
	FileSpreadsheet,
	ImageIcon,
	Link2,
	PencilLine,
	Plus,
	ScrollText,
	Trash2,
	UserRound,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { CharacterProfileEditorDialog } from "@/features/characters/character-profile-editor-dialog";
import { t } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { expressionLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { PortraitFrame } from "./portrait-frame";

function Section({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2 border-t border-md-outline-variant/60 pt-4">
			<header className="flex min-h-8 items-center justify-between gap-3">
				<h3 className="text-label-large text-md-on-surface-variant">{title}</h3>
				{aside}
			</header>
			{children}
		</section>
	);
}

function formatFull(epochMs: number) {
	const date = new Date(epochMs);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 选中人物的检视器：立绘为主角，规则摘要经规则组件提供，页面本身不理解其含义 */
export function CharacterInspector({
	item,
	facets,
	onBack,
	onOpenSheet,
	onImportUpdate,
	onChanged,
	onDeleted,
	className,
}: {
	item: GmCharacterLibraryItemDto;
	facets: GmCharacterLibraryFacets | null;
	onBack?: () => void;
	onOpenSheet: (id: string) => void;
	onImportUpdate: (id: string) => void;
	onChanged: () => void;
	onDeleted: (id: string) => void;
	className?: string;
}) {
	const [detail, setDetail] = useState<CharacterDetailDto | null>(null);
	const [detailFailed, setDetailFailed] = useState(false);
	const [expression, setExpression] = useState<string | null>(null);
	const [profileOpen, setProfileOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [linking, setLinking] = useState<string | null>(null);
	const rule = getRuleComponent(item.ruleId);
	const editable = item.ownedByMe;

	const reloadDetail = useMemo(
		() => () =>
			api<CharacterDetailDto>(`/gm/characters/${encodeURIComponent(item.id)}`)
				.then((next) => {
					setDetail(next);
					setDetailFailed(false);
				})
				.catch(() => setDetailFailed(true)),
		[item.id],
	);

	useEffect(() => {
		setDetail(null);
		setExpression(null);
		void reloadDetail();
		// 列表项更新时间变化（编辑、关联后）也要刷新详情
	}, [reloadDetail, item.updatedAt]);

	const portraits = useMemo(
		() =>
			[...(detail?.portraits ?? [])].sort(
				(a, b) => b.isDefault - a.isDefault || a.sortOrder - b.sortOrder,
			),
		[detail?.portraits],
	);
	const shown =
		portraits.find((portrait) => portrait.id === expression) ?? portraits[0];
	const heroSrc = shown
		? mediaUrl(shown.portraitAssetId)
		: mediaUrl(item.portraitAssetId);

	const summary = useMemo(() => {
		if (!detail) return [];
		const sheet = rule.parseSheetJson(detail.sheetJson);
		if (!sheet) return [];
		return [
			...rule.sheetOverview(sheet),
			...rule.summaryMetrics(sheet).map(({ label, value }) => ({ label, value })),
		];
	}, [detail, rule]);

	const linkedIds = new Set(item.modules.map((module) => module.id));
	const ruleModules = facets?.modules ?? [];

	async function setLinked(moduleId: string, linked: boolean) {
		setLinking(moduleId);
		try {
			await api(
				linked
					? `/gm/modules/${encodeURIComponent(moduleId)}/characters`
					: `/gm/modules/${encodeURIComponent(moduleId)}/characters/${encodeURIComponent(item.id)}`,
				linked
					? { method: "POST", body: JSON.stringify({ characterId: item.id }) }
					: { method: "DELETE" },
			);
			onChanged();
		} catch (error) {
			toast.error(errorText(error, "gm.library.linkFailed"));
		} finally {
			setLinking(null);
		}
	}

	const identity = (
		<div className="flex flex-col gap-1">
			<h2 className="text-headline-small-emph break-words text-md-on-surface">
				{item.name}
			</h2>
			<p className="flex flex-wrap items-center gap-x-2 text-body-medium text-md-on-surface-variant">
				<span>
					{item.kind === "npc"
						? t("gm.library.kindNpc")
						: t("gm.library.kindPc")}
				</span>
				<span aria-hidden>·</span>
				{editable ? (
					<span>{t("gm.library.ownerMine")}</span>
				) : (
					<span className="inline-flex items-center gap-1 text-md-on-surface">
						<UserRound className="size-4" aria-hidden />
						{t("gm.library.ownerPlayer", { name: item.ownerName ?? "" })}
					</span>
				)}
			</p>
		</div>
	);

	return (
		<article
			aria-label={item.name}
			className={cn("flex min-h-0 flex-col", className)}
		>
			{onBack ? (
				<div className="sticky top-0 z-10 flex h-12 items-center border-b border-md-outline-variant/60 bg-md-surface-container px-2">
					<Button
						type="button"
						variant="text"
						size="sm"
						onClick={onBack}
						className="text-md-on-surface"
					>
						<ChevronLeft />
						{t("gm.library.back")}
					</Button>
				</div>
			) : null}
			<div className="flex flex-col gap-5 p-5">
				{heroSrc ? (
					<>
						<div className="relative">
							<PortraitFrame name={item.name} src={heroSrc} size="hero" />
							{portraits.length > 1 ? (
								<div
									role="tablist"
									aria-label={t("gm.library.expressionsTitle")}
									className="absolute inset-x-0 bottom-0 flex gap-1.5 overflow-x-auto rounded-b-md bg-linear-to-t from-md-scrim/80 to-transparent px-3 pt-8 pb-3"
								>
									{portraits.map((portrait) => {
										const active = portrait.id === shown?.id;
										const label = expressionLabel(
											portrait.expressionKey,
											portrait.label,
										);
										return (
											<button
												key={portrait.id}
												type="button"
												role="tab"
												aria-selected={active}
												aria-label={label}
												title={label}
												onClick={() => setExpression(portrait.id)}
												className={cn(
													"size-11 shrink-0 overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
													active
														? "ring-2 ring-accent"
														: "opacity-75 hover:opacity-100",
												)}
											>
												<img
													src={mediaUrl(portrait.portraitAssetId) ?? undefined}
													alt=""
													className="size-full object-cover object-top"
												/>
											</button>
										);
									})}
								</div>
							) : null}
						</div>
						{identity}
					</>
				) : (
					<div className="flex items-center gap-4">
						<PortraitFrame name={item.name} src={null} size="card" />
						{identity}
					</div>
				)}

				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="min-w-0 flex-1"
						onClick={() => onOpenSheet(item.id)}
					>
						{editable ? <PencilLine /> : <ScrollText />}
						{editable ? t("gm.library.edit") : t("gm.library.view")}
					</Button>
					{editable ? (
						<Button
							type="button"
							variant="text"
							size="sm"
							disabled={!detail}
							onClick={() => setProfileOpen(true)}
							className="shrink-0 text-md-on-surface max-sm:px-2.5"
						>
							<ImageIcon />
							<span className="max-sm:sr-only">{t("gm.library.profile")}</span>
						</Button>
					) : null}
					{editable ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="text-md-on-surface-variant"
									aria-label={t("gm.library.more", { name: item.name })}
								>
									<Ellipsis />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{rule.capabilities?.excelImport ? (
									<DropdownMenuItem onClick={() => onImportUpdate(item.id)}>
										<FileSpreadsheet />
										{t("gm.library.importUpdate")}
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem
									variant="destructive"
									onClick={() => setDeleteOpen(true)}
								>
									<Trash2 />
									{t("gm.library.delete")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>

				<Section
					title={t("gm.library.modulesTitle")}
					aside={
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="text"
									size="xs"
									className="h-8 px-2"
								>
									<Plus />
									{t("gm.library.linkModule")}
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-64 p-2">
								{ruleModules.length === 0 ? (
									<p className="px-2 py-3 text-body-medium text-md-on-surface-variant">
										{t("gm.library.linkNone")}
									</p>
								) : (
									<ul className="flex max-h-72 flex-col overflow-y-auto">
										{ruleModules.map((module) => {
											const checked = linkedIds.has(module.id);
											const inputId = `link-${item.id}-${module.id}`;
											return (
												<li key={module.id}>
													<label
														htmlFor={inputId}
														className="flex h-10 cursor-pointer items-center gap-3 rounded-xs px-2 text-body-medium hover:bg-md-surface-container-high"
													>
														<Checkbox
															id={inputId}
															checked={checked}
															disabled={linking !== null || (!editable && checked)}
															onCheckedChange={(next) =>
																void setLinked(module.id, next === true)
															}
														/>
														<span className="min-w-0 flex-1 truncate">
															{module.name}
														</span>
													</label>
												</li>
											);
										})}
									</ul>
								)}
							</PopoverContent>
						</Popover>
					}
				>
					{item.modules.length === 0 ? (
						<p className="text-body-medium text-md-on-surface-variant">
							{t("gm.library.noModules")}
						</p>
					) : (
						<ul className="flex flex-col">
							{item.modules.map((module) => (
								<li
									key={module.id}
									className="group flex h-9 items-center gap-2 text-body-medium text-md-on-surface"
								>
									<Link2
										className="size-4 shrink-0 text-md-on-surface-variant"
										aria-hidden
									/>
									<span className="min-w-0 flex-1 truncate">{module.name}</span>
									{editable ? (
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											disabled={linking !== null}
											onClick={() => void setLinked(module.id, false)}
											aria-label={t("gm.library.unlinkAria", {
												name: module.name,
											})}
											className="size-8 text-md-on-surface-variant opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
										>
											<X />
										</Button>
									) : null}
								</li>
							))}
						</ul>
					)}
				</Section>

				<Section title={t("gm.library.summaryTitle")}>
					{detailFailed ? (
						<p className="text-body-medium text-md-error">
							{t("gm.library.detailFailed")}
						</p>
					) : !detail ? (
						<div className="grid grid-cols-2 gap-x-6 gap-y-3" aria-busy>
							{[0, 1, 2, 3].map((index) => (
								<div
									key={index}
									className="h-10 animate-pulse rounded-xs bg-md-surface-container-high"
								/>
							))}
						</div>
					) : summary.length === 0 ? (
						<p className="text-body-medium text-md-on-surface-variant">
							{t("gm.library.summaryEmpty")}
						</p>
					) : (
						<dl className="grid grid-cols-2 gap-x-6">
							{summary.map((entry, index) => (
								<div
									key={`${entry.label}-${index}`}
									className={cn(
										"flex flex-col gap-0.5 border-b border-md-outline-variant/40 py-2",
										index === summary.length - 1 &&
											summary.length % 2 === 1 &&
											"col-span-2",
									)}
								>
									<dt className="text-label-medium text-md-on-surface-variant">
										{entry.label}
									</dt>
									<dd className="text-body-large tabular-nums text-md-on-surface">
										{entry.value}
									</dd>
								</div>
							))}
						</dl>
					)}
				</Section>

				<p className="text-label-medium tabular-nums text-md-on-surface-variant">
					{t("gm.library.updatedAt", { time: formatFull(item.updatedAt) })}
				</p>
			</div>

			{detail && editable ? (
				<CharacterProfileEditorDialog
					scope="gm"
					character={detail}
					open={profileOpen}
					onClose={() => setProfileOpen(false)}
					onSaved={(next) => {
						setDetail(next);
						onChanged();
					}}
				/>
			) : null}
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.library.delete")}
				description={t("gm.library.deleteDescription", { name: item.name })}
				confirmLabel={t("common.delete")}
				onConfirm={() => {
					setDeleteOpen(false);
					void api(`/gm/characters/${encodeURIComponent(item.id)}`, {
						method: "DELETE",
					})
						.then(() => {
							toast.success(t("gm.library.deleted", { name: item.name }));
							onDeleted(item.id);
						})
						.catch((error) =>
							toast.error(errorText(error, "gm.library.deleteFailed")),
						);
				}}
			/>
		</article>
	);
}
