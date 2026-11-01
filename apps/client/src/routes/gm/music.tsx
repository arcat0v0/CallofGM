import { createFileRoute, Link } from "@tanstack/react-router";
import type { ModuleDto, TrackDto } from "@cogm/shared";
import { Howl } from "howler";
import { Disc3, Pause, Pencil, Play, Trash2, Upload, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, fetchAllPages, isApiError, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { formatDurationMmSs } from "@/lib/format";
import { t, useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/music")({
  beforeLoad: requireGmAuth,
  component: MusicResourcesPage,
});

function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatStamp(epochMs: number | null): string {
  if (epochMs === null) {
    return "—";
  }
  return new Date(epochMs).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrackRow({
  track,
  previewing,
  onTogglePreview,
  onReload,
  onDelete,
}: {
  track: TrackDto;
  previewing: boolean;
  onTogglePreview: () => void;
  onReload: () => Promise<void>;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(track.name);

  useEffect(() => {
    setName(track.name);
  }, [track.name]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === track.name) {
      setRenaming(false);
      setName(track.name);
      return;
    }
    try {
      await api(`/gm/modules/tracks/${encodeURIComponent(track.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setRenaming(false);
      await onReload();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : t("gm.music.renameFailed"));
    }
  }

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 duration-500 ease-standard-default-spatial">
      <Button
        type="button"
        variant={previewing ? "accentSoft" : "tertiary"}
        size="icon-sm"
        className="size-8 shrink-0"
        aria-label={previewing ? t("gm.music.previewStopAria", { name: track.name }) : t("gm.music.previewAria", { name: track.name })}
        onClick={onTogglePreview}
      >
        {previewing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        {renaming ? (
          <Input
            value={name}
            autoFocus
            aria-label={t("gm.music.renameAria", { name: track.name })}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void saveName();
              }
              if (event.key === "Escape") {
                setRenaming(false);
                setName(track.name);
              }
            }}
            className="h-7 text-label-medium"
          />
        ) : (
          <span className="truncate text-body-medium-emph">{track.name}</span>
        )}
        <span className="text-foreground-tertiary text-label-small">
          {formatDurationMmSs(track.duration)} · {formatBytes(track.audioSize)} · {t("gm.music.uploaded", { time: formatStamp(track.audioUploadedAt) })}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("gm.music.renameAria", { name: track.name })}
        className="size-7 shrink-0 text-foreground-tertiary"
        onClick={() => setRenaming(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("gm.music.deleteAria", { name: track.name })}
        className="size-7 shrink-0 text-danger-soft-foreground"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </Card>
  );
}

function MusicResourcesPage() {
  useI18nVersion();
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [tracks, setTracks] = useState<TrackDto[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrackDto | null>(null);
  const previewRef = useRef<Howl | null>(null);

  function stopPreview() {
    previewRef.current?.unload();
    previewRef.current = null;
    setPreviewId(null);
  }

  function togglePreview(track: TrackDto) {
    if (previewId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const src = mediaUrl(track.audioAssetId);
    if (!src) {
      toast.error(t("gm.music.audioUnavailable"));
      return;
    }
    const howl = new Howl({ src: [src], html5: true, xhr: { withCredentials: true }, volume: 0.8 });
    howl.once("end", () => {
      if (previewRef.current === howl) {
        previewRef.current = null;
        setPreviewId(null);
      }
      howl.unload();
    });
    howl.play();
    previewRef.current = howl;
    setPreviewId(track.id);
  }

  useEffect(() => () => stopPreview(), []);

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

  async function reloadTracks() {
    if (!moduleId) {
      return;
    }
    try {
      setTracks(await fetchAllPages<TrackDto>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`));
    } catch (error) {
      toast.error(isApiError(error) ? error.message : t("gm.music.loadTracksFailed"));
    }
  }

  const bgmTracks = tracks.filter((track) => track.type === "bgm");
  const soundEffects = tracks.filter((track) => track.type === "se");

  return (
    <AdminLayout>
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
        <div className="flex flex-wrap gap-2">
          {modules.map((module) => (
            <Button key={module.id} type="button" variant={module.id === moduleId ? "primary" : "tertiary"} onClick={() => { stopPreview(); setModuleId(module.id); }}>
              {module.name}
            </Button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 xl:flex-row">
          <section className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 flex-1 flex-col gap-3 duration-500 ease-standard-default-spatial">
            <div className="flex items-center gap-2">
              <Disc3 className="text-accent-hover size-4" />
              <span className="text-foreground text-body-medium-emph">{t("gm.music.bgm")}</span>
              <Badge variant="soft" size="sm">{t("gm.music.bgmCount", { count: bgmTracks.length })}</Badge>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {bgmTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  previewing={previewId === track.id}
                  onTogglePreview={() => togglePreview(track)}
                  onReload={reloadTracks}
                  onDelete={() => setDeleteTarget(track)}
                />
              ))}
              {bgmTracks.length === 0 ? (
                <p className="text-foreground-tertiary text-label-small">{t("gm.music.noBgm")}</p>
              ) : null}
            </div>
          </section>
          <section className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 w-full shrink-0 flex-col gap-3 delay-75 duration-500 ease-standard-default-spatial xl:w-[400px]">
            <div className="flex items-center gap-2">
              <Zap className="text-warning size-4" />
              <span className="text-foreground text-body-medium-emph">{t("gm.music.se")}</span>
              <Badge variant="soft" size="sm">{t("gm.music.seCount", { count: soundEffects.length })}</Badge>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {soundEffects.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  previewing={previewId === track.id}
                  onTogglePreview={() => togglePreview(track)}
                  onReload={reloadTracks}
                  onDelete={() => setDeleteTarget(track)}
                />
              ))}
              {soundEffects.length === 0 ? (
                <p className="text-foreground-tertiary text-label-small">{t("gm.music.noSe")}</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        icon={Trash2}
        confirmIcon={Trash2}
        title={t("gm.music.deleteTitle")}
        description={t("gm.music.deleteDescription", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (!target) {
            return;
          }
          if (previewId === target.id) {
            stopPreview();
          }
          void api(`/gm/modules/tracks/${encodeURIComponent(target.id)}`, { method: "DELETE" })
            .then(() => reloadTracks())
            .catch((error) => toast.error(isApiError(error) ? error.message : t("gm.music.deleteFailed")));
        }}
      />
    </AdminLayout>
  );
}
