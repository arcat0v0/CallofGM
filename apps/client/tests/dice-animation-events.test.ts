import { describe, expect, test } from "bun:test";
import type { SessionEvent } from "@cogm/shared";
import { diceAnimationFromMessage } from "@/features/dice-animation/animation-events";

const liveDiceRoll = {
	protocolVersion: 1,
	eventId: 12,
	type: "dice:rolled",
	occurredAt: 1,
	payload: {
		rollerType: "player",
		hidden: false,
		result: {
			expression: "1d20",
			detail: "1d20=[7]",
			total: 7,
			rolls: [7],
		},
	},
} satisfies SessionEvent;

describe("dice animation event mapping", () => {
	test("maps a live dice roll to an authoritative animation", () => {
		const animation = diceAnimationFromMessage(liveDiceRoll);
		expect(animation).toMatchObject({
			id: "dice-12",
			kind: "roll",
			faces: 20,
			total: 7,
		});
	});

	test("maps a live check result to the percentile dice pair", () => {
		const animation = diceAnimationFromMessage({
			protocolVersion: 1,
			eventId: 13,
			type: "check:resolved",
			occurredAt: 1,
			payload: {
				hidden: false,
				result: { roll: 47, outcome: "regular_success" },
			},
		} satisfies SessionEvent);
		expect(animation).toMatchObject({
			id: "check-13",
			kind: "check",
			roll: 47,
		});
	});

	test("never animates hidden results or non-dice live events", () => {
		expect(
			diceAnimationFromMessage({
				...liveDiceRoll,
				payload: { ...liveDiceRoll.payload, hidden: true },
			}),
		).toBeNull();
		expect(
			diceAnimationFromMessage({
				...liveDiceRoll,
				payload: {
					...liveDiceRoll.payload,
					result: { ...liveDiceRoll.payload.result, rolls: [] },
				},
			}),
		).toBeNull();
		expect(
			diceAnimationFromMessage({
				...liveDiceRoll,
				type: "chat:message",
			} satisfies SessionEvent),
		).toBeNull();
	});
});
