import type { GmConsoleStageCtx } from "@cogm/theme-sdk";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { t } from "@/i18n";

export function GmConsoleStage({ view, nodes }: GmConsoleStageCtx) {
  const alt = view.sceneName || t("play.currentScene");
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <SceneBackdrop src={view.sceneBgUrl ?? undefined} alt={alt} />
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-stage-scrim to-transparent" />
      <div className="absolute top-5 left-6 flex items-center gap-2.5">{nodes.sceneInfo}</div>
      <div className="absolute top-5 right-6">{nodes.audio}</div>
      {nodes.portrait}
      {nodes.dialogue ? <div className="absolute inset-x-8 bottom-[36px]">{nodes.dialogue}</div> : null}
    </div>
  );
}