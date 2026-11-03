import type { SessionEvent } from "@cogm/shared";
import type { VisibilityScope } from "./domain/visibility";

export interface BufferedEvent {
	event: SessionEvent;
	visibility: VisibilityScope;
}

export class EventRingBuffer {
	private buffers = new Map<string, BufferedEvent[]>();
	private resetFloors = new Map<string, number>();
	private readonly maxCapacity = 1000;

	markReset(sessionId: string, minValidEventId: number): void {
		this.resetFloors.set(sessionId, minValidEventId);
	}

	add(
		sessionId: string,
		event: SessionEvent,
		visibility: VisibilityScope,
	): void {
		if (!this.buffers.has(sessionId)) {
			this.buffers.set(sessionId, []);
		}
		const buf = this.buffers.get(sessionId)!;
		buf.push({ event, visibility });
		if (buf.length > this.maxCapacity) {
			buf.shift();
		}
	}

	getEvents(sessionId: string): BufferedEvent[] {
		return this.buffers.get(sessionId) || [];
	}

	hasSequencedEventsFrom(sessionId: string, lastEventId: number): boolean {
		const floor = this.resetFloors.get(sessionId);
		if (floor !== undefined && lastEventId < floor) {
			return false;
		}
		const buf = this.buffers.get(sessionId);
		if (!buf || buf.length === 0) {
			return false;
		}
		const first = buf[0];
		const last = buf[buf.length - 1];
		if (!first || !last) {
			return false;
		}
		const oldestEventId = first.event.eventId;
		const targetEventId = lastEventId + 1;
		const newestEventId = last.event.eventId;
		return targetEventId >= oldestEventId && targetEventId <= newestEventId + 1;
	}

	getEventsFrom(sessionId: string, lastEventId: number): BufferedEvent[] {
		const buf = this.buffers.get(sessionId) || [];
		const targetEventId = lastEventId + 1;
		return buf.filter((e) => e.event.eventId >= targetEventId);
	}

	evict(sessionId: string): void {
		this.buffers.delete(sessionId);
	}
}
