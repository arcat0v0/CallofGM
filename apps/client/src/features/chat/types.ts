type ChatMessage = {
	id: string;
	sortKey: number;
	eventId?: number;
	anchorable?: boolean;
	activityType?: string;
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
	outcome?: "success" | "failure";
	pending?: boolean;
	rejected?: boolean;
	rejectionReason?: string | null;
};

export type { ChatMessage };
