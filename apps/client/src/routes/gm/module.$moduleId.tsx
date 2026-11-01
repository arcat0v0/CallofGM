import { createFileRoute, Link } from "@tanstack/react-router";
import type { CatalogHandoutDto, CharacterDto, ModuleDto, SceneDto, TrackDto } from "@cogm/shared";
import { ChevronRight, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, fetchAllPages, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";
import { audioDurationMs } from "@/lib/audio-duration";

export const Route = createFileRoute("/gm/module/$moduleId")({
  beforeLoad: requireGmAuth,
  component: ModuleDetailPage,
});

async function uploadAsset(file: File, purpose: string): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  body.append("filename", file.name);
  const asset = await api<{ id: string }>("/media/upload", { method: "POST", body });
  return asset.id;
}

function SceneCard({ scene, onReload }: { scene: SceneDto; onReload: () => Promise<void> }) {
  const [name, setName] = useState(scene.name);

  useEffect(() => {
    setName(scene.name);
  }, [scene.name]);

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl p-0">
      <div className="relative h-[150px]">
        {scene.bgAssetId ? (
          <img src={mediaUrl(scene.bgAssetId) ?? undefined} alt={scene.name} className="absolute inset-0 size-full object-cover" />
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
              .catch((error) => toast.error(errorText(error, "gm.module.saveFailed")));
          }}
        >
          {t("gm.module.save")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("gm.module.deleteScene", { name: scene.name })}
          onClick={() => {
            void api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, { method: "DELETE" })
              .then(() => onReload())
              .catch((error) => toast.error(errorText(error, "gm.module.deleteFailed")));
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </Card>
  );
}

function TrackRowItem({ track, onReload }: { track: TrackDto; onReload: () => Promise<void> }) {
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
            .catch((error) => toast.error(errorText(error, "gm.module.saveFailed")));
        }}
      >
        {t("gm.module.save")}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("gm.module.deleteTrack", { name: track.name })}
        onClick={() => {
          void api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, { method: "DELETE" })
            .then(() => onReload())
            .catch((error) => toast.error(errorText(error, "gm.module.deleteFailed")));
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function HandoutCard({ handout, onReload }: { handout: CatalogHandoutDto; onReload: () => Promise<void> }) {
  const [title, setTitle] = useState(handout.title);
  const [content, setContent] = useState(handout.content);

  useEffect(() => {
    setTitle(handout.title);
    setContent(handout.content);
  }, [handout.title, handout.content]);

  const unchanged = title.trim() === handout.title && content === handout.content;

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
              .catch((error) => toast.error(errorText(error, "gm.module.saveFailed")));
          }}
        >
          {t("gm.module.save")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("gm.module.deleteHandout", { title: handout.title })}
          onClick={() => {
            void api(`/gm/modules/handouts/${encodeURIComponent(handout.id)}`, { method: "DELETE" })
              .then(() => onReload())
              .catch((error) => toast.error(errorText(error, "gm.module.deleteFailed")));
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
  const [trackName, setTrackName] = useState("");
  const [trackType, setTrackType] = useState<"bgm" | "se">("bgm");
  const [handoutTitle, setHandoutTitle] = useState("");
  const [handoutContent, setHandoutContent] = useState("");

  async function reload() {
    try {
      const [mod, nextScenes, nextTracks, nextHandouts, nextLinked, nextCharacters] = await Promise.all([
        api<ModuleDto>(`/gm/modules/${encodeURIComponent(moduleId)}`),
        fetchAllPages<SceneDto>(`/gm/modules/${encodeURIComponent(moduleId)}/scenes`),
        fetchAllPages<TrackDto>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`),
        fetchAllPages<CatalogHandoutDto>(`/gm/modules/${encodeURIComponent(moduleId)}/handouts`),
        fetchAllPages<CharacterDto>(`/gm/modules/${encodeURIComponent(moduleId)}/characters`),
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

  const moduleUnchanged = moduleName.trim() === (module?.name ?? "") && moduleDescription === (module?.description ?? "");

  return (
    <AdminLayout active="modules">
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex items-center gap-1.5">
              <span>{module?.name ?? t("gm.module.moduleFallback")}</span>
              <Badge tone="success" variant="soft" size="sm">
                {module?.ruleId ?? "coc7e"}
              </Badge>
            </span>
          }
          eyebrow={
            <div className="flex items-center gap-1.5">
              <Link to="/gm/modules" className="text-foreground-tertiary text-body-small">
                {t("gm.module.breadcrumbModules")}
              </Link>
              <ChevronRight className="text-foreground-tertiary size-[13px]" />
              <span className="text-foreground-secondary text-body-small-emph">{module?.name ?? ""}</span>
            </div>
          }
          description={module?.description || " "}
        />

        <Card className="flex flex-col gap-3 rounded-2xl p-4">
          <Input
            value={moduleName}
            onChange={(event) => setModuleName(event.target.value)}
            placeholder={t("gm.module.moduleNamePlaceholder")}
            aria-label={t("gm.module.moduleNamePlaceholder")}
          />
          <Textarea
            value={moduleDescription}
            onChange={(event) => setModuleDescription(event.target.value)}
            placeholder={t("gm.module.moduleDescriptionPlaceholder")}
            aria-label={t("gm.module.moduleDescriptionPlaceholder")}
          />
          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={!moduleName.trim() || moduleUnchanged}
            onClick={() => void saveModule()}
          >
            {t("gm.module.saveModule")}
          </Button>
        </Card>

        <Tabs defaultValue="scene" className="gap-5">
          <TabsList>
            <TabsTrigger value="scene">{t("gm.module.tabScene", { count: scenes.length })}</TabsTrigger>
            <TabsTrigger value="npc">{t("gm.module.tabCharacters", { count: linked.length })}</TabsTrigger>
            <TabsTrigger value="music">{t("gm.module.tabMusic", { count: tracks.length })}</TabsTrigger>
            <TabsTrigger value="handout">{t("gm.module.tabHandout", { count: handouts.length })}</TabsTrigger>
          </TabsList>

          <TabsContent value="scene">
            <form
              className="mb-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const file = (form.elements.namedItem("bg") as HTMLInputElement).files?.[0];
                void (async () => {
                  try {
                    const bgAssetId = file ? await uploadAsset(file, "scene") : null;
                    await api(`/gm/modules/${encodeURIComponent(moduleId)}/scenes`, {
                      method: "POST",
                      body: JSON.stringify({ name: sceneName || t("gm.module.unnamedScene"), sortOrder: scenes.length, bgAssetId }),
                    });
                    setSceneName("");
                    await reload();
                  } catch (error) {
                    toast.error(errorText(error, "gm.module.createSceneFailed"));
                  }
                })();
              }}
            >
              <Input value={sceneName} onChange={(event) => setSceneName(event.target.value)} placeholder={t("gm.module.sceneNamePlaceholder")} className="max-w-60" />
              <Input name="bg" type="file" accept="image/*" aria-label={t("gm.module.sceneBgAria")} className="max-w-60" />
              <Button type="submit" variant="primary">
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
                const isLinked = linked.some((item) => item.id === character.id);
                return (
                  <div key={character.id} className="bg-md-surface-container flex items-center gap-2 rounded-xl px-3 py-2">
                    <span className="flex-1 text-body-medium">{character.name}</span>
                    <Badge variant="soft" size="sm">
                      {character.kind.toUpperCase()}
                    </Badge>
                    <Button
                      size="sm"
                      variant={isLinked ? "tertiary" : "primary"}
                      className="h-7"
                      onClick={() => {
                        void (isLinked
                          ? api(`/gm/modules/${encodeURIComponent(moduleId)}/characters/${encodeURIComponent(character.id)}`, { method: "DELETE" })
                          : api(`/gm/modules/${encodeURIComponent(moduleId)}/characters`, {
                              method: "POST",
                              body: JSON.stringify({ characterId: character.id }),
                            }))
                          .then(() => reload())
                          .catch((error) => toast.error(errorText(error, "gm.module.operationFailed")));
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
                const file = (event.currentTarget.elements.namedItem("audio") as HTMLInputElement).files?.[0];
                if (!file) {
                  toast.error(t("gm.module.chooseAudio"));
                  return;
                }
                void (async () => {
                  try {
                    const audioAssetId = await uploadAsset(file, "audio");
                    const duration = await audioDurationMs(file);
                    await api(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`, {
                      method: "POST",
                      body: JSON.stringify({
                        name: trackName || file.name,
                        audioAssetId,
                        type: trackType,
                        duration,
                      }),
                    });
                    setTrackName("");
                    await reload();
                  } catch (error) {
                    toast.error(errorText(error, "gm.module.uploadFailed"));
                  }
                })();
              }}
            >
              <Input value={trackName} onChange={(event) => setTrackName(event.target.value)} placeholder={t("gm.module.trackNamePlaceholder")} className="max-w-48" />
              <select
                value={trackType}
                onChange={(event) => setTrackType(event.target.value as "bgm" | "se")}
                className="border-separator bg-background h-9 rounded-md border px-3 text-label-large"
                aria-label={t("gm.module.audioTypeAria")}
              >
                <option value="bgm">BGM</option>
                <option value="se">SE</option>
              </select>
              <Input name="audio" type="file" accept="audio/*" aria-label={t("gm.module.audioFileAria")} className="max-w-60" />
              <Button type="submit" variant="primary">
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
                const file = (event.currentTarget.elements.namedItem("image") as HTMLInputElement).files?.[0];
                void (async () => {
                  try {
                    const imageAssetId = file ? await uploadAsset(file, "handout") : null;
                    await api(`/gm/modules/${encodeURIComponent(moduleId)}/handouts`, {
                      method: "POST",
                      body: JSON.stringify({ title: handoutTitle, content: handoutContent, imageAssetId }),
                    });
                    setHandoutTitle("");
                    setHandoutContent("");
                    await reload();
                  } catch (error) {
                    toast.error(errorText(error, "gm.module.createHandoutFailed"));
                  }
                })();
              }}
            >
              <Input value={handoutTitle} onChange={(event) => setHandoutTitle(event.target.value)} placeholder={t("gm.module.handoutTitlePlaceholder")} required />
              <Textarea value={handoutContent} onChange={(event) => setHandoutContent(event.target.value)} placeholder={t("gm.module.handoutContentPlaceholder")} />
              <Input name="image" type="file" accept="image/*" aria-label={t("gm.module.handoutImageAria")} className="max-w-60" />
              <Button type="submit" variant="primary" className="w-fit">
                <Plus />
                {t("gm.module.createHandout")}
              </Button>
            </form>
            <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2 duration-500 ease-standard-default-spatial">
              {handouts.map((handout) => (
                <HandoutCard key={handout.id} handout={handout} onReload={reload} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
