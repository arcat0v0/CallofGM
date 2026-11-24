import { describe, expect, test } from "bun:test";
import { SessionPhase, SessionStatus } from "@cogm/shared";
import { SessionStateInvalidError } from "@/modules/sessions/domain/errors";
import { SessionLifecycle } from "@/modules/sessions/domain/session-lifecycle";

const nextStatus: Partial<Record<SessionStatus, SessionStatus>> = {
	waiting: "preparing",
	preparing: "active",
	active: "ended",
};

const voices = ["gm", "pc", "ob"] as const;
const rosterActions = {
	"assign-pc": "Cannot assign PC seat in an ended session",
	"add-npc": "Cannot add NPCs to an ended session",
	"remove-npc": "Cannot remove NPCs from an ended session",
	sync: "Cannot sync characters in an ended session",
} as const;

function expectPolicy(allowed: boolean, assert: () => void, message: string) {
	if (allowed) expect(assert).not.toThrow();
	else expect(assert).toThrow(new SessionStateInvalidError(message));
}

for (const status of SessionStatus.options) {
	describe(status, () => {
		const lifecycle = new SessionLifecycle({
			status,
			phase: "free_discussion",
		});

		test.each(SessionStatus.options)("transition to %s", (target) => {
			if (status === target) {
				expect(lifecycle.assertCanTransitionStatus(target)).toBe("noop");
			} else if (nextStatus[status] === target) {
				expect(lifecycle.assertCanTransitionStatus(target)).toBe("transition");
			} else {
				expect(() => lifecycle.assertCanTransitionStatus(target)).toThrow(
					new SessionStateInvalidError(
						`Invalid transition from ${status} to ${target}`,
					),
				);
			}
		});

		test("phase, claims, roster, sync and growth", () => {
			expectPolicy(
				status === "active",
				() => lifecycle.assertCanChangePhase(),
				"Phase updates are only allowed in active sessions",
			);
			expect(lifecycle.isEnded()).toBe(status === "ended");
			expectPolicy(true, () => lifecycle.assertCanClaimSeat("ob"), "");
			expectPolicy(
				status !== "ended",
				() => lifecycle.assertCanClaimSeat("pc"),
				"Cannot claim PC seat in an ended session",
			);
			for (const action of Object.keys(rosterActions) as Array<
				keyof typeof rosterActions
			>) {
				expectPolicy(
					status !== "ended",
					() => lifecycle.assertCanModifyRosterOrSync(action),
					rosterActions[action],
				);
			}
			expectPolicy(
				status === "ended",
				() => lifecycle.assertCanConfirmGrowth(null),
				"Growth can only be confirmed after the session ends",
			);
			expectPolicy(
				false,
				() => lifecycle.assertCanConfirmGrowth(0),
				status === "ended"
					? "Growth has already been confirmed for this session"
					: "Growth can only be confirmed after the session ends",
			);
		});

		test("command status whitelist and ended override", () => {
			const denied =
				status === "ended"
					? "Session has ended"
					: `Command not allowed while session is ${status}`;
			expectPolicy(
				status === "active",
				() => lifecycle.assertCommandAllowed(undefined, false),
				denied,
			);
			expectPolicy(
				status === "active" || status === "ended",
				() => lifecycle.assertCommandAllowed(undefined, true),
				denied,
			);
			expectPolicy(
				status === "waiting",
				() => lifecycle.assertCommandAllowed(["waiting"], false),
				denied,
			);
			expectPolicy(
				status === "preparing" || status === "active",
				() => lifecycle.assertCommandAllowed(["preparing", "active"], false),
				denied,
			);
			expectPolicy(
				status === "ended",
				() => lifecycle.assertCommandAllowed([], true),
				denied,
			);
		});

		test.each(SessionPhase.options)("voice in %s", (phase) => {
			const inPhase = new SessionLifecycle({ status, phase });
			expect(inPhase.isVoiceAvailable()).toBe(
				status === "preparing" || status === "active",
			);
			for (const role of voices) {
				const statusAllows =
					role === "gm" || status === "preparing" || status === "active";
				expect(
					inPhase.canVoiceSpeak(role, {
						speakGranted: role !== "ob",
						muted: false,
					}),
				).toBe(statusAllows && role !== "ob");
				expect(
					inPhase.canVoiceSpeak(role, { speakGranted: true, muted: false }),
				).toBe(statusAllows);
				expect(
					inPhase.canVoiceSpeak(role, { speakGranted: false, muted: false }),
				).toBe(false);
				expect(
					inPhase.canVoiceSpeak(role, { speakGranted: true, muted: true }),
				).toBe(false);
			}
		});
	});
}
