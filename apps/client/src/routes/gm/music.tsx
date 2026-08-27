import { createFileRoute, Link } from "@tanstack/react-router";
import { Disc3, Play, Upload, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchAllPages, isApiError } from "@/lib/api";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/music")({
  beforeLoad: requireGmAuth,
  component: MusicResourcesPage,
});

type ModuleRow = { id: string; name: string };
type TrackRow = { id: string; name: string; type: "bgm" | "se"; duration: number };

function MusicResourcesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const next = await fetchAllPages<ModuleRow>("/gm/modules");
        setModules(next);
        setModuleId((current) => current || next[0]?.id || "");
      } catch (error) {
        toast.error(isApiError(error) ? error.message : "无法加载模组");
      }
    })();
  }, []);

  useEffect(() => {
    if (!moduleId) {
      return;
    }
    void fetchAllPages<TrackRow>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`)
      .then(setTracks)
      .catch((error) => toast.error(isApiError(error) ? error.message : "无法加载曲目"));
  }, [moduleId]);

  const bgmTracks = tracks.filter((track) => track.type === "bgm");
  const soundEffects = tracks.filter((track) => track.type === "se");

  return (
    <AdminLayout active="music">
      <div className="flex h-full min-h-0 flex-col gap-5">
        <PageHeader
          title="音乐资源"
          description="音频归属模组 · 在模组页上传，团内由 GM 控制播放"
          actions={
            moduleId ? (
              <Button asChild variant="primaryGradient" className="font-semibold">
                <Link to="/gm/module/$moduleId" params={{ moduleId }}>
                  <Upload />
                  去模组上传
                </Link>
              </Button>
            ) : null
          }
        />
        <div className="flex gap-2">
          {modules.map((module) => (
            <Button key={module.id} type="button" variant={module.id === moduleId ? "primaryGradient" : "tertiary"} onClick={() => setModuleId(module.id)}>
              {module.name}
            </Button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 gap-5">
          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Disc3 className="text-accent-hover size-4" />
              <span className="text-foreground text-sm font-semibold">BGM</span>
              <Badge variant="soft" size="sm">{bgmTracks.length} 首</Badge>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {bgmTracks.map((track) => (
                <Card key={track.id} className="flex-row items-center gap-3 rounded-xl px-3 py-2.5">
                  <Play className="text-foreground-tertiary size-4" />
                  <span className="flex-1 text-sm font-semibold">{track.name}</span>
                </Card>
              ))}
            </div>
          </section>
          <section className="flex w-[400px] shrink-0 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Zap className="text-warning size-4" />
              <span className="text-foreground text-sm font-semibold">SE</span>
              <Badge variant="soft" size="sm">{soundEffects.length} 个</Badge>
            </div>
            {soundEffects.map((track) => (
              <Card key={track.id} className="px-3 py-2.5 text-sm">{track.name}</Card>
            ))}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
