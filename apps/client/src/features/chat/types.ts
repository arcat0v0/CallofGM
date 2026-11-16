export type ChatRollView = {
	expression: string;
	total: number;
	dice: number[];
	modifier?: number;
	comment?: string;
};

export type ChatCheckOutcome =
	| "success"
	| "failure"
	| "critical"
	| "fumble";

export type ChatCheckSanView = {
	before: number;
	after: number;
	loss: number;
};

export type ChatCheckView = {
	skill: string;
	roll: number;
	target: number;
	difficulty: string;
	outcome: ChatCheckOutcome;
	label: string;
	san?: ChatCheckSanView;
};

export type ChatPhaseView = {
	label: string;
};

type ChatMessage = {
	id: string;
	sortKey: number;
	eventId?: number;
	anchorable?: boolean;
	activityType?: string;
	sealedActivityType?: string;
	roll?: ChatRollView;
	check?: ChatCheckView;
	phase?: ChatPhaseView;
	speakerName: string;
	speakerRoleLabel: string;
	expressionLabel?: string | null;
	avatarInitials: string;
	avatarBg: string;
	avatarFg: string;
	time: string;
	body: string;
	tone?: "ic" | "ooc";
	isSystem?: boolean;
	hidden?: boolean;
	gmVisible?: boolean;
	outcome?: "success" | "failure";
	pending?: boolean;
	rejected?: boolean;
	rejectionReason?: string | null;
};

export type { ChatMessage };
