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
import { api, fetchAllPages, isApiError, mediaUrl } from "@/lib/api";
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
    <Card className="border-separator gap-0 overflow-hidden border p-0">
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
          aria-label={`场景名 ${scene.name}`}
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
              .catch((error) => toast.error(isApiError(error) ? error.message : "保存失败"));
          }}
        >
          保存
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`删除场景 ${scene.name}`}
          onClick={() => {
            void api(`/gm/modules/scenes/${encodeURIComponent(scene.id)}`, { method: "DELETE" })
              .then(() => onReload())
              .catch((error) => toast.error(isApiError(error) ? error.message : "删除失败"));
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
    <div className="flex items-center gap-2 rounded-sm border px-3 py-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={`曲目名 ${track.name}`}
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
            .catch((error) => toast.error(isApiError(error) ? error.message : "保存失败"));
        }}
      >
        保存
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`删除 ${track.name}`}
        onClick={() => {
          void api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, { method: "DELETE" })
            .then(() => onReload())
            .catch((error) => toast.error(isApiError(error) ? error.message : "删除失败"));
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
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={`情报标题 ${handout.title}`}
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
              .catch((error) => toast.error(isApiError(error) ? error.message : "保存失败"));
          }}
        >
          保存
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`删除 ${handout.title}`}
          onClick={() => {
            void api(`/gm/modules/handouts/${encodeURIComponent(handout.id)}`, { method: "DELETE" })
              .then(() => onReload())
              .catch((error) => toast.error(isApiError(error) ? error.message : "删除失败"));
          }}
        >
          <Trash2 />
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        aria-label={`情报内容 ${handout.title}`}
      />
    </Card>
  );
}

function ModuleDetailPage() {
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
      toast.error(isApiError(error) ? error.message : "无法加载模组");
    }
  }

  useEffect(() => {
    void reload();
  }, [moduleId]);

  async function saveModule() {
    const name = moduleName.trim();
    if (!name) {
      toast.error("请填写模组名称");
      return;
    }
    try {
      await api(`/gm/modules/${encodeURIComponent(moduleId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description: moduleDescription }),
      });
      await reload();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "保存失败");
    }
  }

  const moduleUnchanged = moduleName.trim() === (module?.name ?? "") && moduleDescription === (module?.description ?? "");

  return (
    <AdminLayout active="modules">
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex items-center gap-1.5">
              <span>{module?.name ?? "模组"}</span>
              <Badge tone="success" variant="soft" size="sm">
                {module?.ruleId ?? "coc7e"}
              </Badge>
            </span>
          }
          eyebrow={
            <div className="flex items-center gap-1.5">
              <Link to="/gm/modules" className="text-foreground-tertiary text-body-small">
                模组管理
              </Link>
              <ChevronRight className="text-foreground-tertiary size-[13px]" />
              <span className="text-foreground-secondary text-body-small-emph">{module?.name ?? ""}</span>
            </div>
          }
          description={module?.description || " "}
        />

        <Card className="flex flex-col gap-3 p-4">
          <Input
            value={moduleName}
            onChange={(event) => setModuleName(event.target.value)}
            placeholder="模组名称"
            aria-label="模组名称"
          />
          <Textarea
            value={moduleDescription}
            onChange={(event) => setModuleDescription(event.target.value)}
            placeholder="简介"
            aria-label="模组简介"
          />
          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={!moduleName.trim() || moduleUnchanged}
            onClick={() => void saveModule()}
          >
            保存模组
          </Button>
        </Card>

        <Tabs defaultValue="scene" className="gap-5">
          <TabsList>
            <TabsTrigger value="scene">场景 · {scenes.length}</TabsTrigger>
            <TabsTrigger value="npc">人物 · {linked.length}</TabsTrigger>
            <TabsTrigger value="music">音乐 · {tracks.length}</TabsTrigger>
            <TabsTrigger value="handout">情报 · {handouts.length}</TabsTrigger>
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
                      body: JSON.stringify({ name: sceneName || "未命名场景", sortOrder: scenes.length, bgAssetId }),
                    });
                    setSceneName("");
                    await reload();
                  } catch (error) {
                    toast.error(isApiError(error) ? error.message : "创建场景失败");
                  }
                })();
              }}
            >
              <Input value={sceneName} onChange={(event) => setSceneName(event.target.value)} placeholder="场景名" className="max-w-60" />
              <Input name="bg" type="file" accept="image/*" aria-label="场景背景图" className="max-w-60" />
              <Button type="submit" variant="primary">
                <ImagePlus />
                新建场景
              </Button>
            </form>
            <div className="grid grid-cols-3 gap-4">
              {scenes.map((scene) => (
                <SceneCard key={scene.id} scene={scene} onReload={reload} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="npc">
            <div className="flex flex-col gap-2">
              {allCharacters.map((character) => {
                const isLinked = linked.some((item) => item.id === character.id);
                return (
                  <div key={character.id} className="flex items-center gap-2 rounded-sm border px-3 py-2">
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
                          .catch((error) => toast.error(isApiError(error) ? error.message : "操作失败"));
                      }}
                    >
                      {isLinked ? "取消关联" : "关联"}
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
                  toast.error("请选择音频文件");
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
                    toast.error(isApiError(error) ? error.message : "上传失败");
                  }
                })();
              }}
            >
              <Input value={trackName} onChange={(event) => setTrackName(event.target.value)} placeholder="曲目名" className="max-w-48" />
              <select
                value={trackType}
                onChange={(event) => setTrackType(event.target.value as "bgm" | "se")}
                className="border-separator bg-background h-9 rounded-md border px-3 text-label-large"
                aria-label="音频类型"
              >
                <option value="bgm">BGM</option>
                <option value="se">SE</option>
              </select>
              <Input name="audio" type="file" accept="audio/*" aria-label="音频文件" className="max-w-60" />
              <Button type="submit" variant="primary">
                <Upload />
                上传
              </Button>
            </form>
            <div className="flex flex-col gap-2">
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
                    toast.error(isApiError(error) ? error.message : "创建情报失败");
                  }
                })();
              }}
            >
              <Input value={handoutTitle} onChange={(event) => setHandoutTitle(event.target.value)} placeholder="情报标题" required />
              <Textarea value={handoutContent} onChange={(event) => setHandoutContent(event.target.value)} placeholder="情报内容" />
              <Input name="image" type="file" accept="image/*" aria-label="情报图片" className="max-w-60" />
              <Button type="submit" variant="primary" className="w-fit">
                <Plus />
                新建情报
              </Button>
            </form>
            <div className="flex flex-col gap-2">
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
