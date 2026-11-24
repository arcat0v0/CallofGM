import type { SeatRole, SessionStatus } from "@cogm/shared";
import { SessionStateInvalidError } from "./errors";

const NEXT_STATUS: Partial<Record<string, SessionStatus>> = {
	waiting: "preparing",
	preparing: "active",
	active: "ended",
};

const ENDED_ROSTER_ERRORS = {
	"assign-pc": "Cannot assign PC seat in an ended session",
	"add-npc": "Cannot add NPCs to an ended session",
	"remove-npc": "Cannot remove NPCs from an ended session",
	sync: "Cannot sync characters in an ended session",
};

export class SessionLifecycle {
	constructor(
		private readonly session: {
			readonly status: string;
			readonly phase: string;
		},
	) {}

	isEnded(): boolean {
		return this.session.status === "ended";
	}

	assertCanTransitionStatus(target: SessionStatus): "noop" | "transition" {
		if (this.session.status === target) return "noop";
		if (NEXT_STATUS[this.session.status] !== target) {
			throw new SessionStateInvalidError(
				`Invalid transition from ${this.session.status} to ${target}`,
			);
		}
		return "transition";
	}

	assertCanChangePhase(): void {
		if (this.session.status !== "active") {
			throw new SessionStateInvalidError(
				"Phase updates are only allowed in active sessions",
			);
		}
	}

	assertCanClaimSeat(role: SeatRole): void {
		if (this.isEnded() && role !== "ob") {
			throw new SessionStateInvalidError(
				"Cannot claim PC seat in an ended session",
			);
		}
	}

	rosterOrSyncError(
		action: keyof typeof ENDED_ROSTER_ERRORS,
	): SessionStateInvalidError | undefined {
		if (this.isEnded())
			return new SessionStateInvalidError(ENDED_ROSTER_ERRORS[action]);
	}

	assertCanModifyRosterOrSync(action: keyof typeof ENDED_ROSTER_ERRORS): void {
		const error = this.rosterOrSyncError(action);
		if (error) throw error;
	}

	assertCanConfirmGrowth(confirmedAt: number | null): void {
		if (!this.isEnded()) {
			throw new SessionStateInvalidError(
				"Growth can only be confirmed after the session ends",
			);
		}
		if (confirmedAt !== null) {
			throw new SessionStateInvalidError(
				"Growth has already been confirmed for this session",
			);
		}
	}

	assertCommandAllowed(
		allowedStatuses: readonly string[] | undefined,
		allowWhenEnded: boolean | undefined,
	): void {
		if (this.isEnded()) {
			if (!allowWhenEnded)
				throw new SessionStateInvalidError("Session has ended");
			return;
		}
		const allowed =
			allowedStatuses?.includes(this.session.status) ??
			this.session.status === "active";
		if (!allowed) {
			throw new SessionStateInvalidError(
				`Command not allowed while session is ${this.session.status}`,
			);
		}
	}

	isVoiceAvailable(): boolean {
		return (
			this.session.status === "preparing" || this.session.status === "active"
		);
	}

	canVoiceSpeak(
		role: "gm" | SeatRole,
		{ speakGranted, muted }: { speakGranted: boolean; muted: boolean },
	): boolean {
		return (
			speakGranted &&
			!muted &&
			(role === "gm" ||
				this.session.status === "preparing" ||
				this.session.status === "active")
		);
	}
}
