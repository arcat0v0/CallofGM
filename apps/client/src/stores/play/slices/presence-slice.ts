import type { KickedPlayerDto, OnlinePlayerDto } from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import { isEventPayload, type PlaySet } from "../types";

export type PresenceSlice = {
	presence: OnlinePlayerDto[];
	presenceAvailable: boolean;
	kickedPlayers: KickedPlayerDto[];
	kickedReason: string | null;
};

export const presenceDefaults: PresenceSlice = {
	presence: [],
	presenceAvailable: false,
	kickedPlayers: [],
	kickedReason: null,
};

export function applyPresence(set: PlaySet, rawPayload: unknown): void {
	const payload = rawPayload as {
		online?: OnlinePlayerDto[];
		kickedPlayers?: KickedPlayerDto[];
	};
	set({
		presence: payload.online ?? [],
		presenceAvailable: true,
		...(payload.kickedPlayers ? { kickedPlayers: payload.kickedPlayers } : {}),
	});
}

export function applyKick(set: PlaySet, rawPayload: unknown): void {
	const payload = isEventPayload(rawPayload) ? rawPayload : {};
	const reason = typeof payload.reason === "string" ? payload.reason : null;
	set({ terminal: "kicked", kickedReason: reason, connected: false });
	toast.error(t("play.kickLocked"));
}
