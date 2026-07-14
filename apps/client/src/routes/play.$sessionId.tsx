import { createFileRoute } from "@tanstack/react-router";
import { PlayView } from "@/features/play/play-view";

export const Route = createFileRoute("/play/$sessionId")({
  component: PlayView,
});
