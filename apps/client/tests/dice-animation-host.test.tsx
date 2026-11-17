import { afterEach, describe, expect, test } from "bun:test";
import type { SessionEvent } from "@cogm/shared";
import { act, render } from "@testing-library/react";
import { DiceAnimationLayer } from "@/features/dice-animation/dice-animation";
import { DiceAnimationHost } from "@/features/dice-animation/dice-animation-host";
import { useDiceEventStore } from "@/features/dice-animation/dice-event-store";

const replayedEvent = {
	protocolVersion: 1,
	eventId: 9,
	type: "dice:rolled",
	occurredAt: 1,
	replayed: true,
	payload: {
		rollerType: "player",
		hidden: false,
		result: {
			expression: "1d20",
			detail: "1d20=[12]",
			total: 12,
			rolls: [12],
		},
	},
} satisfies SessionEvent;

describe("DiceAnimationHost", () => {
	afterEach(() => {
		useDiceEventStore.setState({ latest: null });
	});

	test("renders nothing when no animation is active", () => {
		const { container } = render(<DiceAnimationHost />);
		expect(container.firstChild).toBeNull();
	});

	test("renders nothing for replayed events", () => {
		const { container } = render(<DiceAnimationHost />);
		act(() => useDiceEventStore.getState().observe(replayedEvent));
		expect(container.firstChild).toBeNull();
	});

	test("DiceAnimationLayer renders nothing when request is null", () => {
		const { container } = render(<DiceAnimationLayer request={null} />);
		expect(container.firstChild).toBeNull();
	});

	test("renders the animation as an in-flow message card instead of an overlay", () => {
		const { container } = render(
			<DiceAnimationLayer
				request={{
					id: "dice-99",
					eventId: 99,
					kind: "roll",
					faces: 20,
					total: 14,
					rolls: [14],
					label: "结果 14",
				}}
			/>,
		);
		const overlay = container.firstElementChild as HTMLElement | null;
		expect(overlay).not.toBeNull();
		expect(overlay?.className).not.toContain("absolute");
		expect(overlay?.className).not.toContain("fixed");
		expect(overlay?.getAttribute("data-slot")).toBe("dice-animation-stage");
		expect(overlay?.textContent).toContain("结果 14");
	});

	test("crossfades the dice card into the result content when settled", () => {
		const { container } = render(
			<DiceAnimationLayer
				request={{
					id: "check-7",
					eventId: 7,
					kind: "check",
					roll: 34,
					outcome: "regular_success",
					label: "结果 34",
				}}
				settled
				result={<div data-slot="result-stub">鉴定记录</div>}
			/>,
		);
		const stage = container.firstElementChild as HTMLElement;
		const diceCard = stage.firstElementChild as HTMLElement;
		expect(diceCard.className).toContain("opacity-0");
		expect(stage.textContent).toContain("鉴定记录");
	});
});
