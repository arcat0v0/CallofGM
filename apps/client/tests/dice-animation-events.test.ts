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

	test("describes bonus dice candidates in the check animation", () => {
		const animation = diceAnimationFromMessage({
			protocolVersion: 1,
			eventId: 14,
			type: "check:resolved",
			occurredAt: 1,
			payload: {
				hidden: false,
				result: {
					roll: 34,
					outcome: "regular_success",
					bonusDice: 1,
					penaltyDice: 0,
					tensCandidates: [3, 7],
				},
			},
		} satisfies SessionEvent);
		expect(animation).toMatchObject({
			kind: "check",
			tensCandidates: [3, 7],
			caption: "奖励骰 · 候选 34 / 74 · 取 34",
		});
	});

	test("animates both authoritative d20s for a public advantage check", () => {
		const event = {
			...liveDiceRoll,
			type: "check:resolved",
			payload: {
				hidden: false,
				result: {
					ruleId: "dnd5r",
					kind: "skill",
					mode: "advantage",
					rolls: [7, 15],
					roll: 15,
					modifier: 3,
					total: 18,
					dc: 14,
					outcome: "success",
					success: true,
				},
			},
		};
		expect(diceAnimationFromMessage(event)).toMatchObject({
			kind: "roll",
			faces: 20,
			rolls: [7, 15],
			total: 18,
		});
		expect(
			diceAnimationFromMessage({
				...event,
				payload: { ...event.payload, hidden: true },
			}),
		).toBeNull();
	});

	test("never animates hidden results or non-dice live events", () => {
		expect(
			diceAnimationFromMessage({
				...liveDiceRoll,
				replayed: true,
			}),
		).toBeNull();
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
