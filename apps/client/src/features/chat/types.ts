export type ChatRollView = {
	expression: string;
	total: number;
	dice: number[];
	modifier?: number;
	comment?: string;
};

export type ChatCheckOutcome = "success" | "failure" | "critical" | "fumble";

export type ChatCheckSanView = {
	before: number;
	after: number;
	loss: number;
};

export type ChatCheckView = {
	skill: string;
	skillKey?: string;
	characterId?: string;
	baseTarget?: number;
	skillNote?: string;
	roll: number;
	target: number;
	difficulty: string;
	difficultyKey?: "regular" | "hard" | "extreme";
	outcomeKey?: string;
	outcome: ChatCheckOutcome;
	label: string;
	san?: ChatCheckSanView;
	luckSpent?: number;
	originalRoll?: number;
	luckBefore?: number;
	luckAfter?: number;
	pushed?: boolean;
	diceModifier?: {
		kind: "bonus" | "penalty";
		count: number;
		candidates: number[];
		picked: number;
	};
	d20?: {
		kind: string;
		mode: string;
		rolls: number[];
		modifier: number;
		total: number;
		dc: number | null;
		damage?: {
			type: string;
			rolls: number[];
			sides: number;
			modifier: number;
			total: number;
		};
	};
};

export type ChatPhaseView = {
	label: string;
};

type ChatMessage = {
	id: string;
	sortKey: number;
	eventId?: number;
	characterId?: string;
	anchorable?: boolean;
	activityType?: string;
	ruleId?: string;
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
