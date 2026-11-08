import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterSheetPage } from "@/features/characters/character-sheet-page";
import { useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/characters_/$characterId")({
	beforeLoad: requireGmAuth,
	component: GmCharacterSheetRoute,
});

function GmCharacterSheetRoute() {
	useI18nVersion();
	const navigate = useNavigate();
	const { characterId } = Route.useParams();

	return (
		<CharacterSheetPage
			scope="gm"
			characterId={characterId}
			onBack={() => void navigate({ to: "/gm/characters" })}
		/>
	);
}
