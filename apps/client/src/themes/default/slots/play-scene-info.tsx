import type { PlaySceneInfoCtx } from "@cogm/theme-sdk";
import { SceneInfo } from "@/features/session-stage/scene-info";

export function PlaySceneInfo({ variant }: PlaySceneInfoCtx) {
  return <SceneInfo variant={variant} />;
}