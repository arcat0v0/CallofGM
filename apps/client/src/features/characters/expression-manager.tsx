import type { CharacterPortraitDto } from "@cogm/shared";
import { ArrowDown, ArrowUp, Crop, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageCropDialog } from "@/components/shared/image-crop-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { expressionLabel } from "@/lib/format";

export type PortraitBasePath = "/gm/characters" | "/pl/characters";

type PendingPortrait = {
	id: string;
	file: File;
	name: string;
	failed: boolean;
};

export function ExpressionManager({
	characterId,
	portraits,
	basePath,
	onChange,
}: {
	characterId: string;
	portraits: CharacterPortraitDto[];
	basePath: PortraitBasePath;
	onChange: () => void;
}) {
	const [pending, setPending] = useState<PendingPortrait[]>([]);
	const [uploading, setUploading] = useState(false);
	const [moving, setMoving] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<CharacterPortraitDto | null>(
		null,
	);
	const [cropTarget, setCropTarget] = useState<CharacterPortraitDto | null>(
		null,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const portraitBase = `${basePath}/${encodeURIComponent(characterId)}/portraits`;

	function addFiles(files: FileList | null) {
		if (!files || files.length === 0) {
			return;
		}
		const rows = Array.from(files).map((file) => ({
			id: crypto.randomUUID(),
			file,
			name: file.name.replace(/\.[^.]+$/, ""),
			failed: false,
		}));
		setPending((current) => [...current, ...rows]);
	}

	async function uploadPending() {
		if (uploading || pending.length === 0) {
			return;
		}
		setUploading(true);
		for (const row of [...pending]) {
			if (!row.name.trim()) {
				setPending((current) =>
					current.map((item) =>
						item.id === row.id ? { ...item, failed: true } : item,
					),
				);
				toast.error(t("expressions.nameRequired"));
				continue;
			}
			try {
				const body = new FormData();
				body.append("file", row.file);
				body.append("purpose", "portrait");
				body.append("filename", row.file.name);
				const asset = await api<{ id: string }>("/media/upload", {
					method: "POST",
					body,
				});
				const label = row.name.trim();
				await api(portraitBase, {
					method: "POST",
					body: JSON.stringify({
						label,
						portraitAssetId: asset.id,
					}),
				});
				setPending((current) => current.filter((item) => item.id !== row.id));
				onChange();
			} catch (error) {
				setPending((current) =>
					current.map((item) =>
						item.id === row.id ? { ...item, failed: true } : item,
					),
				);
				toast.error(
					t("expressions.uploadFailed", {
						name: row.name,
						reason: errorText(error, "error.fallback"),
					}),
				);
			}
		}
		setUploading(false);
	}

	async function move(portrait: CharacterPortraitDto, offset: -1 | 1) {
		if (moving) {
			return;
		}
		const index = portraits.findIndex((item) => item.id === portrait.id);
		const target = index + offset;
		if (index < 0 || target < 0 || target >= portraits.length) {
			return;
		}
		const next = [...portraits];
		const neighbor = next[target];
		if (!neighbor) {
			return;
		}
		next[index] = neighbor;
		next[target] = portrait;
		setMoving(true);
		try {
			for (const [order, item] of next.entries()) {
				await api(`${portraitBase}/${encodeURIComponent(item.id)}`, {
					method: "PATCH",
					body: JSON.stringify({ sortOrder: order }),
				});
			}
			onChange();
		} catch (error) {
			toast.error(errorText(error, "expressions.reorderFailed"));
			onChange();
		} finally {
			setMoving(false);
		}
	}

	async function setDefault(portrait: CharacterPortraitDto) {
		try {
			await api(`${portraitBase}/${encodeURIComponent(portrait.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ isDefault: true }),
			});
			onChange();
		} catch (error) {
			toast.error(errorText(error, "expressions.setDefaultFailed"));
		}
	}

	function beginRename(portrait: CharacterPortraitDto) {
		setRenamingId(portrait.id);
		setRenameValue(portrait.label ?? "");
	}

	async function commitRename() {
		const portrait = portraits.find((item) => item.id === renamingId);
		setRenamingId(null);
		if (!portrait) {
			return;
		}
		const trimmed = renameValue.trim();
		if (!trimmed) {
			toast.error(t("expressions.nameRequired"));
			return;
		}
		if (trimmed === (portrait.label ?? "")) {
			return;
		}
		try {
			await api(`${portraitBase}/${encodeURIComponent(portrait.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ label: trimmed }),
			});
			onChange();
		} catch (error) {
			toast.error(errorText(error, "expressions.renameFailed"));
		}
	}

	function revertRename() {
		setRenamingId(null);
		setRenameValue("");
	}

	async function remove() {
		const portrait = deleteTarget;
		setDeleteTarget(null);
		if (!portrait) {
			return;
		}
		try {
			await api(`${portraitBase}/${encodeURIComponent(portrait.id)}`, {
				method: "DELETE",
			});
			onChange();
		} catch (error) {
			toast.error(errorText(error, "expressions.deleteFailed"));
		}
	}

	async function replacePortraitImage(
		portrait: CharacterPortraitDto,
		blob: Blob,
	) {
		try {
			const file = new File([blob], `${portrait.id}-cropped.jpg`, {
				type: "image/jpeg",
			});
			const body = new FormData();
			body.append("file", file);
			body.append("purpose", "portrait");
			body.append("filename", file.name);
			const asset = await api<{ id: string }>("/media/upload", {
				method: "POST",
				body,
			});
			await api(`${portraitBase}/${encodeURIComponent(portrait.id)}`, {
				method: "PATCH",
				body: JSON.stringify({ portraitAssetId: asset.id }),
			});
			setCropTarget(null);
			onChange();
		} catch (error) {
			toast.error(errorText(error, "expressions.cropFailed"));
		}
	}

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-md-on-surface font-sans text-title-medium-emph">
					{t("expressions.title")}
				</h3>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					className="bg-md-surface-container-highest h-9 gap-2"
					disabled={uploading}
					onClick={() => fileInputRef.current?.click()}
				>
					<Plus className="size-4" />
					{t("expressions.add")}
				</Button>
			</div>
			<span className="text-md-on-surface-variant text-label-small">
				{t("expressions.addHint")}
			</span>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*"
				className="hidden"
				onChange={(event) => {
					addFiles(event.target.files);
					event.target.value = "";
				}}
			/>
			{portraits.length === 0 && pending.length === 0 ? (
				<p className="text-foreground-tertiary text-label-medium">
					{t("expressions.empty")}
				</p>
			) : null}
			<div className="flex flex-col gap-2">
				{portraits.map((portrait, index) => {
					const isDefault = portrait.isDefault === 1;
					const name = expressionLabel(portrait.expressionKey, portrait.label);
					return (
						<div
							key={portrait.id}
							className="border-separator-secondary/60 bg-md-surface-container-low flex items-center gap-3 rounded-2xl border p-2"
						>
							<div className="bg-surface-tertiary relative size-16 shrink-0 overflow-hidden rounded-xl">
								<img
									src={mediaUrl(portrait.portraitAssetId) ?? undefined}
									alt={name}
									className="size-full object-cover"
								/>
								{isDefault ? (
									<span
										className="bg-warning text-warning-foreground absolute top-0.5 left-0.5 flex size-5 items-center justify-center rounded-full"
										title={t("expressions.defaultBadge")}
									>
										<Star className="size-3" />
									</span>
								) : null}
							</div>
							{renamingId === portrait.id ? (
								<Input
									data-slot="expression-rename-input"
									value={renameValue}
									autoFocus
									aria-label={t("expressions.rename", { name })}
									onChange={(event) => setRenameValue(event.target.value)}
									onBlur={() => void commitRename()}
									onKeyDown={(event) => {
										if (event.nativeEvent.isComposing) {
											return;
										}
										if (event.key === "Enter") {
											event.preventDefault();
											void commitRename();
										}
										if (event.key === "Escape") {
											event.preventDefault();
											event.stopPropagation();
											revertRename();
										}
									}}
									className="h-7 flex-1 text-label-medium"
								/>
							) : (
								<span className="min-w-0 flex-1 truncate text-body-medium-emph">
									{name}
								</span>
							)}
							<div className="flex shrink-0 items-center">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-foreground-tertiary"
									disabled={moving || index === 0}
									aria-label={t("expressions.moveUp", { name })}
									onClick={() => void move(portrait, -1)}
								>
									<ArrowUp className="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-foreground-tertiary"
									disabled={moving || index === portraits.length - 1}
									aria-label={t("expressions.moveDown", { name })}
									onClick={() => void move(portrait, 1)}
								>
									<ArrowDown className="size-3.5" />
								</Button>
							</div>
							<div className="flex shrink-0 items-center">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-foreground-tertiary"
									aria-label={t("expressions.crop", { name })}
									onClick={() => setCropTarget(portrait)}
								>
									<Crop className="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-foreground-tertiary"
									aria-label={t("expressions.rename", { name })}
									onClick={() => beginRename(portrait)}
								>
									<Pencil className="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-foreground-tertiary"
									disabled={isDefault}
									aria-label={t("expressions.setDefault", { name })}
									onClick={() => void setDefault(portrait)}
								>
									<Star className="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="size-7 text-danger-soft-foreground"
									aria-label={t("expressions.deleteTitle", { name })}
									onClick={() => setDeleteTarget(portrait)}
								>
									<Trash2 className="size-3.5" />
								</Button>
							</div>
						</div>
					);
				})}
				{pending.map((row) => (
					<div
						key={row.id}
						className={
							row.failed
								? "border-danger bg-danger-soft/40 flex items-center gap-3 rounded-2xl border p-2"
								: "border-separator-secondary/60 bg-md-surface-container-low flex items-center gap-3 rounded-2xl border p-2"
						}
					>
						<Input
							value={row.name}
							aria-label={`${t("expressions.pending")} · ${t("expressions.namePlaceholder")}`}
							placeholder={t("expressions.namePlaceholder")}
							onChange={(event) =>
								setPending((current) =>
									current.map((item) =>
										item.id === row.id
											? { ...item, name: event.target.value }
											: item,
									),
								)
							}
							className="h-7 flex-1 text-label-medium"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="size-7 shrink-0 text-foreground-tertiary"
							aria-label={t("common.delete")}
							onClick={() =>
								setPending((current) =>
									current.filter((item) => item.id !== row.id),
								)
							}
						>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				))}
			</div>
			{pending.length > 0 ? (
				<Button
					type="button"
					variant="primary"
					size="sm"
					className="h-9 gap-2 self-start"
					disabled={uploading}
					onClick={() => void uploadPending()}
				>
					{uploading ? t("expressions.uploading") : t("expressions.upload")}
				</Button>
			) : null}
			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				icon={Trash2}
				confirmIcon={Trash2}
				title={t("expressions.deleteTitle", {
					name: expressionLabel(
						deleteTarget?.expressionKey,
						deleteTarget?.label,
					),
				})}
				description={t("expressions.deleteDescription", {
					name: expressionLabel(
						deleteTarget?.expressionKey,
						deleteTarget?.label,
					),
				})}
				confirmLabel={t("common.delete")}
				onConfirm={() => void remove()}
			/>
			<ImageCropDialog
				open={cropTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setCropTarget(null);
					}
				}}
				imageUrl={cropTarget ? mediaUrl(cropTarget.portraitAssetId) : null}
				aspect={1}
				title={t("expressions.crop", {
					name: expressionLabel(cropTarget?.expressionKey, cropTarget?.label),
				})}
				description={t("expressions.cropReplaceHint")}
				confirmLabel={t("crop.confirm")}
				onConfirm={(blob) => void replacePortraitImage(cropTarget!, blob)}
			/>
		</section>
	);
}
