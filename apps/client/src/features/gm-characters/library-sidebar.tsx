import type { GmCharacterLibraryFacets } from "@cogm/shared";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";

export type LibraryFolderState = {
	kind?: "pc" | "npc";
	owner?: "gm" | "pl";
	module?: string;
};

export type LibraryRuleOption = { id: string; count: number };

/** 规则切换：整页最强的层级，选中的规则与右侧列表连成一体 */
export function LibraryRuleSwitch({
	rules,
	activeRuleId,
	onSelect,
}: {
	rules: LibraryRuleOption[];
	activeRuleId: string;
	onSelect: (ruleId: string) => void;
}) {
	return (
		<nav aria-label={t("gm.library.rulesAria")} className="flex flex-col">
			{rules.map((rule) => {
				const component = getRuleComponent(rule.id);
				const active = rule.id === activeRuleId;
				return (
					<button
						key={rule.id}
						type="button"
						aria-current={active ? "true" : undefined}
						onClick={() => onSelect(rule.id)}
						className={cn(
							"group relative flex gap-3 border-b border-md-outline-variant/60 py-4 pr-4 pl-5 text-left outline-none transition-colors",
							"focus-visible:bg-md-surface-container focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
							active
								? "bg-md-surface-container-high"
								: "opacity-60 hover:bg-md-surface-container-lowest hover:opacity-100",
						)}
					>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="flex items-baseline justify-between gap-3">
								<span
									className={cn(
										"text-title-large-emph",
										active ? "text-md-on-surface" : "text-md-on-surface-variant",
									)}
								>
									{component.shortName}
								</span>
								<span
									className={cn(
										"text-label-large tabular-nums",
										active ? "text-accent" : "text-md-on-surface-variant",
									)}
								>
									{rule.count}
								</span>
							</span>
							<span className="truncate text-body-small text-md-on-surface-variant">
								{component.metadata.name}
							</span>
						</span>
					</button>
				);
			})}
		</nav>
	);
}

function FolderGroup({
	label,
	children,
}: {
	label?: string;
	children: ReactNode;
}) {
	return (
		<div role="group" aria-label={label} className="flex flex-col py-2">
			{label ? (
				<div className="px-5 pt-2 pb-1 text-label-medium text-md-on-surface-variant">
					{label}
				</div>
			) : null}
			{children}
		</div>
	);
}

function FolderItem({
	label,
	hint,
	count,
	active,
	onClick,
}: {
	label: string;
	hint?: string;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			title={hint}
			onClick={onClick}
			className={cn(
				"relative flex h-9 items-baseline gap-3 pt-2 pr-4 pl-5 text-left outline-none transition-colors",
				"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
				active
					? "bg-md-surface-container-high text-md-on-surface"
					: "text-md-on-surface-variant hover:bg-md-surface-container-lowest hover:text-md-on-surface",
				count === 0 && !active && "opacity-60",
			)}
		>
			<span
				aria-hidden
				className={cn(
					"absolute inset-y-1.5 left-0 w-[3px] rounded-r-full",
					active ? "bg-accent" : "bg-transparent",
				)}
			/>
			<span className="min-w-0 flex-1 truncate text-body-medium">{label}</span>
			<span className="text-label-large tabular-nums">{count}</span>
		</button>
	);
}

/** 当前规则下的筛选文件夹：类型 / 归属 / 模组，各组单选、组间叠加，计数为分面计数 */
export function LibraryFolders({
	facets,
	ruleTotal,
	state,
	onChange,
}: {
	facets: GmCharacterLibraryFacets | null;
	ruleTotal: number;
	state: LibraryFolderState;
	onChange: (next: LibraryFolderState) => void;
}) {
	const none = !state.kind && !state.owner && !state.module;
	const toggle = <K extends keyof LibraryFolderState>(
		key: K,
		value: LibraryFolderState[K],
	) => onChange({ ...state, [key]: state[key] === value ? undefined : value });
	return (
		<div aria-label={t("gm.library.foldersAria")} className="flex flex-col">
			<FolderGroup>
				<FolderItem
					label={t("gm.library.all")}
					count={ruleTotal}
					active={none}
					onClick={() => onChange({})}
				/>
			</FolderGroup>
			<FolderGroup label={t("gm.library.groupKind")}>
				<FolderItem
					label={t("gm.library.kindPc")}
					hint={t("gm.library.kindPcFull")}
					count={facets?.kinds.pc ?? 0}
					active={state.kind === "pc"}
					onClick={() => toggle("kind", "pc")}
				/>
				<FolderItem
					label={t("gm.library.kindNpc")}
					hint={t("gm.library.kindNpcFull")}
					count={facets?.kinds.npc ?? 0}
					active={state.kind === "npc"}
					onClick={() => toggle("kind", "npc")}
				/>
			</FolderGroup>
			<FolderGroup label={t("gm.library.groupOwner")}>
				<FolderItem
					label={t("gm.library.ownerMine")}
					count={facets?.owners.gm ?? 0}
					active={state.owner === "gm"}
					onClick={() => toggle("owner", "gm")}
				/>
				<FolderItem
					label={t("gm.library.ownerPlayers")}
					count={facets?.owners.pl ?? 0}
					active={state.owner === "pl"}
					onClick={() => toggle("owner", "pl")}
				/>
			</FolderGroup>
			<FolderGroup label={t("gm.library.groupModule")}>
				{(facets?.modules ?? []).map((module) => (
					<FolderItem
						key={module.id}
						label={module.name}
						count={module.count}
						active={state.module === module.id}
						onClick={() => toggle("module", module.id)}
					/>
				))}
				<FolderItem
					label={t("gm.library.unlinked")}
					count={facets?.unlinked ?? 0}
					active={state.module === "none"}
					onClick={() => toggle("module", "none")}
				/>
			</FolderGroup>
		</div>
	);
}
