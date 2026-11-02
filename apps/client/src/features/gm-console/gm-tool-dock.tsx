import { Dices, Image as ImageIcon, Music2, ScrollText, Users } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { ToolDock, ToolDockButton } from "@/components/shared/tool-dock";
import { usePlayStore } from "@/stores/play-store";
import { t } from "@/i18n";
import { AudioPanel } from "./audio-panel";
import { CheckPanel } from "./check-panel";
import { CharactersPanel } from "./characters-panel";
import { HandoutPanel } from "./handout-panel";
import { ScenePanel } from "./scene-panel";
import { useGmTool, type GmTool } from "./gm-tool-context";

const TOOLS: Array<{ id: GmTool; labelKey: string; icon: LucideIcon }> = [
  { id: "scene", labelKey: "gm.workbench.toolScene", icon: ImageIcon },
  { id: "characters", labelKey: "gm.workbench.toolCharacters", icon: Users },
  { id: "handouts", labelKey: "gm.workbench.toolHandouts", icon: ScrollText },
  { id: "check", labelKey: "gm.workbench.toolCheck", icon: Dices },
  { id: "audio", labelKey: "gm.workbench.toolAudio", icon: Music2 },
];

function GmToolDock() {
  const { activeTool, closeTool, toggleTool } = useGmTool();
  const ended = usePlayStore((state) => state.status === "ended");

  useEffect(() => {
    if (!activeTool) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeTool();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, closeTool]);

  useEffect(() => {
    if (ended && activeTool) {
      closeTool();
    }
  }, [activeTool, closeTool, ended]);

  const panel =
    activeTool === "scene" ? (
      <ScenePanel onClose={closeTool} />
    ) : activeTool === "characters" ? (
      <CharactersPanel onClose={closeTool} />
    ) : activeTool === "handouts" ? (
      <HandoutPanel onClose={closeTool} />
    ) : activeTool === "check" ? (
      <CheckPanel onClose={closeTool} />
    ) : activeTool === "audio" ? (
      <AudioPanel onClose={closeTool} />
    ) : null;

  return (
    <>
      {activeTool && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden
              className="bg-md-scrim/25 animate-in fade-in fixed inset-0 z-20 duration-200"
              onClick={closeTool}
            />,
            document.body,
          )
        : null}
      <div className="relative z-30">
        <ToolDock
          label={t("gm.workbench.tools")}
          className="bg-md-surface-container-high/92 border-md-outline-variant/40 shadow-overlay border p-1.5"
        >
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id;
            const label = t(tool.labelKey);
            return (
              <ToolDockButton
                key={tool.id}
                icon={tool.icon}
                label={label}
                active={active}
                disabled={ended}
                onClick={() => toggleTool(tool.id)}
              />
            );
          })}
        </ToolDock>
      {panel ? (
        <div className="absolute top-[calc(100%_+_12px)] left-1/2 z-30 -translate-x-1/2">
          {panel}
        </div>
      ) : null}
      </div>
    </>
  );
}

export { GmToolDock };