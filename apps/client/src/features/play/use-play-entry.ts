import type { MyClaimResponse } from "@cogm/shared";
import { useCallback, useEffect, useState } from "react";
import { api, isApiError } from "@/lib/api";
import { ensurePlayer, fetchAccountMe } from "@/lib/identity";
import { type PlayEntryGate, resolvePlayEntry } from "@/lib/play-entry";

async function autoClaimIfSingleOption(sessionId: string): Promise<void> {
	const path = `/sessions/${encodeURIComponent(sessionId)}/my-claim`;
	try {
		const before = await api<MyClaimResponse>(path);
		if (before.isGm || before.claim || !before.canAutoClaimCharacterId) {
			return;
		}
		const characterId = before.canAutoClaimCharacterId;
		await api(`/sessions/${encodeURIComponent(sessionId)}/claim`, {
			method: "POST",
			body: JSON.stringify({ role: "pc", characterId }),
		});
	} catch (error) {
		if (isApiError(error) && (error.status === 401 || error.status === 403)) {
			return;
		}
	}
}

export function usePlayEntry(sessionId: string): {
	gate: PlayEntryGate;
	retry: () => void;
} {
	const [claim, setClaim] = useState<MyClaimResponse | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setClaim(null);
		setFailed(false);
		void (async () => {
			try {
				const account = await fetchAccountMe();
				if (account?.role === "pl") {
					await autoClaimIfSingleOption(sessionId);
				} else if (!account) {
					await ensurePlayer();
				}
				const result = await api<MyClaimResponse>(
					`/sessions/${encodeURIComponent(sessionId)}/my-claim`,
				);
				if (!cancelled) {
					setClaim(result);
				}
			} catch {
				if (!cancelled) {
					setFailed(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId, attempt]);

	const retry = useCallback(() => {
		setAttempt((value) => value + 1);
	}, []);

	return { gate: resolvePlayEntry({ claim, failed }), retry };
}
