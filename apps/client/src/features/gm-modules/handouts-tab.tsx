import type { CatalogHandoutDto } from "@cogm/shared";
import {
	Ellipsis,
	Expand,
	ImageOff,
	ImagePlus,
	Pencil,
	Plus,
	ScrollText,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
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
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { uploadMediaAsset } from "@/lib/media-upload";

type HandoutEditorState =
	| { mode: "create" }
	| { mode: "edit"; handout: CatalogHandoutDto }
	| null;

function padOrder(index: number) {
	return String(index + 1).padStart(2, "0");
}

export function ModuleHandoutsTab({
	moduleId,
	handouts,
	onReload,
}: {
	moduleId: string;
	handouts: CatalogHandoutDto[];
	onReload: () => Promise<void>;
}) {
	const [query, setQuery] = useState("");
	const [editor, setEditor] = useState<HandoutEditorState>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [existingAssetId, setExistingAssetId] = useState<string | null>(null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [previewImage, setPreviewImage] = useState<{
		title: string;
		src: string;
	} | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CatalogHandoutDto | null>(
		null,
	);

	useEffect(() => {
		if (!imageFile) {
			setFilePreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(imageFile);
		setFilePreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [imageFile]);

	function openCreate() {
		setTitle("");
		setContent("");
		setExistingAssetId(null);
		setImageFile(null);
		setEditor({ mode: "create" });
	}

	function openEdit(handout: CatalogHandoutDto) {
		setTitle(handout.title);
		setContent(handout.content);
		setExistingAssetId(handout.imageAssetId);
		setImageFile(null);
		setEditor({ mode: "edit", handout });
	}

	async function submitEditor() {
		const trimmed = title.trim();
		if (!trimmed || !editor) return;
		setSaving(true);
		try {
			const imageAssetId = imageFile
				? await uploadMediaAsset(imageFile, "handout")
				: existingAssetId;
			if (editor.mode === "create") {
				await api(`/gm/modules/${encodeURIComponent(moduleId)}/handouts`, {
					method: "POST",
					body: JSON.stringify({ title: trimmed, content, imageAssetId }),
				});
			} else {
				await api(
					`/gm/modules/handouts/${encodeURIComponent(editor.handout.id)}`,
					{
						method: "PATCH",
						body: JSON.stringify({ title: trimmed, content, imageAssetId }),
					},
				);
			}
			setEditor(null);
			setImageFile(null);
			await onReload();
		} catch (error) {
			toast.error(
				errorText(
					error,
					editor.mode === "create"
						? "gm.module.createHandoutFailed"
						: "gm.module.saveFailed",
				),
			);
		} finally {
			setSaving(false);
		}
	}

	const needle = query.trim().toLowerCase();
	const filtered = needle
		? handouts.filter(
				(item) =>
					item.title.toLowerCase().includes(needle) ||
					item.content.toLowerCase().includes(needle),
			)
		: handouts;

	const currentPreviewSrc =
		filePreviewUrl ?? (existingAssetId ? mediaUrl(existingAssetId) : null);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{handouts.length > 0 ? (
						<InputGroup className="h-10 max-w-xs min-w-0 flex-1 rounded-full border-md-outline-variant/80 px-4">
							<InputGroupAddon className="text-md-on-surface-variant">
								<Search aria-hidden />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("gm.module.searchHandoutsPlaceholder")}
								aria-label={t("gm.module.searchHandoutsPlaceholder")}
								className="placeholder:text-md-on-surface-variant/80"
							/>
						</InputGroup>
					) : null}
				</div>
				<Button type="button" variant="primary" size="sm" onClick={openCreate}>
					<Plus />
					{t("gm.module.createHandout")}
				</Button>
			</div>

			{handouts.length === 0 ? (
				<EmptyState
					icon={ScrollText}
					title={t("gm.module.emptyHandouts")}
					description={t("gm.module.emptyHandoutsHint")}
					action={
						<Button
							type="button"
							variant="primary"
							size="sm"
							onClick={openCreate}
						>
							<Plus />
							{t("gm.module.createHandout")}
						</Button>
					}
					className="rounded-lg border border-dashed border-md-outline-variant/60 bg-transparent py-14"
				/>
			) : filtered.length === 0 ? (
				<EmptyState
					icon={Search}
					title={t("gm.module.noSearchResults")}
					action={
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setQuery("")}
						>
							{t("gm.library.clearSearch")}
						</Button>
					}
					className="bg-transparent py-12"
				/>
			) : (
				/* 紧凑内嵌 4:3 图文档案卡：图文卡与纯文卡自然高度协调，零强制空洞与阶梯断层 */
				<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
					{filtered.map((handout) => {
						const index = handouts.findIndex((item) => item.id === handout.id);
						const imgSrc = handout.imageAssetId
							? mediaUrl(handout.imageAssetId)
							: null;
						const charCount = handout.content.trim().length;
						return (
							<article
								key={handout.id}
								className="group flex flex-col overflow-hidden rounded-lg border border-md-outline-variant/55 bg-md-surface-container transition-colors hover:border-md-outline"
							>
								<header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-md-outline-variant/45 bg-md-surface-container-low/50 pr-1.5 pl-4">
									<div className="flex items-center gap-2">
										<span className="font-mono text-label-small tabular-nums text-md-on-surface-variant">
											#{padOrder(index)}
										</span>
										<span
											aria-hidden
											className="text-label-small text-md-on-surface-variant/50"
										>
											·
										</span>
										<span className="text-label-small text-md-on-surface-variant">
											{imgSrc
												? t("gm.module.handoutTypeIllustrated")
												: t("gm.module.handoutTypeText")}
										</span>
										{charCount > 0 ? (
											<>
												<span
													aria-hidden
													className="text-label-small text-md-on-surface-variant/50"
												>
													·
												</span>
												<span className="text-label-small tabular-nums text-md-on-surface-variant">
													{t("gm.module.handoutChars", { count: charCount })}
												</span>
											</>
										) : null}
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="size-10 shrink-0 rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface sm:size-8"
												aria-label={t("gm.module.handoutActionsAria", {
													title: handout.title,
												})}
											>
												<Ellipsis className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => openEdit(handout)}>
												<Pencil />
												{t("gm.module.editHandoutTitle")}
											</DropdownMenuItem>
											{imgSrc ? (
												<DropdownMenuItem
													onClick={() =>
														setPreviewImage({
															title: handout.title,
															src: imgSrc,
														})
													}
												>
													<Expand />
													{t("gm.module.previewHandoutImage")}
												</DropdownMenuItem>
											) : null}
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setDeleteTarget(handout)}
											>
												<Trash2 />
												{t("gm.module.deleteHandoutTitle")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</header>

								<div className="flex flex-1 items-start gap-4 p-4">
									<div className="flex min-w-0 flex-1 flex-col gap-2">
										<button
											type="button"
											onClick={() => openEdit(handout)}
											className="cursor-pointer rounded-xs text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
										>
											<h3 className="text-title-medium-emph text-md-on-surface transition-colors group-hover:text-accent">
												{handout.title}
											</h3>
										</button>

										<p className="line-clamp-5 whitespace-pre-wrap text-body-medium text-md-on-surface-variant select-text">
											{handout.content || t("gm.module.handoutEmptyContent")}
										</p>
									</div>

									{imgSrc ? (
										<button
											type="button"
											onClick={() =>
												setPreviewImage({ title: handout.title, src: imgSrc })
											}
											aria-label={t("gm.module.previewHandoutImageAria", {
												title: handout.title,
											})}
											className="relative aspect-[4/3] w-32 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-md-outline-variant/65 bg-md-surface-container-lowest outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
										>
											<img
												src={imgSrc}
												alt={handout.title}
												loading="lazy"
												decoding="async"
												className="size-full object-cover transition-transform duration-500 ease-standard-default-spatial group-hover:scale-[1.04]"
											/>
											<span className="bg-md-scrim/65 text-md-on-surface absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
												<Expand className="size-3.5" aria-hidden />
											</span>
										</button>
									) : null}
								</div>
							</article>
						);
					})}
				</div>
			)}

			{/* 新建 / 编辑情报弹窗 */}
			<Dialog
				open={editor !== null}
				onOpenChange={(open) => {
					if (!open) {
						setEditor(null);
						setImageFile(null);
					}
				}}
			>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>
							{editor?.mode === "edit"
								? t("gm.module.editHandoutTitle")
								: t("gm.module.createHandout")}
						</DialogTitle>
					</DialogHeader>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void submitEditor();
						}}
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="handout-editor-title">
								{t("gm.module.handoutTitleLabel")}
							</Label>
							<Input
								id="handout-editor-title"
								value={title}
								autoFocus
								required
								onChange={(event) => setTitle(event.target.value)}
								placeholder={t("gm.module.handoutTitlePlaceholder")}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="handout-editor-content">
								{t("gm.module.handoutContentLabel")}
							</Label>
							<Textarea
								id="handout-editor-content"
								value={content}
								rows={5}
								onChange={(event) => setContent(event.target.value)}
								placeholder={t("gm.module.handoutContentPlaceholder")}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="handout-editor-image">
								{t("gm.module.handoutImageLabel")}
							</Label>
							<label
								htmlFor="handout-editor-image"
								className="relative flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-md-outline-variant bg-md-surface-container-lowest text-md-on-surface-variant transition-colors hover:border-md-outline hover:text-md-on-surface"
							>
								{currentPreviewSrc ? (
									<img
										src={currentPreviewSrc}
										alt=""
										className="size-full object-cover"
									/>
								) : (
									<>
										<ImagePlus className="size-5" aria-hidden />
										<span className="text-body-small">
											{t("gm.module.chooseHandoutImage")}
										</span>
									</>
								)}
								<input
									id="handout-editor-image"
									type="file"
									accept="image/*"
									className="sr-only"
									onChange={(event) =>
										setImageFile(event.target.files?.[0] ?? null)
									}
								/>
							</label>
							{currentPreviewSrc ? (
								<div className="flex justify-end">
									<Button
										type="button"
										variant="text"
										size="xs"
										onClick={() => {
											setImageFile(null);
											setExistingAssetId(null);
										}}
									>
										<ImageOff />
										{t("gm.module.removeHandoutImage")}
									</Button>
								</div>
							) : null}
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="tertiary"
								onClick={() => setEditor(null)}
							>
								{t("common.cancel")}
							</Button>
							<Button
								type="submit"
								variant="primary"
								disabled={saving || !title.trim()}
							>
								{editor?.mode === "edit"
									? t("gm.module.save")
									: t("gm.module.createHandout")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* 配图大图预览 */}
			<Dialog
				open={previewImage !== null}
				onOpenChange={(open) => !open && setPreviewImage(null)}
			>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>{previewImage?.title ?? ""}</DialogTitle>
					</DialogHeader>
					{previewImage ? (
						<div className="overflow-hidden rounded-lg bg-md-surface-container-lowest">
							<img
								src={previewImage.src}
								alt={previewImage.title}
								className="max-h-[70vh] w-full object-contain"
							/>
						</div>
					) : null}
				</DialogContent>
			</Dialog>

			{/* 删除确认 */}
			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("gm.module.deleteHandoutTitle")}
				description={t("gm.module.deleteHandoutDescription", {
					title: deleteTarget?.title ?? "",
				})}
				confirmLabel={t("common.delete")}
				onConfirm={() => {
					const target = deleteTarget;
					setDeleteTarget(null);
					if (!target) return;
					void api(`/gm/modules/handouts/${encodeURIComponent(target.id)}`, {
						method: "DELETE",
					})
						.then(() => onReload())
						.catch((error) =>
							toast.error(errorText(error, "gm.module.deleteFailed")),
						);
				}}
			/>
		</div>
	);
}
