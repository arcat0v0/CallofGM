import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterSheetPage } from "@/features/characters/character-sheet-page";
import { t, useI18nVersion } from "@/i18n";
import {
	type BackSearch,
	parseBackSearch,
	PL_BACK_PREFIXES,
	resolveBackTarget,
} from "@/lib/back-navigation";
import { requireAccount } from "@/lib/identity";

export const Route = createFileRoute("/pl/characters_/$characterId")({
	validateSearch: (search: Record<string, unknown>): BackSearch =>
		parseBackSearch(search, PL_BACK_PREFIXES),
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharacterSheetRoute,
});

function PlCharacterSheetRoute() {
	useI18nVersion();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const { characterId } = Route.useParams();
	const backTarget = resolveBackTarget(
		{
			from: search.from,
			fallback: "/pl/characters",
			allowedPrefixes: PL_BACK_PREFIXES,
			currentPathname: `/pl/characters/${encodeURIComponent(characterId)}`,
		},
		t,
	);

	return (
		<CharacterSheetPage
			scope="pl"
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
