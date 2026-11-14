import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	sessionHistoryEvents,
	sessionRuntimeCheckpoints,
	sessions,
} from "@/platform/db/schema";
import type { Clock, IdGenerator } from "@/platform/ports";
import type { StagedEvents } from "../session-event-bus";
import { captureRuntimeSnapshot } from "./runtime-snapshot";

const TIMELINE_EVENT_TYPES = new Set([
	"dice:rolled",
	"check:resolved",
	"dice:sealed",
	"state:changed",
	"session:phase-changed",
	"scene:changed",
	"expression:changed",
	"handout:granted",
	"session:rewound",
]);

const RUNTIME_EVENT_TYPES = new Set([
	"check:requested",
	"check:resolved",
	"state:changed",
	"session:phase-changed",
	"scene:changed",
	"expression:changed",
	"handout:granted",
	"session:rewound",
]);

export class SessionHistoryRecorder {
	constructor(
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
	) {}

	async record(
		tx: DbClient,
		sessionId: string,
		staged: StagedEvents,
	): Promise<void> {
		if (staged.entries.length === 0) {
			return;
		}
		const now = this.clock.nowEpochMs();

		for (const entry of staged.entries) {
			if (!TIMELINE_EVENT_TYPES.has(entry.event.type)) {
				continue;
			}
			await tx.insert(sessionHistoryEvents).values({
				id: this.idGenerator.nextId(),
				sessionId,
				eventId: entry.event.eventId,
				type: entry.event.type,
				payloadJson: JSON.stringify(entry.event.payload),
				visibilityJson: JSON.stringify(entry.visibility),
				playerVisible: entry.event.type === "state:changed" ? 0 : 1,
				anchorable: entry.event.type === "session:rewound" ? 0 : 1,
				occurredAt: entry.event.occurredAt,
				createdAt: now,
			});
		}

		if (
			staged.entries.some((entry) => RUNTIME_EVENT_TYPES.has(entry.event.type))
		) {
			const last = staged.entries[staged.entries.length - 1]!;
			await this.writeCheckpoint(tx, sessionId, last.event.eventId, now);
		}
	}

	async recordHead(tx: DbClient, sessionId: string): Promise<void> {
		const rows = await tx
			.select({ lastEventId: sessions.lastEventId })
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		const lastEventId = rows[0]?.lastEventId;
		if (lastEventId === undefined) {
			return;
		}
		await this.writeCheckpoint(
			tx,
			sessionId,
			lastEventId,
			this.clock.nowEpochMs(),
		);
	}

	private async writeCheckpoint(
		tx: DbClient,
		sessionId: string,
		eventId: number,
		createdAt: number,
	): Promise<void> {
		const snapshot = await captureRuntimeSnapshot(tx, sessionId);
		await tx
			.insert(sessionRuntimeCheckpoints)
			.values({
				id: this.idGenerator.nextId(),
				sessionId,
				eventId,
				stateJson: JSON.stringify(snapshot),
				createdAt,
			})
			.onConflictDoUpdate({
				target: [
					sessionRuntimeCheckpoints.sessionId,
					sessionRuntimeCheckpoints.eventId,
				],
				set: { stateJson: JSON.stringify(snapshot), createdAt },
			});
	}
}
