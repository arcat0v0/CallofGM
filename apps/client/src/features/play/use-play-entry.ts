import type { MyClaimResponse } from "@cogm/shared";
import { useCallback, useEffect, useState } from "react";
import { ensurePlayer, fetchAccountMe } from "@/lib/identity";
import { type PlayEntryGate, resolvePlayEntry } from "@/lib/play-entry";

import { enterWithPlayerCharacter, fetchMyClaim } from "@/lib/session-entry";

export function usePlayEntry(sessionId: string): {
	gate: PlayEntryGate;
	retry: () => void;
} {
	const [claim, setClaim] = useState<MyClaimResponse | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retry intentionally reruns the entry request
	useEffect(() => {
		let cancelled = false;
		setClaim(null);
		setFailed(false);
		void (async () => {
			try {
				const account = await fetchAccountMe();
				if (!account) await ensurePlayer();
				const result =
					account?.role === "pl"
						? await enterWithPlayerCharacter(sessionId, account.userId).catch(
								() => fetchMyClaim(sessionId),
							)
						: await fetchMyClaim(sessionId);
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
