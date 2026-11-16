import type { SessionEvent } from "@cogm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayStore } from "@/stores/play-store";
import { diceAnimationFromMessage } from "./animation-events";
import { DiceAnimationLayer, preloadDiceAssets } from "./dice-animation";
import type { DiceAnimationRequest, DiceSkin } from "./model";

function DiceAnimationHost({ message }: { message: SessionEvent | null }) {
	const [current, setCurrent] = useState<DiceAnimationRequest | null>(null);
	const queueRef = useRef<DiceAnimationRequest[]>([]);
	const seenRef = useRef(new Set<string>());
	const settingsSkin = usePlayStore((state) => state.settings.diceSkin);
	const skin: DiceSkin = settingsSkin === "bone" ? "bone" : "olive";

	useEffect(() => {
		preloadDiceAssets();
	}, []);

	useEffect(() => {
		if (!message) return;
		const incoming = diceAnimationFromMessage(message, skin);
		if (!incoming || seenRef.current.has(incoming.id)) return;
		seenRef.current.add(incoming.id);
		queueRef.current = [...queueRef.current, incoming];
		setCurrent((active) => active ?? incoming);
	}, [message]);

	const complete = useCallback((id: string) => {
		queueRef.current = queueRef.current.filter((item) => item.id !== id);
		setCurrent(queueRef.current[0] ?? null);
	}, []);

	if (!current) return null;

	return <DiceAnimationLayer request={current} onComplete={complete} />;
}

export { DiceAnimationHost };
