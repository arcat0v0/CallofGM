import type {
	CharacterCreationRollDto,
	CharacterHistoryResponse,
	CharacterSheetContextResponse,
	CheckRequestDto,
	RuleMetadata,
	SnapshotCharacter,
} from "@cogm/shared";
import type { ComponentType, ReactNode } from "react";
import type { ChatCheckView } from "@/features/chat/types";
import type { DiceAnimationRequest } from "@/features/dice-animation/model";

/** 提交链接上设定了车卡属性生成方式时，由车卡页传给规则编辑器的服务端掷骰上下文 */
export type RuleCreationRollContext = {
	options: unknown;
	roll: CharacterCreationRollDto | null;
	pending: boolean;
	/** 发起唯一一次掷骰（服务端生成） */
	onRoll: () => Promise<CharacterCreationRollDto | null>;
	/** 选定一套结果，选定后不可更改 */
	onChoose: (index: number) => Promise<CharacterCreationRollDto | null>;
};

export type RuleCreationOptionsEditorProps = {
	value: unknown | null;
	onChange: (value: unknown | null) => void;
	disabled?: boolean;
};

export type RuleCreationReviewProps = {
	roll: CharacterCreationRollDto;
	submittedSheet: unknown | null;
};

export type RuleCreationEditorProps = {
	creation?: RuleCreationRollContext | null;
	sheet: unknown;
	onChange: (sheet: unknown) => void;
	showValidation: boolean;
	onValidityChange: (valid: boolean) => void;
	onWarningsChange?: (count: number) => void;
	characterName?: string;
	onCharacterNameChange?: (name: string) => void;
	background?: string;
	onBackgroundChange?: (background: string) => void;
	portraitPreviewUrl?: string | null;
	portraitPending?: boolean;
	onPickPortraitFile?: (file: File) => void;
	onClearPendingPortrait?: () => void;
	onManageExpressions?: () => void;
	sheetContext?: CharacterSheetContextResponse | null;
	onSubmitAction?: () => void;
	submitLabel?: string;
	submitPending?: boolean;
	identityHeaderSlot?: ReactNode;
	children?: ReactNode;
};

export type RuleBackgroundSource = "profile" | "sheet";

export type RuleStateBar = {
	key: string;
	label: string;
	current: number;
	max: number;
	barClassName: string;
};

export type RuleSummaryMetric = {
	key: string;
	label: string;
	value: string;
	tone?: "default";
};
export type RuleSheetOverview = { label: string; value: string };

export type RuleSheetViewerProps = {
	sheet: unknown;
	background: string;
	sheetContext?: CharacterSheetContextResponse | null;
	history?: CharacterHistoryResponse | null;
};

export type RuleSessionSheetProps = {
	target: SnapshotCharacter;
	characters: SnapshotCharacter[];
	isGm: boolean;
	canPerform: boolean;
	ruleState: unknown;
	search: string;
	onSearchChange: (search: string) => void;
	onPerform: (skillKey: string, options?: unknown, label?: string) => void;
};

export type RuleDiceTrayProps = {
	active: boolean;
	character?: SnapshotCharacter;
	characterId?: string | null;
	characters: SnapshotCharacter[];
	gm: boolean;
	disabled: boolean;
	hidden: boolean;
	onHiddenChange: (hidden: boolean) => void;
	ruleState: unknown;
	onSubmitted?: () => void;
	onError: (message: string) => void;
};

export type RuleCheckPanelProps = {
	characters: SnapshotCharacter[];
	ruleState: unknown;
	onClose: () => void;
};

export type RuleStateEditorProps = {
	character: SnapshotCharacter;
	onClose: () => void;
};

export type RuleCheckEvent = {
	skillKey: string;
	characterId?: string;
	result: Record<string, unknown>;
};

export type RuleCheckEventView = {
	check: ChatCheckView;
	summaryText: string;
	roleLabel: string;
};

export type RuleCheckDiceAnimation =
	| Omit<
			Extract<DiceAnimationRequest, { kind: "roll" }>,
			"id" | "eventId" | "skin"
	  >
	| Omit<
			Extract<DiceAnimationRequest, { kind: "check" }>,
			"id" | "eventId" | "skin"
	  >;

export type RuleCheckCardProps = {
	check: ChatCheckView;
	speakerName: string;
	time: string;
	eventId?: number;
	className?: string;
	luckCharacter?: SnapshotCharacter;
};

export type LuckSpendOption = {
	points: number;
	outcome: string;
	label: string;
	success: boolean;
};

export type RuleComponent = {
	metadata: RuleMetadata;
	/** 界面用短名（如 “CoC 7e”），用于规则切换等紧凑位置 */
	shortName: string;
	createEmptySheet: () => unknown;
	creationEditor: (props: RuleCreationEditorProps) => ReactNode;
	sheetViewer: ComponentType<RuleSheetViewerProps>;
	creationTitle?: () => string;
	backgroundSource: RuleBackgroundSource;
	parseSheet: (value: unknown) => unknown | null;
	parseSheetJson: (json: string) => unknown | null;
	skillLabel: (key: string) => string;
	attributeEntries: (
		sheet: unknown,
	) => Array<{ key: string; label: string; value: number }>;
	attributeLabel: (key: string) => string | null;
	attributePair: (
		key: string,
	) => { key: string; label: string; abbr: string } | null;
	skillEntries: (sheet: unknown) => Array<{ key: string; value: number }>;
	summaryMetrics: (sheet: unknown) => RuleSummaryMetric[];
	sheetOverview: (sheet: unknown) => RuleSheetOverview[];
	stateSummary: (state: unknown) => string | null;
	statusLabelsOfState: (state: unknown) => string[];
	stateBars: (state: unknown) => RuleStateBar[];
	publicStateOptions: () => Array<{ value: string; label: string }>;
	stateFieldLabel: (key: string) => string;
	stateHealthScore: (state: unknown) => number;
	gmStateSummaryLines: (state: unknown) => string[];
	sessionSheet: ComponentType<RuleSessionSheetProps>;
	diceTray: ComponentType<RuleDiceTrayProps>;
	checkPanel: ComponentType<RuleCheckPanelProps>;
	stateEditor: ComponentType<RuleStateEditorProps>;
	formatCheckRequest: (request: CheckRequestDto) => string;
	formatCheckEvent: (event: RuleCheckEvent) => RuleCheckEventView;
	buildCheckDiceAnimation: (
		result: Record<string, unknown>,
	) => RuleCheckDiceAnimation | null;
	renderCheckCardExtra?: ComponentType<RuleCheckCardProps>;
	capabilities?: {
		luck?: {
			readCurrent: (state: unknown) => number | null;
			spendOptions: (check: unknown, current: number) => LuckSpendOption[];
			recover: (characterId: string) => boolean;
			formatRecovery: (payload: Record<string, unknown>) => string;
		};
		excelImport?: {
			previewAttributes: (
				sheet: unknown,
			) => Array<{ label: string; value: number }>;
		};
		sheetBackground?: {
			/** 以结构化 UI 渲染规则专属背景字段，替代纯文本摘要拼接 */
			renderSummary: ComponentType<{ sheet: unknown }>;
			/** 剥离旧版自动拼接的摘要文本，保留玩家独立书写的详细背景描述 */
			extractDetailedBackground?: (
				sheet: unknown,
				rawBackground: string,
			) => string;
		};
		/** 车卡属性生成方式（GM 在提交链接上设定，服务端掷骰） */
		characterCreation?: {
			optionsEditor: ComponentType<RuleCreationOptionsEditorProps>;
			describeOptions: (options: unknown) => string | null;
			reviewSummary: ComponentType<RuleCreationReviewProps>;
		};
	};
};
