import type {
	CatalogHandoutDto,
	CharacterDto,
	ModuleDto,
	SceneDto,
	TrackDto,
} from "@cogm/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ImagePlus, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FilePicker } from "@/components/shared/file-picker";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { InviteLinksDialog } from "@/features/gm-admin/invite-links-dialog";
import { t, useI18nVersion } from "@/i18n";
import { api, fetchAllPages, mediaUrl } from "@/lib/api";
import { audioDurationMs } from "@/lib/audio-duration";
import { errorText } from "@/lib/errors";
import { requireGmAuth } from "@/lib/identity";
import { FALLBACK_RULE_ID } from "@/rules/registry";

export const Route = createFileRoute("/gm/module/$moduleId")({
	beforeLoad: requireGmAuth,
	component: ModuleDetailPage,
});

async function uploadAsset(file: File, purpose: string): Promise<string> {
	const body = new FormData();
	body.append("file", file);
	body.append("purpose", purpose);
	body.append("filename", file.name);
	const asset = await api<{ id: string }>("/media/upload", {
		method: "POST",
		body,
	});
	return asset.id;
}

function SceneCard({
	scene,
	onReload,
}: {
	scene: SceneDto;
	onReload: () => Promise<void>;
}) {
	const [name, setName] = useState(scene.name);

	useEffect(() => {
		setName(scene.name);
	}, [scene.name]);

	return (
		<Card className="gap-0 overflow-hidden rounded-2xl p-0">
			<div className="relative h-[150px]">
				{scene.bgAssetId ? (
					<img
						src={mediaUrl(scene.bgAssetId) ?? undefined}
						alt={scene.name}
						className="absolute inset-0 size-full object-cover"
					/>
				) : (
					<div className="bg-default absolute inset-0" />
				)}
			</div>
			<div className="flex items-center gap-2 px-3 py-2.5">
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					aria-label={t("gm.module.sceneAria", { name: scene.name })}
					className="h-8 flex-1"
				/>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					className="h-8"
					disabled={!name.trim() || name.trim() === scene.name}
					onClick={() => {
						void api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
							method: "PATCH",
							body: JSON.stringify({ name: name.trim() }),
						})
							.then(() => onReload())
							.catch((error) =>
								toast.error(errorText(error, "gm.module.saveFailed")),
							);
					}}
				>
					{t("gm.module.save")}
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					className="size-8"
					aria-label={t("gm.module.deleteScene", { name: scene.name })}
					onClick={() => {
						void api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, {
							method: "DELETE",
						})
							.then(() => onReload())
							.catch((error) =>
								toast.error(errorText(error, "gm.module.deleteFailed")),
							);
					}}
				>
					<Trash2 />
				</Button>
			</div>
		</Card>
	);
}

function TrackRowItem({
	track,
	onReload,
}: {
	track: TrackDto;
	onReload: () => Promise<void>;
}) {
	const [name, setName] = useState(track.name);

	useEffect(() => {
		setName(track.name);
	}, [track.name]);

	return (
		<div className="bg-md-surface-container flex items-center gap-2 rounded-xl px-3 py-2">
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				aria-label={t("gm.module.trackAria", { name: track.name })}
				className="h-8 flex-1"
			/>
			<Badge variant="soft" size="sm">
				{track.type.toUpperCase()}
			</Badge>
			<Button
				type="button"
				variant="tertiary"
				size="sm"
				className="h-8"
				disabled={!name.trim() || name.trim() === track.name}
				onClick={() => {
					void api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
						method: "PATCH",
						body: JSON.stringify({ name: name.trim() }),
					})
						.then(() => onReload())
						.catch((error) =>
							toast.error(errorText(error, "gm.module.saveFailed")),
						);
				}}
			>
				{t("gm.module.save")}
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				className="size-8"
				aria-label={t("gm.module.deleteTrack", { name: track.name })}
				onClick={() => {
					void api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
						method: "DELETE",
					})
						.then(() => onReload())
						.catch((error) =>
							toast.error(errorText(error, "gm.module.deleteFailed")),
						);
				}}
			>
				<Trash2 />
			</Button>
		</div>
	);
}

function HandoutCard({
	handout,
	onReload,
}: {
	handout: CatalogHandoutDto;
	onReload: () => Promise<void>;
}) {
	const [title, setTitle] = useState(handout.title);
	const [content, setContent] = useState(handout.content);

	useEffect(() => {
		setTitle(handout.title);
		setContent(handout.content);
	}, [handout.title, handout.content]);

	const unchanged =
		title.trim() === handout.title && content === handout.content;

	return (
		<Card className="flex flex-col gap-2 rounded-2xl p-3">
			<div className="flex items-center gap-2">
				<Input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					aria-label={t("gm.module.handoutTitleAria", { title: handout.title })}
					className="h-8 flex-1"
				/>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					className="h-8"
					disabled={!title.trim() || unchanged}
					onClick={() => {
						void api(`/gm/modules/handouts/${encodeURIComponent(handout.id)}`, {
							method: "PATCH",
							body: JSON.stringify({ title: title.trim(), content }),
						})
							.then(() => onReload())
							.catch((error) =>
								toast.error(errorText(error, "gm.module.saveFailed")),
							);
					}}
				>
					{t("gm.module.save")}
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					className="size-8"
					aria-label={t("gm.module.deleteHandout", { title: handout.title })}
					onClick={() => {
						void api(`/gm/modules/handouts/${encodeURIComponent(handout.id)}`, {
							method: "DELETE",
						})
							.then(() => onReload())
							.catch((error) =>
								toast.error(errorText(error, "gm.module.deleteFailed")),
							);
					}}
				>
					<Trash2 />
				</Button>
			</div>
			<Textarea
				value={content}
				onChange={(event) => setContent(event.target.value)}
				aria-label={t("gm.module.handoutContentAria", { title: handout.title })}
			/>
		</Card>
	);
}

function ModuleDetailPage() {
	useI18nVersion();
	const { moduleId } = Route.useParams();
	const [module, setModule] = useState<ModuleDto | null>(null);
	const [moduleName, setModuleName] = useState("");
	const [moduleDescription, setModuleDescription] = useState("");
	const [scenes, setScenes] = useState<SceneDto[]>([]);
	const [tracks, setTracks] = useState<TrackDto[]>([]);
	const [handouts, setHandouts] = useState<CatalogHandoutDto[]>([]);
	const [linked, setLinked] = useState<CharacterDto[]>([]);
	const [allCharacters, setAllCharacters] = useState<CharacterDto[]>([]);
	const [sceneName, setSceneName] = useState("");
	const [sceneBgName, setSceneBgName] = useState("");
	const [trackName, setTrackName] = useState("");
	const [trackFileName, setTrackFileName] = useState("");
	const [trackType, setTrackType] = useState<"bgm" | "se">("bgm");
	const [handoutTitle, setHandoutTitle] = useState("");
	const [handoutContent, setHandoutContent] = useState("");
	const [handoutImageName, setHandoutImageName] = useState("");
	const [invitesOpen, setInvitesOpen] = useState(false);

	async function reload() {
		try {
			const [
				mod,
				nextScenes,
				nextTracks,
				nextHandouts,
				nextLinked,
				nextCharacters,
			] = await Promise.all([
				api<ModuleDto>(`/gm/modules/${encodeURIComponent(moduleId)}`),
				fetchAllPages<SceneDto>(
					`/gm/modules/${encodeURIComponent(moduleId)}/scenes`,
				),
				fetchAllPages<TrackDto>(
					`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
				),
				fetchAllPages<CatalogHandoutDto>(
					`/gm/modules/${encodeURIComponent(moduleId)}/handouts`,
				),
				fetchAllPages<CharacterDto>(
					`/gm/modules/${encodeURIComponent(moduleId)}/characters`,
				),
				fetchAllPages<CharacterDto>("/gm/characters"),
			]);
			setModule(mod);
			setModuleName(mod.name);
			setModuleDescription(mod.description);
			setScenes(nextScenes);
			setTracks(nextTracks);
			setHandouts(nextHandouts);
			setLinked(nextLinked);
			setAllCharacters(nextCharacters);
		} catch (error) {
			toast.error(errorText(error, "gm.module.loadFailed"));
		}
	}

	useEffect(() => {
		void reload();
	}, [moduleId]);

	async function saveModule() {
		const name = moduleName.trim();
		if (!name) {
			toast.error(t("gm.module.nameRequired"));
			return;
		}
		try {
			await api(`/gm/modules/${encodeURIComponent(moduleId)}`, {
				method: "PATCH",
				body: JSON.stringify({ name, description: moduleDescription }),
			});
			await reload();
		} catch (error) {
			toast.error(errorText(error, "gm.module.saveFailed"));
		}
	}

	const moduleUnchanged =
		moduleName.trim() === (module?.name ?? "") &&
		moduleDescription === (module?.description ?? "");

	return (
		<AdminLayout>
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
				<PageHeader
					title={
						<span className="flex items-center gap-1.5">
							<span>{module?.name ?? t("gm.module.moduleFallback")}</span>
							<Badge tone="success" variant="soft" size="sm">
								{module?.ruleId ?? FALLBACK_RULE_ID}
							</Badge>
						</span>
					}
					eyebrow={
						<div className="flex items-center gap-1.5">
							<Link
								to="/gm/modules"
								className="text-foreground-tertiary text-body-small"
							>
								{t("gm.module.breadcrumbModules")}
							</Link>
							<ChevronRight className="text-foreground-tertiary size-[13px]" />
							<span className="text-foreground-secondary text-body-small-emph">
								{module?.name ?? ""}
							</span>
						</div>
					}
					description={t("gm.module.pageDescription")}
					actions={
						<Button
							type="button"
							variant="tertiary"
							onClick={() => setInvitesOpen(true)}
						>
							<UserPlus />
							{t("gm.invites.open")}
						</Button>
					}
				/>

				<Card className="flex max-w-2xl flex-col gap-3 rounded-2xl p-4">
					<label className="flex flex-col gap-1.5">
						<span className="text-md-on-surface-variant text-label-medium">
							{t("gm.module.nameLabel")}
						</span>
						<Input
							value={moduleName}
							onChange={(event) => setModuleName(event.target.value)}
							placeholder={t("gm.module.moduleNamePlaceholder")}
							aria-label={t("gm.module.nameLabel")}
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-md-on-surface-variant text-label-medium">
							{t("gm.module.descriptionLabel")}
						</span>
						<Textarea
							value={moduleDescription}
							onChange={(event) => setModuleDescription(event.target.value)}
							placeholder={t("gm.module.moduleDescriptionPlaceholder")}
							aria-label={t("gm.module.descriptionLabel")}
						/>
					</label>
					<Button
						type="button"
						variant="primary"
						className="h-10 self-start"
						disabled={!moduleName.trim() || moduleUnchanged}
						onClick={() => void saveModule()}
					>
						{t("gm.module.saveModule")}
					</Button>
				</Card>

				<Tabs defaultValue="scene" className="gap-5">
					<TabsList>
						<TabsTrigger value="scene">
							{t("gm.module.tabScene", { count: scenes.length })}
						</TabsTrigger>
						<TabsTrigger value="npc">
							{t("gm.module.tabCharacters", { count: linked.length })}
						</TabsTrigger>
						<TabsTrigger value="music">
							{t("gm.module.tabMusic", { count: tracks.length })}
						</TabsTrigger>
						<TabsTrigger value="handout">
							{t("gm.module.tabHandout", { count: handouts.length })}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="scene">
						<form
							className="mb-4 flex gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								const form = event.currentTarget;
								const file = (form.elements.namedItem("bg") as HTMLInputElement)
									.files?.[0];
								void (async () => {
									try {
										const bgAssetId = file
											? await uploadAsset(file, "scene")
											: null;
										await api(
											`/gm/modules/${encodeURIComponent(moduleId)}/scenes`,
											{
												method: "POST",
												body: JSON.stringify({
													name: sceneName || t("gm.module.unnamedScene"),
													sortOrder: scenes.length,
													bgAssetId,
												}),
											},
										);
										setSceneName("");
										setSceneBgName("");
										await reload();
									} catch (error) {
										toast.error(
											errorText(error, "gm.module.createSceneFailed"),
										);
									}
								})();
							}}
						>
							<label className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.sceneNameLabel")}
								</span>
								<Input
									value={sceneName}
									onChange={(event) => setSceneName(event.target.value)}
									placeholder={t("gm.module.sceneNamePlaceholder")}
									className="w-60"
								/>
							</label>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.sceneBgAria")}
								</span>
								<FilePicker
									name="bg"
									accept="image/*"
									label={t("gm.module.chooseSceneBg")}
									value={sceneBgName}
									onChange={(event) =>
										setSceneBgName(event.target.files?.[0]?.name ?? "")
									}
								/>
							</div>
							<Button type="submit" variant="primary" className="h-10 self-end">
								<ImagePlus />
								{t("gm.module.createScene")}
							</Button>
						</form>
						<div className="animate-in fade-in slide-in-from-bottom-4 grid grid-cols-3 gap-4 duration-500 ease-standard-default-spatial">
							{scenes.map((scene) => (
								<SceneCard key={scene.id} scene={scene} onReload={reload} />
							))}
						</div>
					</TabsContent>

					<TabsContent value="npc">
						<div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2 duration-500 ease-standard-default-spatial">
							{allCharacters.map((character) => {
								const isLinked = linked.some(
									(item) => item.id === character.id,
								);
								return (
									<div
										key={character.id}
										className="bg-md-surface-container flex items-center gap-2 rounded-xl px-3 py-2"
									>
										<span className="flex-1 text-body-medium">
											{character.name}
										</span>
										<Badge variant="soft" size="sm">
											{character.kind.toUpperCase()}
										</Badge>
										<Button
											size="sm"
											variant={isLinked ? "tertiary" : "primary"}
											className="h-7"
											onClick={() => {
												void (
													isLinked
														? api(
																`/gm/modules/${encodeURIComponent(moduleId)}/characters/${encodeURIComponent(character.id)}`,
																{ method: "DELETE" },
															)
														: api(
																`/gm/modules/${encodeURIComponent(moduleId)}/characters`,
																{
																	method: "POST",
																	body: JSON.stringify({
																		characterId: character.id,
																	}),
																},
															)
												)
													.then(() => reload())
													.catch((error) =>
														toast.error(
															errorText(error, "gm.module.operationFailed"),
														),
													);
											}}
										>
											{isLinked ? t("gm.module.unlink") : t("gm.module.link")}
										</Button>
									</div>
								);
							})}
						</div>
					</TabsContent>

					<TabsContent value="music">
						<form
							className="mb-4 flex flex-wrap gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								const file = (
									event.currentTarget.elements.namedItem(
										"audio",
									) as HTMLInputElement
								).files?.[0];
								if (!file) {
									toast.error(t("gm.module.chooseAudio"));
									return;
								}
								void (async () => {
									try {
										const audioAssetId = await uploadAsset(file, "audio");
										const duration = await audioDurationMs(file);
										await api(
											`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
											{
												method: "POST",
												body: JSON.stringify({
													name: trackName || file.name,
													audioAssetId,
													type: trackType,
													duration,
												}),
											},
										);
										setTrackName("");
										setTrackFileName("");
										await reload();
									} catch (error) {
										toast.error(errorText(error, "gm.module.uploadFailed"));
									}
								})();
							}}
						>
							<label className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.trackNameLabel")}
								</span>
								<Input
									value={trackName}
									onChange={(event) => setTrackName(event.target.value)}
									placeholder={t("gm.module.trackNamePlaceholder")}
									className="w-48"
								/>
							</label>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.audioTypeLabel")}
								</span>
								<Select
									value={trackType}
									onValueChange={(value) => setTrackType(value as "bgm" | "se")}
								>
									<SelectTrigger
										className="w-24"
										aria-label={t("gm.module.audioTypeAria")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="bgm">BGM</SelectItem>
										<SelectItem value="se">SE</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.audioFileLabel")}
								</span>
								<FilePicker
									name="audio"
									accept="audio/*"
									label={t("gm.module.chooseAudio")}
									value={trackFileName}
									onChange={(event) =>
										setTrackFileName(event.target.files?.[0]?.name ?? "")
									}
								/>
							</div>
							<Button type="submit" variant="primary" className="h-10 self-end">
								<Upload />
								{t("gm.module.upload")}
							</Button>
						</form>
						<div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2 duration-500 ease-standard-default-spatial">
							{tracks.map((track) => (
								<TrackRowItem key={track.id} track={track} onReload={reload} />
							))}
						</div>
					</TabsContent>

					<TabsContent value="handout">
						<form
							className="mb-4 flex flex-col gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								const file = (
									event.currentTarget.elements.namedItem(
										"image",
									) as HTMLInputElement
								).files?.[0];
								void (async () => {
									try {
										const imageAssetId = file
											? await uploadAsset(file, "handout")
											: null;
										await api(
											`/gm/modules/${encodeURIComponent(moduleId)}/handouts`,
											{
												method: "POST",
												body: JSON.stringify({
													title: handoutTitle,
													content: handoutContent,
													imageAssetId,
												}),
											},
										);
										setHandoutTitle("");
										setHandoutContent("");
										setHandoutImageName("");
										await reload();
									} catch (error) {
										toast.error(
											errorText(error, "gm.module.createHandoutFailed"),
										);
									}
								})();
							}}
						>
							<label className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.handoutTitleLabel")}
								</span>
								<Input
									value={handoutTitle}
									onChange={(event) => setHandoutTitle(event.target.value)}
									placeholder={t("gm.module.handoutTitlePlaceholder")}
									required
								/>
							</label>
							<label className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.handoutContentLabel")}
								</span>
								<Textarea
									value={handoutContent}
									onChange={(event) => setHandoutContent(event.target.value)}
									placeholder={t("gm.module.handoutContentPlaceholder")}
								/>
							</label>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.module.handoutImageLabel")}
								</span>
								<FilePicker
									name="image"
									accept="image/*"
									label={t("gm.module.chooseHandoutImage")}
									value={handoutImageName}
									onChange={(event) =>
										setHandoutImageName(event.target.files?.[0]?.name ?? "")
									}
								/>
							</div>
							<Button type="submit" variant="primary" className="h-10 w-fit">
								<Plus />
								{t("gm.module.createHandout")}
							</Button>
						</form>
						<div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2 duration-500 ease-standard-default-spatial">
							{handouts.map((handout) => (
								<HandoutCard
									key={handout.id}
									handout={handout}
									onReload={reload}
								/>
							))}
						</div>
					</TabsContent>
				</Tabs>
			</div>
			<InviteLinksDialog
				open={invitesOpen}
				onOpenChange={setInvitesOpen}
				scope="module"
				targetId={moduleId}
				targetName={module?.name ?? ""}
			/>
		</AdminLayout>
	);
}
