import type { PlayStageCtx } from "@cogm/theme-sdk";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { t } from "@/i18n";

export function PlayStage({ viewport, view, nodes }: PlayStageCtx) {
  const alt = view.sceneName || t("play.currentScene");
  const src = view.sceneBgUrl ?? undefined;

  if (viewport === "portrait") {
    return (
      <div className="relative h-[clamp(340px,48dvh,440px)] w-full shrink-0 overflow-hidden bg-background">
        <SceneBackdrop src={src} alt={alt} />
        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-stage-scrim-strong to-transparent" />
        <div className="absolute inset-x-0 top-0 flex flex-col gap-1 px-3.5 pt-2">
          <div className="flex items-center justify-between gap-2">{nodes.sceneInfo}</div>
          <div className="flex items-center justify-end gap-2">{nodes.audio}</div>
        </div>
        {nodes.portrait}
        {nodes.dialogue ? <div className="absolute inset-x-3 bottom-2">{nodes.dialogue}</div> : null}
      </div>
    );
  }

  if (viewport === "landscape") {
    return (
      <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-background">
        <SceneBackdrop src={src} alt={alt} />
        <div className="absolute inset-x-0 top-12 h-16 bg-linear-to-b from-stage-scrim to-transparent" />
        <div className="bg-stage-scrim absolute inset-x-0 top-0 flex h-12 items-center justify-between gap-2 px-3 py-1">
          {nodes.sceneInfo}
          {nodes.audio}
        </div>
        {nodes.portrait}
        {nodes.dialogue ? <div className="absolute inset-x-4 bottom-3">{nodes.dialogue}</div> : null}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <SceneBackdrop src={src} alt={alt} />
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-stage-scrim to-transparent" />
      <div className="absolute top-5 left-6 flex items-center gap-2.5">{nodes.sceneInfo}</div>
      <div className="absolute top-5 right-6">{nodes.audio}</div>
      {nodes.portrait}
      {nodes.dialogue ? <div className="absolute inset-x-10 bottom-6">{nodes.dialogue}</div> : null}
    </div>
  );
}
