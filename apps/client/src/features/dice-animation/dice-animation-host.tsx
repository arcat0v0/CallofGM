import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayStore } from "@/stores/play-store";
import { useRuntimeConfigStore } from "@/stores/runtime-config-store";
import { diceAnimationFromMessage } from "./animation-events";
import { DiceAnimationLayer, preloadDiceAssets } from "./dice-animation";
import { useDiceEventStore } from "./dice-event-store";
import type { DiceAnimationRequest, DiceSkin } from "./model";

function DiceAnimationHost({ result }: { result?: ReactNode }) {
	const [current, setCurrent] = useState<DiceAnimationRequest | null>(null);
	const [settled, setSettled] = useState(false);
	const queueRef = useRef<DiceAnimationRequest[]>([]);
	const seenRef = useRef(new Set<string>());
	const mountedEventRef = useRef(useDiceEventStore.getState().latest);
	const message = useDiceEventStore((state) => state.latest);
	const setActive = useDiceEventStore((state) => state.setActive);
	const settingsSkin = usePlayStore((state) => state.settings.diceSkin);
	const runtimeConfigLoaded = useRuntimeConfigStore((state) => state.loaded);
	const diceAssetBaseUrl = useRuntimeConfigStore(
		(state) => state.diceAssetBaseUrl,
	);
	const skin: DiceSkin = settingsSkin === "bone" ? "bone" : "olive";

	useEffect(() => {
		if (!runtimeConfigLoaded) return;
		preloadDiceAssets(skin);
	}, [runtimeConfigLoaded, skin, diceAssetBaseUrl]);

	useEffect(() => {
		if (!message || message === mountedEventRef.current) return;
		const incoming = diceAnimationFromMessage(message, skin);
		if (!incoming || seenRef.current.has(incoming.id)) return;
		seenRef.current.add(incoming.id);
		queueRef.current = [...queueRef.current, incoming];
		setCurrent((active) => {
			if (active) return active;
			setActive(incoming.eventId);
			return incoming;
		});
	}, [message, skin, setActive]);

	const settle = useCallback(() => {
		setSettled(true);
	}, []);

	const finish = useCallback(() => {
		queueRef.current = queueRef.current.slice(1);
		const next = queueRef.current[0] ?? null;
		setSettled(false);
		setCurrent(next);
		setActive(next?.eventId ?? null);
	}, [setActive]);

	if (!current) return null;

	return (
		<DiceAnimationLayer
			request={current}
			assetBaseUrl={diceAssetBaseUrl}
			settled={settled}
			result={result}
			onSettle={settle}
			onComplete={finish}
		/>
	);
}

export { DiceAnimationHost };
