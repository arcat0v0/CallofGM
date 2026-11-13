import type { SessionEvent } from "@cogm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { diceAnimationFromMessage } from "./animation-events";
import { DiceAnimationLayer } from "./dice-animation";
import type { DiceAnimationRequest } from "./model";

function DiceAnimationHost({ message }: { message: SessionEvent | null }) {
	const [current, setCurrent] = useState<DiceAnimationRequest | null>(null);
	const queueRef = useRef<DiceAnimationRequest[]>([]);
	const seenRef = useRef(new Set<string>());

	useEffect(() => {
		if (!message) return;
		const incoming = diceAnimationFromMessage(message);
		if (!incoming || seenRef.current.has(incoming.id)) return;
		seenRef.current.add(incoming.id);
		queueRef.current = [...queueRef.current, incoming];
		setCurrent((active) => active ?? incoming);
	}, [message]);

	const complete = useCallback((id: string) => {
		queueRef.current = queueRef.current.filter((item) => item.id !== id);
		setCurrent(queueRef.current[0] ?? null);
	}, []);

	return <DiceAnimationLayer request={current} onComplete={complete} />;
}

export { DiceAnimationHost };
