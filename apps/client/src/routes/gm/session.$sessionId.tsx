import { createFileRoute } from "@tanstack/react-router";
import { GmConsoleView } from "@/features/gm-console/gm-console-view";

export const Route = createFileRoute("/gm/session/$sessionId")({
  component: GmConsoleView,
});
