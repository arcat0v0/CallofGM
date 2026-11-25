import { MAX_MEDIA_UPLOAD_BYTES, type SceneDto } from "@cogm/shared";
import {
	ArrowDown,
	ArrowUp,
	Check,
	Ellipsis,
	Expand,
	ImageOff,
	ImagePlus,
	Pencil,
	Plus,
	Search,
	Star,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UploadProgressBar } from "@/components/shared/upload-progress";
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
import { t } from "@/i18n";
import { api, mediaUrl, type UploadProgress } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { uploadMediaAsset } from "@/lib/media-upload";

function padOrder(index: number) {
	return String(index + 1).padStart(2, "0");
}

function SceneTile({
	scene,
	index,
	total,
	isCover,
	onPreview,
	onReload,
	onRequestDelete,
	onMove,
	onSetCover,
}: {
	scene: SceneDto;
	index: number;
	total: number;
	isCover: boolean;
	onPreview: () => void;
	onReload: () => Promise<void>;
	onRequestDelete: () => void;
	onMove: (delta: -1 | 1) => Promise<void>;
	onSetCover: () => Promise<void>;
}) {
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(scene.name);
	const [busy, setBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
		null,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setDraftName(scene.name);
	}, [scene.name]);

	const src = scene.bgAssetId ? mediaUrl(scene.bgAssetId) : null;

	async function commitRename() {
		const trimmed = draftName.trim();
		if (!trimmed || trimmed === scene.name) {
			setRenaming(false);
			setDraftName(scene.name);
			return;
		}
		setBusy(true);
		try {
			await api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ name: trimmed }),
			});
			setRenaming(false);
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setBusy(false);
		}
	}

	async function replaceImage(file: File) {
		setBusy(true);
		try {
			const bgAssetId = await uploadMediaAsset(file, "scene", {
				onProgress: setUploadProgress,
			});
			await api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ bgAssetId }),
			});
			toast.success(t("gm.module.sceneBgUpdated"));
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setUploadProgress(null);
			setBusy(false);
		}
	}

	async function clearImage() {
		setBusy(true);
		try {
			await api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ bgAssetId: null }),
			});
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<article className="group flex flex-col overflow-hidden rounded-lg border border-md-outline-variant/55 bg-md-surface-container transition-colors hover:border-md-outline">
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="sr-only"
				aria-label={t("gm.module.replaceSceneBgAria", { name: scene.name })}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file) return;
					if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
						toast.error(t("error.FILE_SIZE_EXCEEDED"));
						return;
					}
					void replaceImage(file);
				}}
			/>

			<div className="relative aspect-[16/9] w-full overflow-hidden border-b border-md-outline-variant/65 bg-md-surface-container-lowest after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-inset after:ring-md-on-surface/8">
				{src ? (
					<button
						type="button"
						onClick={onPreview}
						aria-label={t("gm.module.previewSceneAria", { name: scene.name })}
						className="relative block size-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
					>
						<img
							src={src}
							alt={scene.name}
							loading="lazy"
							decoding="async"
							className="size-full object-cover transition-transform duration-500 ease-standard-default-spatial group-hover:scale-[1.03]"
						/>
						<span className="bg-md-scrim/60 text-md-on-surface absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-sm opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
							<Expand className="size-4" aria-hidden />
						</span>
					</button>
				) : (
					<button
						type="button"
						disabled={busy}
						onClick={() => fileInputRef.current?.click()}
						className="relative flex size-full cursor-pointer flex-col items-center justify-center gap-1.5 bg-md-surface-container-lowest px-4 text-center text-md-on-surface-variant transition-colors hover:bg-md-surface-container-low hover:text-md-on-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
					>
						{/* 对称中心取景框刻度：四隅对称，完全避开左上 #04 编号 */}
						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-10 inset-y-10"
						>
							<span className="absolute top-0 left-0 size-2.5 border-t border-l border-md-outline/70" />
							<span className="absolute top-0 right-0 size-2.5 border-t border-r border-md-outline/70" />
							<span className="absolute bottom-0 left-0 size-2.5 border-b border-l border-md-outline/70" />
							<span className="absolute right-0 bottom-0 size-2.5 border-r border-b border-md-outline/70" />
						</span>
						<ImagePlus className="size-5" aria-hidden />
						<span className="text-label-medium">
							{t("gm.module.addSceneBg")}
						</span>
					</button>
				)}

				<div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5">
					<span className="rounded-xs border border-md-outline-variant/60 bg-md-surface-container-lowest/85 px-1.5 py-0.5 font-mono text-label-small tabular-nums text-md-on-surface backdrop-blur-sm">
						#{padOrder(index)}
					</span>
					{isCover ? (
						<span className="rounded-xs border border-accent/45 bg-md-surface-container-lowest/85 px-1.5 py-0.5 text-label-small text-accent backdrop-blur-sm">
							{t("gm.module.coverBadge")}
						</span>
					) : null}
				</div>
				{uploadProgress ? (
					<div className="bg-md-scrim/75 absolute inset-0 z-10 flex items-center justify-center p-4 backdrop-blur-sm">
						<UploadProgressBar
							compact
							progress={uploadProgress}
							className="bg-md-surface-container-low/95 w-full max-w-64 rounded-lg px-3 py-2"
						/>
					</div>
				) : null}
			</div>

			<div className="flex min-h-11 items-center gap-2 py-1.5 pr-1.5 pl-3.5">
				{renaming ? (
					<form
						className="flex min-w-0 flex-1 items-center gap-1.5"
						onSubmit={(event) => {
							event.preventDefault();
							void commitRename();
						}}
					>
						<Input
							value={draftName}
							autoFocus
							disabled={busy}
							aria-label={t("gm.module.sceneAria", { name: scene.name })}
							onChange={(event) => setDraftName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									setRenaming(false);
									setDraftName(scene.name);
								}
							}}
							className="h-8 min-w-0 flex-1 rounded-sm"
						/>
						<Button
							type="submit"
							variant="primary"
							size="icon-sm"
							disabled={busy || !draftName.trim()}
							aria-label={t("gm.module.save")}
							className="size-8 shrink-0"
						>
							<Check className="size-4" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							disabled={busy}
							aria-label={t("common.cancel")}
							className="size-8 shrink-0"
							onClick={() => {
								setRenaming(false);
								setDraftName(scene.name);
							}}
						>
							<X className="size-4" />
						</Button>
					</form>
				) : (
					<>
						<h3
							title={scene.name}
							className="min-w-0 flex-1 truncate text-title-small-emph text-md-on-surface"
						>
							{scene.name}
						</h3>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									disabled={busy}
									aria-label={t("gm.module.sceneActionsAria", {
										name: scene.name,
									})}
									className="size-11 shrink-0 rounded-full text-md-on-surface-variant hover:bg-md-on-surface/8 hover:text-md-on-surface sm:size-9"
								>
									<Ellipsis className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setRenaming(true)}>
									<Pencil />
									{t("gm.module.rename")}
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
									<Upload />
									{src
										? t("gm.module.replaceSceneBg")
										: t("gm.module.addSceneBg")}
								</DropdownMenuItem>
								{src && !isCover ? (
									<DropdownMenuItem onClick={() => void onSetCover()}>
										<Star />
										{t("gm.module.setAsCover")}
									</DropdownMenuItem>
								) : null}
								{src ? (
									<DropdownMenuItem onClick={() => void clearImage()}>
										<ImageOff />
										{t("gm.module.removeSceneBg")}
									</DropdownMenuItem>
								) : null}
								{total > 1 ? (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											disabled={index === 0}
											onClick={() => void onMove(-1)}
										>
											<ArrowUp />
											{t("gm.module.moveEarlier")}
										</DropdownMenuItem>
										<DropdownMenuItem
											disabled={index === total - 1}
											onClick={() => void onMove(1)}
										>
											<ArrowDown />
											{t("gm.module.moveLater")}
										</DropdownMenuItem>
									</>
								) : null}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onClick={onRequestDelete}
								>
									<Trash2 />
									{t("gm.module.deleteSceneShort")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}
			</div>
		</article>
	);
}

export function ModuleScenesTab({
	moduleId,
	scenes,
	onReload,
}: {
	moduleId: string;
	scenes: SceneDto[];
	onReload: () => Promise<void>;
}) {
	const [query, setQuery] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [newName, setNewName] = useState("");
	const [newFile, setNewFile] = useState<File | null>(null);
	const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
		null,
	);
	const [previewScene, setPreviewScene] = useState<SceneDto | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<SceneDto | null>(null);

	useEffect(() => {
		if (!newFile) {
			setNewPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(newFile);
		setNewPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [newFile]);

	const coverSceneId =
		scenes.find((item) => Boolean(item.bgAssetId))?.id ?? null;

	const needle = query.trim().toLowerCase();
	const filtered = needle
		? scenes.filter((scene) => scene.name.toLowerCase().includes(needle))
		: scenes;

	async function createScene() {
		setCreating(true);
		try {
			const bgAssetId = newFile
				? await uploadMediaAsset(newFile, "scene", {
						onProgress: setUploadProgress,
					})
				: null;
			const nextOrder =
				scenes.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
			await api(`/gm/modules/${encodeURIComponent(moduleId)}/scenes`, {
				method: "POST",
				body: JSON.stringify({
					name: newName.trim() || t("gm.module.unnamedScene"),
					sortOrder: nextOrder,
					bgAssetId,
				}),
			});
			setCreateOpen(false);
			setNewName("");
			setNewFile(null);
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.createSceneFailed"));
		} finally {
			setUploadProgress(null);
			setCreating(false);
		}
	}

	async function moveScene(index: number, delta: -1 | 1) {
		const targetIndex = index + delta;
		const current = scenes[index];
		const neighbor = scenes[targetIndex];
		if (!current || !neighbor) return;
		const nextOrderCurrent =
			neighbor.sortOrder === current.sortOrder
				? targetIndex
				: neighbor.sortOrder;
		const nextOrderNeighbor =
			neighbor.sortOrder === current.sortOrder ? index : current.sortOrder;
		try {
			await Promise.all([
				api(`/gm/modules/scenes/${encodeURIComponent(current.id)}`, {
					method: "PATCH",
					body: JSON.stringify({ sortOrder: nextOrderCurrent }),
				}),
				api(`/gm/modules/scenes/${encodeURIComponent(neighbor.id)}`, {
					method: "PATCH",
					body: JSON.stringify({ sortOrder: nextOrderNeighbor }),
				}),
			]);
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		}
	}

	async function promoteToCover(scene: SceneDto) {
		const minOrder = scenes.reduce(
			(min, item) => Math.min(min, item.sortOrder),
			0,
		);
		try {
			await api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ sortOrder: minOrder - 1 }),
			});
			await onReload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		}
	}

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{scenes.length > 0 ? (
						<InputGroup className="h-10 max-w-xs min-w-0 flex-1 rounded-full border-md-outline-variant/80 px-4">
							<InputGroupAddon className="text-md-on-surface-variant">
								<Search aria-hidden />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("gm.module.searchScenesPlaceholder")}
								aria-label={t("gm.module.searchScenesPlaceholder")}
								className="placeholder:text-md-on-surface-variant/80"
							/>
						</InputGroup>
					) : null}
				</div>
				<Button
					type="button"
					variant="primary"
					size="sm"
					onClick={() => setCreateOpen(true)}
				>
					<Plus />
					{t("gm.module.createScene")}
				</Button>
			</div>

			{scenes.length === 0 ? (
				<EmptyState
					icon={ImagePlus}
					title={t("gm.module.emptyScenes")}
					description={t("gm.module.emptyScenesNewHint")}
					action={
						<Button
							type="button"
							variant="primary"
							size="sm"
							onClick={() => setCreateOpen(true)}
						>
							<Plus />
							{t("gm.module.createScene")}
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
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{filtered.map((scene) => {
						const index = scenes.findIndex((item) => item.id === scene.id);
						return (
							<SceneTile
								key={scene.id}
								scene={scene}
								index={index}
								total={scenes.length}
								isCover={scene.id === coverSceneId}
								onPreview={() => setPreviewScene(scene)}
								onReload={onReload}
								onRequestDelete={() => setDeleteTarget(scene)}
								onMove={(delta) => moveScene(index, delta)}
								onSetCover={() => promoteToCover(scene)}
							/>
						);
					})}
				</div>
			)}

			{/* 新建场景弹窗 */}
			<Dialog
				open={createOpen}
				onOpenChange={(open) => {
					if (!open && creating) {
						return;
					}
					setCreateOpen(open);
					if (!open) {
						setNewName("");
						setNewFile(null);
					}
				}}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>{t("gm.module.createScene")}</DialogTitle>
						<DialogDescription>
							{t("gm.module.coverOrderHint")}
						</DialogDescription>
					</DialogHeader>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void createScene();
						}}
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-scene-name">
								{t("gm.module.sceneNameLabel")}
							</Label>
							<Input
								id="new-scene-name"
								value={newName}
								autoFocus
								disabled={creating}
								onChange={(event) => setNewName(event.target.value)}
								placeholder={t("gm.module.sceneNamePlaceholder")}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-scene-bg">{t("gm.module.sceneBgAria")}</Label>
							<label
								htmlFor="new-scene-bg"
								className={
									creating
										? "group relative flex aspect-[16/9] pointer-events-none flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-md-outline-variant bg-md-surface-container-lowest text-md-on-surface-variant opacity-60"
										: "group relative flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-md-outline-variant bg-md-surface-container-lowest text-md-on-surface-variant transition-colors hover:border-md-outline hover:text-md-on-surface"
								}
							>
								{newPreviewUrl ? (
									<img
										src={newPreviewUrl}
										alt=""
										className="size-full object-cover"
									/>
								) : (
									<>
										<ImagePlus className="size-6" aria-hidden />
										<span className="text-body-small">
											{t("gm.module.chooseSceneBg")}
										</span>
									</>
								)}
								<input
									id="new-scene-bg"
									type="file"
									accept="image/*"
									disabled={creating}
									className="sr-only"
									onChange={(event) => {
										const file = event.target.files?.[0] ?? null;
										if (file && file.size > MAX_MEDIA_UPLOAD_BYTES) {
											toast.error(t("error.FILE_SIZE_EXCEEDED"));
											event.target.value = "";
											return;
										}
										setNewFile(file);
									}}
								/>
							</label>
							{newFile ? (
								<div className="flex items-center justify-between gap-2 text-body-small text-md-on-surface-variant">
									<span className="truncate">{newFile.name}</span>
									<Button
										type="button"
										variant="text"
										size="xs"
										disabled={creating}
										onClick={() => setNewFile(null)}
									>
										{t("gm.module.removeSceneBg")}
									</Button>
								</div>
							) : (
								<p className="text-body-small text-md-on-surface-variant">
									{t("gm.module.imageFormatHint")}
								</p>
							)}
						</div>
						{creating && newFile ? (
							<UploadProgressBar progress={uploadProgress} />
						) : null}
						<DialogFooter>
							<Button
								type="button"
								variant="tertiary"
								disabled={creating}
								onClick={() => setCreateOpen(false)}
							>
								{t("common.cancel")}
							</Button>
							<Button type="submit" variant="primary" disabled={creating}>
								<ImagePlus />
								{t("gm.module.createScene")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* 场景大图预览 */}
			<Dialog
				open={previewScene !== null}
				onOpenChange={(open) => !open && setPreviewScene(null)}
			>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>{previewScene?.name ?? ""}</DialogTitle>
					</DialogHeader>
					{previewScene?.bgAssetId ? (
						<div className="overflow-hidden rounded-lg bg-md-surface-container-lowest">
							<img
								src={mediaUrl(previewScene.bgAssetId) ?? undefined}
								alt={previewScene.name}
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
				title={t("gm.module.deleteSceneTitle")}
				description={t("gm.module.deleteSceneDescription", {
					name: deleteTarget?.name ?? "",
				})}
				confirmLabel={t("common.delete")}
				onConfirm={() => {
					const target = deleteTarget;
					setDeleteTarget(null);
					if (!target) return;
					void api(`/gm/modules/scenes/${encodeURIComponent(target.id)}`, {
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
