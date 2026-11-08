import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterSheetPage } from "@/features/characters/character-sheet-page";
import { useI18nVersion } from "@/i18n";
import { requireAccount } from "@/lib/identity";

export const Route = createFileRoute("/pl/characters_/$characterId")({
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharacterSheetRoute,
});

function PlCharacterSheetRoute() {
	useI18nVersion();
	const navigate = useNavigate();
	const { characterId } = Route.useParams();

	return (
		<CharacterSheetPage
			scope="pl"
			characterId={characterId}
			onBack={() => void navigate({ to: "/pl/characters" })}
		/>
	);
}
