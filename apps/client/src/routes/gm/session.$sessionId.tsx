import { createFileRoute } from "@tanstack/react-router";
import { GmConsoleView } from "@/features/gm-console/gm-console-view";
import {
	type BackSearch,
	GM_BACK_PREFIXES,
	parseBackSearch,
} from "@/lib/back-navigation";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/session/$sessionId")({
	validateSearch: (search: Record<string, unknown>): BackSearch =>
		parseBackSearch(search, GM_BACK_PREFIXES),
	beforeLoad: requireGmAuth,
	component: GmConsoleView,
});
