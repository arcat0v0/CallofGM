import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CharacterCreationPageView } from "@/features/characters/character-creation-page";
import { t, useI18nVersion } from "@/i18n";
import {
	PL_BACK_PREFIXES,
	resolveBackTarget,
	safeBackPath,
} from "@/lib/back-navigation";
import { requireAccount } from "@/lib/identity";
import { useRuleOptions } from "@/lib/rules-api";

type CharacterCreationSearch = {
	invite?: string;
	name?: string;
	rule?: string;
	targetName?: string;
	from?: string;
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
		from: safeBackPath(search.from, PL_BACK_PREFIXES),
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
	const backTarget = resolveBackTarget(
		{
			from: search.from,
			fallback: inviteToken
				? `/submit/${encodeURIComponent(inviteToken)}`
				: "/pl/characters",
			allowedPrefixes: PL_BACK_PREFIXES,
			currentPathname: "/pl/characters/new",
		},
		t,
	);

	function leave() {
		void navigate({
			to: backTarget.to as never,
			search: backTarget.search as never,
			hash: backTarget.hash,
		});
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
			backLabel={backTarget.label}
			onDone={() => undefined}
			onNavigateBack={leave}
		/>
	);
}
