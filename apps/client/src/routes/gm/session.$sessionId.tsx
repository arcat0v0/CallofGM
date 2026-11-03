import { createFileRoute } from "@tanstack/react-router";
import { GmConsoleView } from "@/features/gm-console/gm-console-view";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/session/$sessionId")({
	beforeLoad: requireGmAuth,
	component: GmConsoleView,
});
