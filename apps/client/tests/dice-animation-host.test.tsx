import { describe, expect, test } from "bun:test";
import type { SessionEvent } from "@cogm/shared";
import { render } from "@testing-library/react";
import { DiceAnimationLayer } from "@/features/dice-animation/dice-animation";
import { DiceAnimationHost } from "@/features/dice-animation/dice-animation-host";

describe("DiceAnimationHost", () => {
	test("renders nothing when no animation is active", () => {
		const { container } = render(<DiceAnimationHost message={null} />);
		expect(container.firstChild).toBeNull();
	});

	test("renders nothing for hidden or replayed events", () => {
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

		const { container } = render(<DiceAnimationHost message={replayedEvent} />);
		expect(container.firstChild).toBeNull();
	});

	test("DiceAnimationLayer renders nothing when request is null", () => {
		const { container } = render(<DiceAnimationLayer request={null} />);
		expect(container.firstChild).toBeNull();
	});
});
