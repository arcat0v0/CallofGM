import { createFileRoute, Link } from "@tanstack/react-router";
import type { ModuleDto, TrackDto } from "@cogm/shared";
import { Disc3, Play, Upload, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchAllPages } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/music")({
  beforeLoad: requireGmAuth,
  component: MusicResourcesPage,
});

function MusicResourcesPage() {
  useI18nVersion();
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [tracks, setTracks] = useState<TrackDto[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const next = await fetchAllPages<ModuleDto>("/gm/modules");
        setModules(next);
        setModuleId((current) => current || next[0]?.id || "");
      } catch (error) {
        toast.error(errorText(error, "gm.music.loadModulesFailed"));
      }
    })();
  }, []);

  useEffect(() => {
    if (!moduleId) {
      return;
    }
    void fetchAllPages<TrackDto>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`)
      .then(setTracks)
      .catch((error) => toast.error(errorText(error, "gm.music.loadTracksFailed")));
  }, [moduleId]);

  const bgmTracks = tracks.filter((track) => track.type === "bgm");
  const soundEffects = tracks.filter((track) => track.type === "se");

  return (
    <AdminLayout active="music">
      <div className="flex h-full min-h-0 flex-col gap-5">
        <PageHeader
          title={t("gm.music.title")}
          description={t("gm.music.description")}
          actions={
            moduleId ? (
              <Button asChild variant="primary" className="h-12 px-6">
                <Link to="/gm/module/$moduleId" params={{ moduleId }}>
                  <Upload />
                  {t("gm.music.goUpload")}
                </Link>
              </Button>
            ) : null
          }
        />
        <div className="flex gap-2">
          {modules.map((module) => (
            <Button key={module.id} type="button" variant={module.id === moduleId ? "primary" : "tertiary"} onClick={() => setModuleId(module.id)}>
              {module.name}
            </Button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 gap-5">
          <section className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 flex-1 flex-col gap-3 duration-500 ease-standard-default-spatial">
            <div className="flex items-center gap-2">
              <Disc3 className="text-accent-hover size-4" />
              <span className="text-foreground text-body-medium-emph">{t("gm.music.bgm")}</span>
              <Badge variant="soft" size="sm">{t("gm.music.bgmCount", { count: bgmTracks.length })}</Badge>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {bgmTracks.map((track, index) => (
                <Card
                  key={track.id}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-4 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 duration-500 ease-standard-default-spatial",
                    index % 3 === 1 ? "delay-75" : index % 3 === 2 ? "delay-150" : "",
                  )}
                >
                  <Play className="text-foreground-tertiary size-4" />
                  <span className="flex-1 text-body-medium-emph">{track.name}</span>
                </Card>
              ))}
            </div>
          </section>
          <section className="animate-in fade-in slide-in-from-bottom-4 flex w-[400px] shrink-0 flex-col gap-3 delay-75 duration-500 ease-standard-default-spatial">
            <div className="flex items-center gap-2">
              <Zap className="text-warning size-4" />
              <span className="text-foreground text-body-medium-emph">{t("gm.music.se")}</span>
              <Badge variant="soft" size="sm">{t("gm.music.seCount", { count: soundEffects.length })}</Badge>
            </div>
            {soundEffects.map((track, index) => (
              <Card
                key={track.id}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-4 rounded-2xl px-3 py-2.5 text-body-medium duration-500 ease-standard-default-spatial",
                  index % 3 === 1 ? "delay-75" : index % 3 === 2 ? "delay-150" : "",
                )}
              >
                {track.name}
              </Card>
            ))}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
