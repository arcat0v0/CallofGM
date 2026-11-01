import type { PlayStageCtx } from "@cogm/theme-sdk";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { t } from "@/i18n";

export function PlayStage({ viewport, view, nodes }: PlayStageCtx) {
  const alt = view.sceneName || t("play.currentScene");
  const src = view.sceneBgUrl ?? undefined;

  if (viewport === "portrait") {
    return (
      <div className="relative h-[330px] w-full shrink-0 overflow-hidden bg-background">
        <SceneBackdrop src={src} alt={alt} />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-stage-scrim-strong to-transparent" />
        <div className="absolute inset-x-0 top-0 flex h-[52px] items-center justify-between px-3.5">
          {nodes.sceneInfo}
          {nodes.audio}
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
        <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-stage-scrim to-transparent" />
        <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between px-3.5">
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
      {nodes.dialogue ? <div className="absolute inset-x-10 bottom-[36px]">{nodes.dialogue}</div> : null}
    </div>
  );
}