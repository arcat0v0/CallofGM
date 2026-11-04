import type { SessionPhase, SessionStatus } from "@cogm/shared";
import { t, translateOr } from "@/i18n";

export function initialsOf(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		return "?";
	}
	const parts = trimmed.split(/\s+/);
	const last = parts[parts.length - 1] ?? trimmed;
	return last.slice(0, 1);
}

export function formatClock(epochMs: number): string {
	const date = new Date(epochMs);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatStamp(epochMs: number): string {
	const date = new Date(epochMs);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day} ${formatClock(epochMs)}`;
}

export function formatDurationMmSs(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function statusTone(
	status: SessionStatus,
): "success" | "accent" | "warning" | "default" {
	if (status === "active") return "success";
	if (status === "preparing") return "accent";
	if (status === "waiting") return "default";
	return "warning";
}

export function expressionLabel(
	key: string | null | undefined,
	label?: string | null,
): string {
	if (label) {
		return label;
	}
	if (!key) {
		return t("expression.default");
	}
	return translateOr(`expression.${key}`, key);
}

export function nextSessionStatus(status: SessionStatus): SessionStatus | null {
	if (status === "waiting") return "preparing";
	if (status === "preparing") return "active";
	if (status === "active") return "ended";
	return null;
}

export function nextStatusActionLabel(status: SessionStatus): string | null {
	if (status === "waiting") return t("format.nextStatus.preparing");
	if (status === "preparing") return t("format.nextStatus.active");
	if (status === "active") return t("format.nextStatus.console");
	return null;
}

export function phaseChatHint(
	phase: SessionPhase | null,
	role: "player" | "gm" = "player",
): string {
	const key = phase
		? `format.phaseHint.${role}.${phase}`
		: `format.phaseHint.${role}.default`;
	return translateOr(key, t("format.phaseHint.player.default"));
}
