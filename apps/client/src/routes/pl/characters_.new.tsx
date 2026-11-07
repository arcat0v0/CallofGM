import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterCreationPageView } from "@/features/characters/character-creation-page";
import { useI18nVersion } from "@/i18n";
import { requireAccount } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";

type CharacterCreationSearch = {
	invite?: string;
	name?: string;
	rule?: string;
	targetName?: string;
};

export const Route = createFileRoute("/pl/characters_/new")({
	validateSearch: (
		search: Record<string, unknown>,
	): CharacterCreationSearch => ({
		invite: typeof search.invite === "string" ? search.invite : undefined,
		name: typeof search.name === "string" ? search.name : undefined,
		rule: typeof search.rule === "string" ? search.rule : undefined,
		targetName:
			typeof search.targetName === "string" ? search.targetName : undefined,
	}),
	beforeLoad: () => requireAccount(["pl"]),
	component: PlCharacterCreationPage,
});

function PlCharacterCreationPage() {
	useI18nVersion();
	const account = Route.useRouteContext();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { rules } = useRuleOptions();
	const inviteToken =
		typeof search.invite === "string" && search.invite.length > 0
			? search.invite
			: null;

	function leave() {
		if (inviteToken) {
			void navigate({
				to: "/submit/$token",
				params: { token: inviteToken },
			});
			return;
		}
		void navigate({ to: "/pl/characters" });
	}

	return (
		<CharacterCreationPageView
			accountId={account.userId}
			mode={inviteToken ? "invite" : "independent"}
			inviteToken={inviteToken}
			inviteRuleId={search.rule}
			inviteTargetName={search.targetName}
			initialName={search.name}
			rules={rules}
			onDone={() => undefined}
			onNavigateBack={leave}
		/>
	);
}
