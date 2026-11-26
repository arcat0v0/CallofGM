import type { MyClaimResponse } from "@cogm/shared";
import { api } from "./api";

const pendingEntries = new Map<string, Promise<MyClaimResponse>>();

export function fetchMyClaim(sessionId: string): Promise<MyClaimResponse> {
	return api<MyClaimResponse>(
		`/sessions/${encodeURIComponent(sessionId)}/my-claim`,
	);
}

export function enterWithPlayerCharacter(
	sessionId: string,
	userId: string,
): Promise<MyClaimResponse> {
	const key = JSON.stringify([sessionId, userId]);
	const pending = pendingEntries.get(key);
	if (pending) return pending;

	const request = (async () => {
		const before = await fetchMyClaim(sessionId);
		const characterId = before.canAutoClaimCharacterId;
		if (
			before.isGm ||
			before.sessionStatus === "ended" ||
			!characterId ||
			before.claim?.role === "pc"
		) {
			return before;
		}

		try {
			await api(`/sessions/${encodeURIComponent(sessionId)}/claim`, {
				method: "POST",
				body: JSON.stringify({ role: "pc", characterId }),
			});
		} catch (error) {
			const latest = await fetchMyClaim(sessionId);
			if (latest.claim?.role === "pc") return latest;
			throw error;
		}
		return fetchMyClaim(sessionId);
	})();
	pendingEntries.set(key, request);
	const clear = () => pendingEntries.delete(key);
	void request.then(clear, clear);
	return request;
}
