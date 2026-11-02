import { Dices, Image as ImageIcon, Music2, ScrollText, Users } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        <div className="bg-md-surface-container-high/92 border-md-outline-variant/40 shadow-overlay flex items-center gap-1 rounded-full border p-1.5 backdrop-blur-xl">
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id;
            const label = t(tool.labelKey);
            return (
              <Button
                key={tool.id}
                type="button"
                variant={active ? "primary" : "ghost"}
                size="sm"
                aria-label={label}
                aria-pressed={active}
                disabled={ended}
                onClick={() => toggleTool(tool.id)}
                className={cn(
                  "h-10 gap-2 rounded-full px-3 text-label-medium transition-[background-color,color,border-radius] duration-200 ease-standard-fast-effects",
                  active
                    ? "rounded-xl hover:bg-accent-hover"
                    : "text-md-on-surface-variant hover:bg-md-on-surface/10 hover:text-md-on-surface",
                )}
              >
                <tool.icon className="size-4" />
                <span>{label}</span>
              </Button>
            );
          })}
        </div>
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