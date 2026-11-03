import type { SessionPhase, SessionStatus } from "@cogm/shared";
import { t } from "@/i18n";

export function sessionStatusLabel(status: SessionStatus): string {
	return t(`status.${status}`);
}

export function sessionPhaseLabel(phase: SessionPhase): string {
	return t(`phase.${phase}`);
}
