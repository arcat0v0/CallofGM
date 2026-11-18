import {
	type ChatMessageDto,
	DiceSealedEvent,
	type DiceSealedEvent as DiceSealedEventPayload,
	type HistoryItem,
	RewindEvent,
	SessionPhase,
	SessionPhaseLabel,
	type SnapshotCharacter,
} from "@cogm/shared";
import type {
	ChatCheckOutcome,
	ChatMessage,
	ChatRollView,
} from "@/features/chat/types";
import { t } from "@/i18n";
import { checkDiceModifier } from "@/lib/check-dice";
import { expressionLabel, formatClock, initialsOf } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";

function diceRollView(result: Record<string, unknown>): ChatRollView {
	const expression =
		typeof result.expression === "string"
			? result.expression
			: t("message.diceFallback");
	const total =
		typeof result.total === "number" && Number.isFinite(result.total)
			? result.total
			: 0;
	const dice = Array.isArray(result.rolls)
		? result.rolls.filter(
				(value): value is number =>
					typeof value === "number" && Number.isFinite(value),
			)
		: [];
	const modifierMatch = /([+-]\d+)$/.exec(expression);
	const modifier = modifierMatch
		? Number.parseInt(modifierMatch[1] ?? "0", 10)
		: undefined;
	const comment =
		typeof result.comment === "string" && result.comment
			? result.comment
			: undefined;
	return {
		expression,
		total,
		dice,
		...(modifier !== undefined && Number.isFinite(modifier)
			? { modifier }
			: {}),
		...(comment ? { comment } : {}),
	};
}

function stampOutcome(
	outcome: string,
	success: boolean | null,
): ChatCheckOutcome {
	if (outcome === "critical" || outcome === "fumble") {
		return outcome;
	}
	return success === false ? "failure" : "success";
}

export function obSpeakerLabel(playerId: string | null | undefined): string {
	return playerId
		? t("chat.obWithId", { id: playerId.slice(0, 6) })
		: t("common.spectator");
}

export function speakerNameOf(dto: ChatMessageDto): string {
	if (dto.senderType === "gm") {
		return dto.characterName || t("chat.role.gm");
	}
	if (dto.characterName) {
		return dto.characterName;
	}
	return obSpeakerLabel(dto.senderId);
}

export function speakerInitialsOf(dto: ChatMessageDto): string {
	if (dto.senderType === "gm") {
		return dto.characterName
			? initialsOf(dto.characterName)
			: initialsOf(t("chat.role.gm"));
	}
	return dto.characterName
		? initialsOf(dto.characterName)
		: t("chat.obInitial");
}

export function speakerRoleLabelOf(dto: ChatMessageDto): string {
	if (dto.senderType === "gm") {
		if (dto.characterName) {
			return t("common.npc");
		}
		return dto.channel === "ooc" ? t("chat.ooc") : "";
	}
	if (!dto.characterName) {
		return t("common.spectator");
	}
	return dto.channel === "ooc" ? t("chat.role.ooc") : t("chat.role.pc");
}

export function mapChatMessage(dto: ChatMessageDto): ChatMessage {
	const isGmNarration = dto.senderType === "gm" && !dto.characterName;
	const speakerName = speakerNameOf(dto);
	return {
		id: dto.id,
		sortKey: dto.eventId ?? dto.createdAt,
		eventId: dto.eventId ?? undefined,
		anchorable: dto.eventId != null,
		speakerName,
		speakerRoleLabel: speakerRoleLabelOf(dto),
		expressionLabel: dto.expressionKey
			? expressionLabel(dto.expressionKey)
			: null,
		avatarInitials: speakerInitialsOf(dto),
		avatarBg: isGmNarration ? "bg-accent" : "bg-default",
		avatarFg: isGmNarration ? "text-accent-foreground" : "text-foreground",
		time: formatClock(dto.presentedAt ?? dto.createdAt),
		body: dto.content,
		tone: dto.channel === "ooc" ? "ooc" : "ic",
		isSystem: false,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function mapSealedDiceEvent(
	payload: DiceSealedEventPayload,
	eventId: number,
	occurredAt?: number,
): ChatMessage {
	const time = formatClock(occurredAt ?? Date.now());
	const name = t("common.gmShort");
	return {
		id: `sealed-${eventId}`,
		sortKey: eventId,
		eventId,
		anchorable: true,
		activityType: "dice:sealed",
		sealedActivityType: payload.activityType,
		speakerName: name,
		speakerRoleLabel: t("chat.role.dice"),
		avatarInitials: initialsOf(name),
		avatarBg: "bg-default",
		avatarFg: "text-foreground",
		time,
		body: `${name}${t("message.diceHidden")}`,
		tone: "ooc",
		isSystem: true,
		hidden: true,
		gmVisible: false,
	};
}

export function resolveActivityPayload(
	type: string,
	payload: Record<string, unknown>,
	characters: SnapshotCharacter[],
): Record<string, unknown> {
	if (type === "dice:sealed") {
		return payload;
	}
	if (type !== "dice:rolled" || payload.rollerType !== "player") {
		return payload;
	}
	if (payload.characterName) {
		return payload;
	}
	const byCharacter =
		typeof payload.characterId === "string"
			? characters.find(
					(character) => character.characterId === payload.characterId,
				)
			: undefined;
	if (byCharacter) {
		return { ...payload, characterName: byCharacter.name };
	}
	if (typeof payload.rollerId !== "string") {
		return payload;
	}
	const roller = characters.find(
		(character) => character.claim?.holderId === payload.rollerId,
	);
	return roller ? { ...payload, characterName: roller.name } : payload;
}

export function mapActivityEvent(
	type: string,
	payload: unknown,
	eventId: number,
	occurredAt?: number,
	characters: SnapshotCharacter[] = [],
	viewer: { isGm?: boolean } = {},
): ChatMessage | null {
	if (type === "dice:sealed" && isRecord(payload)) {
		const parsed = DiceSealedEvent.safeParse(payload);
		return parsed.success
			? mapSealedDiceEvent(parsed.data, eventId, occurredAt)
			: null;
	}
	if (!isRecord(payload)) {
		return null;
	}
	const time = formatClock(occurredAt ?? Date.now());
	const characterOf = (characterId: unknown): SnapshotCharacter | undefined =>
		characters.find((character) => character.characterId === characterId);
	const characterNameOf = (characterId: unknown): string =>
		characterOf(characterId)?.name ?? t("chat.role.character");
	const systemMessage = (
		speakerName: string,
		body: string,
		anchorable: boolean,
	): ChatMessage => ({
		id: `${type}-${eventId}`,
		sortKey: eventId,
		eventId,
		anchorable,
		activityType: type,
		speakerName,
		speakerRoleLabel: t("history.event.role"),
		avatarInitials: initialsOf(speakerName),
		avatarBg: "bg-default",
		avatarFg: "text-foreground",
		time,
		body,
		tone: "ooc",
		isSystem: true,
	});
	if (type === "dice:rolled") {
		const result = isRecord(payload.result) ? payload.result : {};
		const hidden = payload.hidden === true;
		const gmVisible = payload.gmVisible === true || viewer.isGm === true;
		const name =
			typeof payload.characterName === "string" && payload.characterName
				? payload.characterName
				: payload.rollerType === "gm"
					? t("common.gmShort")
					: obSpeakerLabel(
							typeof payload.rollerId === "string" ? payload.rollerId : null,
						);
		const expression =
			typeof result.expression === "string"
				? result.expression
				: t("message.diceFallback");
		const total = result.total;
		const detail = typeof result.detail === "string" ? result.detail : "";
		const comment =
			typeof result.comment === "string" ? ` · ${result.comment}` : "";
		const hiddenSuffix = hidden ? t("message.diceHidden") : "";
		const roll = diceRollView(result);
		return {
			id: `dice-${eventId}`,
			sortKey: eventId,
			eventId,
			anchorable: true,
			activityType: type,
			speakerName: name,
			speakerRoleLabel: t("chat.role.dice"),
			avatarInitials: initialsOf(name),
			avatarBg: "bg-default",
			avatarFg: "text-foreground",
			time,
			body: hidden
				? `${name}${hiddenSuffix}`
				: `${expression} = ${String(total)}${detail ? `（${detail}）` : ""}${comment}`,
			tone: "ooc",
			isSystem: true,
			hidden,
			...(hidden && !gmVisible
				? {}
				: { roll, gmVisible: !hidden || gmVisible }),
		};
	}
	if (type === "check:resolved" || type === "check:amended") {
		const amendedFrom =
			type === "check:amended" && typeof payload.amendsEventId === "number"
				? payload.amendsEventId
				: null;
		const checkEventId = amendedFrom ?? eventId;
		const result = isRecord(payload.result) ? payload.result : {};
		const hidden = payload.hidden === true;
		const gmVisible = payload.gmVisible === true || viewer.isGm === true;
		const name =
			typeof payload.characterName === "string"
				? payload.characterName
				: t("chat.role.character");
		const skillKey =
			typeof payload.skillKey === "string" ? payload.skillKey : "";
		const rule = getRuleComponent(
			typeof result.ruleId === "string"
				? result.ruleId
				: characterOf(payload.characterId)?.ruleId,
		);
		const skill =
			skillKey === "luck"
				? t("chat.destinyCheck")
				: skillKey
					? rule.skillLabel(skillKey)
					: t("chat.role.check");
		const hiddenSuffix = hidden ? t("message.diceHidden") : "";
		const success = typeof result.success === "boolean" ? result.success : null;
		const outcome = typeof result.outcome === "string" ? result.outcome : "";
		const stamp = stampOutcome(outcome, success);
		const label = outcome
			? rule.outcomeLabel(outcome)
			: success === true
				? t("message.outcome.success")
				: t("message.outcome.failure");
		if (skillKey === "san") {
			const roll = result.roll;
			const loss = result.loss;
			const after = result.sanAfter;
			const before = result.sanBefore;
			const rollValue = typeof roll === "number" ? roll : 0;
			const afterValue = typeof after === "number" ? after : 0;
			const lossValue = typeof loss === "number" ? loss : 0;
			const beforeValue =
				typeof before === "number" ? before : afterValue + lossValue;
			const ok =
				success === true
					? t("message.outcome.success")
					: t("message.outcome.failure");
			return {
				id: `check-${checkEventId}`,
				sortKey: checkEventId,
				eventId,
				anchorable: true,
				activityType: type,
				characterId:
					typeof payload.characterId === "string"
						? payload.characterId
						: undefined,
				speakerName: name,
				speakerRoleLabel: t("chat.role.san"),
				avatarInitials: initialsOf(name),
				avatarBg: "bg-default",
				avatarFg: "text-foreground",
				time,
				body: hidden
					? `${name} · ${skill}${hiddenSuffix}`
					: t("message.sanCheck", {
							roll: String(rollValue),
							outcome: ok,
							loss: String(lossValue),
							after: String(afterValue),
						}),
				tone: "ooc",
				isSystem: true,
				hidden,
				gmVisible: !hidden || gmVisible,
				outcome: success === null ? undefined : success ? "success" : "failure",
				...(hidden && !gmVisible
					? {}
					: {
							check: {
								skill,
								roll: rollValue,
								target: beforeValue,
								difficulty: "regular",
								outcome: stamp,
								label,
								san: {
									before: beforeValue,
									after: afterValue,
									loss: lossValue,
								},
							},
						}),
			};
		}
		const d20 = rule.parseD20Check?.(result);
		if (d20) {
			const mode = rule.d20ModeLabel?.(d20.mode) ?? d20.mode;
			const modifier = `${d20.modifier >= 0 ? "+" : ""}${d20.modifier}`;
			const dc = d20.dc === null ? "" : ` · DC ${d20.dc}`;
			const damage = d20.damage
				? ` · ${t("chat.d20Damage", { total: d20.damage.total, type: rule.damageTypeLabel?.(d20.damage.type) ?? d20.damage.type })}`
				: "";
			return {
				id: `check-${checkEventId}`,
				sortKey: checkEventId,
				eventId,
				anchorable: true,
				activityType: type,
				characterId:
					typeof payload.characterId === "string"
						? payload.characterId
						: undefined,
				speakerName: name,
				speakerRoleLabel: t("chat.role.check"),
				avatarInitials: initialsOf(name),
				avatarBg: "bg-default",
				avatarFg: "text-foreground",
				time,
				body: hidden
					? `${name} · ${skill}${hiddenSuffix}`
					: `${skill} · ${d20.total} (${d20.rolls.join("/")}${modifier})${dc} · ${label}${damage}`,
				tone: "ooc",
				isSystem: true,
				hidden,
				gmVisible: !hidden || gmVisible,
				outcome: success === null ? undefined : success ? "success" : "failure",
				...(hidden && !gmVisible
					? {}
					: {
							check: {
								skill,
								skillKey,
								characterId:
									typeof payload.characterId === "string"
										? payload.characterId
										: undefined,
								roll: d20.roll,
								target: d20.dc ?? 0,
								difficulty: mode,
								outcomeKey: outcome,
								outcome: stamp,
								label,
								d20,
							},
						}),
			};
		}
		const roll = result.roll;
		const target = result.targetValue;
		const difficulty = rule.parseDifficulty(result.difficulty) ?? "regular";
		const context =
			typeof target === "number"
				? difficulty === "regular"
					? t("message.checkTarget", { target })
					: t("message.checkThreshold", {
							target,
							label: rule.difficultyLabel(difficulty),
							threshold: rule.difficultyThreshold(target, difficulty) ?? target,
						})
				: null;
		const targetValue = typeof target === "number" ? target : 0;
		const threshold =
			rule.difficultyThreshold(targetValue, difficulty) ?? targetValue;
		const luckSpent =
			typeof result.luckSpent === "number" ? result.luckSpent : undefined;
		const originalRoll =
			typeof result.originalRoll === "number" ? result.originalRoll : undefined;
		const luckBefore =
			typeof result.luckBefore === "number" ? result.luckBefore : undefined;
		const luckAfter =
			typeof result.luckAfter === "number" ? result.luckAfter : undefined;
		return {
			id: `check-${checkEventId}`,
			sortKey: checkEventId,
			eventId,
			anchorable: true,
			activityType: type,
			characterId:
				typeof payload.characterId === "string"
					? payload.characterId
					: undefined,
			speakerName: name,
			speakerRoleLabel: t("chat.role.check"),
			avatarInitials: initialsOf(name),
			avatarBg: "bg-default",
			avatarFg: "text-foreground",
			time,
			body: hidden
				? `${name} · ${skill}${hiddenSuffix}`
				: `${skill} ${String(roll)}/${String(target)} · ${label}${context ? `（${context}）` : ""}`,
			tone: "ooc",
			isSystem: true,
			hidden,
			gmVisible: !hidden || gmVisible,
			outcome: success === null ? undefined : success ? "success" : "failure",
			...(hidden && !gmVisible
				? {}
				: {
						check: {
							skill,
							skillKey,
							characterId:
								typeof payload.characterId === "string"
									? payload.characterId
									: undefined,
							baseTarget: targetValue,
							skillNote:
								skillKey === "luck"
									? t("chat.luckCheckValue", {
											roll: String(roll ?? 0),
											target: String(targetValue),
										})
									: undefined,
							roll: typeof roll === "number" ? roll : 0,
							target: threshold,
							difficulty: rule.difficultyLabel(difficulty),
							difficultyKey: difficulty as "regular" | "hard" | "extreme",
							outcomeKey: outcome,
							outcome: stamp,
							label,
							luckSpent,
							originalRoll,
							luckBefore,
							luckAfter,
							pushed: result.pushed === true,
							diceModifier: checkDiceModifier(result) ?? undefined,
						},
					}),
		};
	}
	if (type === "luck:recovered") {
		const name =
			typeof payload.characterName === "string" && payload.characterName
				? payload.characterName
				: characterNameOf(payload.characterId);
		const roll = typeof payload.roll === "number" ? payload.roll : 0;
		const before =
			typeof payload.luckBefore === "number" ? payload.luckBefore : 0;
		const after =
			typeof payload.luckAfter === "number" ? payload.luckAfter : before;
		const gain = typeof payload.gain === "number" ? payload.gain : 0;
		return systemMessage(
			name,
			gain > 0
				? t("message.luckRecovered", {
						roll: String(roll),
						before: String(before),
						gain: String(gain),
						after: String(after),
					})
				: t("message.luckRecoveryNoGain", {
						roll: String(roll),
						before: String(before),
					}),
			true,
		);
	}
	if (type === "session:phase-changed") {
		const phase = SessionPhase.safeParse(payload.phase);
		return phase.success
			? {
					...systemMessage(
						t("history.event.phase"),
						SessionPhaseLabel[phase.data],
						true,
					),
					phase: { label: SessionPhaseLabel[phase.data] },
				}
			: null;
	}
	if (type === "scene:changed") {
		const name = typeof payload.name === "string" ? payload.name : "";
		return systemMessage(t("history.event.scene"), name, true);
	}
	if (type === "expression:changed") {
		if (typeof payload.messageId === "string") {
			return null;
		}
		const expressionKey =
			typeof payload.expressionKey === "string" ? payload.expressionKey : "";
		const characterName = characterNameOf(payload.characterId);
		const label =
			characterOf(payload.characterId)?.portraits?.find(
				(portrait) => portrait.expressionKey === expressionKey,
			)?.label ?? null;
		return systemMessage(
			characterName,
			t("history.event.expression", {
				expression: expressionLabel(expressionKey || null, label),
			}),
			true,
		);
	}
	if (type === "handout:granted") {
		const grant = isRecord(payload.grant) ? payload.grant : payload;
		const handout = isRecord(grant.handout) ? grant.handout : {};
		const title =
			typeof handout.title === "string" && handout.title
				? handout.title
				: t("history.event.handout");
		return systemMessage(t("history.event.handout"), title, true);
	}
	if (type === "state:changed") {
		const characterName = characterNameOf(payload.characterId);
		const rule = getRuleComponent(characterOf(payload.characterId)?.ruleId);
		const body = rule.stateSummary(payload.state) ?? t("history.event.state");
		return systemMessage(characterName, body, true);
	}
	if (type === "session:rewound") {
		const rewind = RewindEvent.safeParse(payload);
		if (!rewind.success) {
			return null;
		}
		const body =
			rewind.data.action === "undo"
				? t("history.event.undoBody")
				: t("history.event.rewindBody", {
						time: formatClock(rewind.data.anchorOccurredAt),
					});
		return systemMessage(t("history.event.rewind"), body, false);
	}
	return null;
}

export function mapHistoryItem(
	item: HistoryItem,
	characters: SnapshotCharacter[],
	viewer: { isGm?: boolean } = {},
): ChatMessage | null {
	if (item.kind === "chat") {
		return {
			...mapChatMessage(item.message),
			eventId: item.eventId,
			anchorable: true,
		};
	}
	const payload = isRecord(item.payload)
		? resolveActivityPayload(item.type, item.payload, characters)
		: item.payload;
	return mapActivityEvent(
		item.type,
		payload,
		item.eventId,
		item.occurredAt,
		characters,
		viewer,
	);
}
