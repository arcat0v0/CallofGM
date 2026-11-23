import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterSheetPage } from "@/features/characters/character-sheet-page";
import { t, useI18nVersion } from "@/i18n";
import {
	type BackSearch,
	GM_BACK_PREFIXES,
	parseBackSearch,
	resolveBackTarget,
} from "@/lib/back-navigation";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/characters_/$characterId")({
	validateSearch: (search: Record<string, unknown>): BackSearch =>
		parseBackSearch(search, GM_BACK_PREFIXES),
	beforeLoad: requireGmAuth,
	component: GmCharacterSheetRoute,
});

function GmCharacterSheetRoute() {
	useI18nVersion();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const { characterId } = Route.useParams();
	const backTarget = resolveBackTarget(
		{
			from: search.from,
			fallback: "/gm/characters",
			allowedPrefixes: GM_BACK_PREFIXES,
			currentPathname: `/gm/characters/${encodeURIComponent(characterId)}`,
		},
		t,
	);

	return (
		<CharacterSheetPage
			scope="gm"
			characterId={characterId}
			backLabel={backTarget.label}
			onBack={() =>
				void navigate({
					to: backTarget.to as never,
					search: backTarget.search as never,
					hash: backTarget.hash,
				})
			}
		/>
	);
}
