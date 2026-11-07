import { coc7e } from "@cogm/shared";

export type CharacterCreationDraft = {
	version: 1;
	name: string;
	background: string;
	ruleId: string;
	sheet: coc7e.Coc7eCharacterSheet;
};

export type CharacterCreationDraftInput = Omit<
	CharacterCreationDraft,
	"version"
>;

const DRAFT_VERSION = 1;
const KEY_PREFIX = "cogm.character-creation-draft.v1";

export function createEmptyCharacterSheet(): coc7e.Coc7eCharacterSheet {
	return coc7e.normalizeCoc7eSheet({
		attributes: {
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		},
		skills: {},
	});
}

export function parseCharacterCreationDraft(
	input: unknown,
): CharacterCreationDraft | null {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return null;
	}
	const value = input as Record<string, unknown>;
	if (
		value.version !== DRAFT_VERSION ||
		typeof value.name !== "string" ||
		typeof value.background !== "string" ||
		typeof value.ruleId !== "string"
	) {
		return null;
	}
	const sheet = coc7e.Coc7eCharacterSheet.safeParse(value.sheet);
	if (!sheet.success) {
		return null;
	}
	return {
		version: DRAFT_VERSION,
		name: value.name,
		background: value.background,
		ruleId: value.ruleId,
		sheet: sheet.data,
	};
}

export function characterCreationDraftKey(
	accountId: string,
	context: string,
): string {
	return `${KEY_PREFIX}.${encodeURIComponent(accountId)}.${encodeURIComponent(context)}`;
}

function draftKey(accountId: string, context: string): string {
	return characterCreationDraftKey(accountId, context);
}

export function saveCharacterCreationDraft(
	draft: CharacterCreationDraftInput & { accountId: string; context: string },
): boolean {
	try {
		if (typeof localStorage === "undefined") {
			return false;
		}
		localStorage.setItem(
			draftKey(draft.accountId, draft.context),
			JSON.stringify({
				version: DRAFT_VERSION,
				name: draft.name,
				background: draft.background,
				ruleId: draft.ruleId,
				sheet: draft.sheet,
			}),
		);
		return true;
	} catch {
		return false;
	}
}

export function loadCharacterCreationDraft(
	accountId: string,
	context: string,
): CharacterCreationDraft | null {
	try {
		if (typeof localStorage === "undefined") {
			return null;
		}
		const raw = localStorage.getItem(draftKey(accountId, context));
		if (!raw) {
			return null;
		}
		return parseCharacterCreationDraft(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function hasInvalidCharacterCreationDraft(
	accountId: string,
	context: string,
): boolean {
	try {
		if (typeof localStorage === "undefined") {
			return false;
		}
		const raw = localStorage.getItem(draftKey(accountId, context));
		if (!raw) {
			return false;
		}
		return parseCharacterCreationDraft(JSON.parse(raw)) === null;
	} catch {
		return true;
	}
}

export function clearCharacterCreationDraft(
	accountId: string,
	context: string,
): void {
	try {
		if (typeof localStorage === "undefined") {
			return;
		}
		localStorage.removeItem(draftKey(accountId, context));
	} catch {
		return;
	}
}
