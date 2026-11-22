import type { GmCharacterLibraryFacets } from "@cogm/shared";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useRef, useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderGroup, FolderItem } from "@/features/gm-admin/library-navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";

export type LibraryFolderState = {
	kind?: "pc" | "npc";
	owner?: "gm" | "pl";
	module?: string;
};

export type LibraryRuleOption = { id: string; count: number };

/** 规则选择器：一个触发器 + 可搜索的弹层，规则再多也只占一行 */
export function LibraryRulePicker({
	rules,
	activeRuleId,
	onSelect,
	compact = false,
}: {
	rules: LibraryRuleOption[];
	activeRuleId: string;
	onSelect: (ruleId: string) => void;
	/** 移动端：单行触发器 */
	compact?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const listRef = useRef<HTMLDivElement>(null);
	const active = rules.find((rule) => rule.id === activeRuleId);
	const activeComponent = activeRuleId ? getRuleComponent(activeRuleId) : null;
	const searchable = rules.length > SEARCH_THRESHOLD;

	const needle = query.trim().toLowerCase();
	const matches = rules
		.map((rule) => ({ ...rule, component: getRuleComponent(rule.id) }))
		.filter(
			({ id, component }) =>
				!needle ||
				[id, component.shortName, component.metadata.name].some((text) =>
					text.toLowerCase().includes(needle),
				),
		);
	const used = matches
		.filter((rule) => rule.count > 0)
		.sort((a, b) => b.count - a.count);
	const unused = matches
		.filter((rule) => rule.count === 0)
		.sort((a, b) =>
			libraryRuleCollator.compare(a.component.shortName, b.component.shortName),
		);
	const showGroupLabels = used.length > 0 && unused.length > 0;

	const focusOption = (delta: number) => {
		const options = Array.from(
			listRef.current?.querySelectorAll<HTMLButtonElement>("[data-rule-option]") ??
				[],
		);
		if (options.length === 0) return;
		const index = options.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			index === -1
				? delta > 0
					? 0
					: options.length - 1
				: (index + delta + options.length) % options.length;
		options[next]?.focus();
	};

	const choose = (ruleId: string) => {
		setOpen(false);
		setQuery("");
		if (ruleId !== activeRuleId) onSelect(ruleId);
	};

	const renderOption = (rule: (typeof matches)[number]) => {
		const selected = rule.id === activeRuleId;
		return (
			<button
				key={rule.id}
				type="button"
				data-rule-option
				aria-current={selected ? "true" : undefined}
				onClick={() => choose(rule.id)}
				className={cn(
					"flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors duration-150 ease-standard-fast-effects motion-reduce:transition-none",
					selected ? "bg-accent-soft" : "hover:bg-md-surface-container-high",
					"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
				)}
			>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-title-small text-md-on-surface">
						{rule.component.shortName}
					</span>
					<span className="truncate text-body-small text-md-on-surface-variant">
						{rule.component.metadata.name}
					</span>
				</span>
				<span
					className={cn(
						"text-label-large tabular-nums",
						selected ? "text-accent" : "text-md-on-surface-variant",
					)}
				>
					{rule.count}
				</span>
				<Check
					aria-hidden
					className={cn("size-4 shrink-0 text-accent", !selected && "invisible")}
				/>
			</button>
		);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={t("gm.library.rulePickerAria", {
						rule: activeComponent?.shortName ?? "",
					})}
					className={cn(
						"group flex items-center gap-3 bg-md-surface-container text-left outline-none transition-colors duration-150 ease-standard-fast-effects hover:bg-md-surface-container-high data-[state=open]:bg-md-surface-container-high motion-reduce:transition-none",
						"focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
						compact ? "h-11 rounded-full px-4" : "w-full rounded-lg p-3",
					)}
				>
					{compact ? (
						<span className="flex min-w-0 flex-1 items-baseline gap-2">
							<span className="truncate text-title-small text-md-on-surface">
								{activeComponent?.shortName}
							</span>
							<span className="text-label-medium-emph tabular-nums text-accent">
								{active?.count ?? 0}
							</span>
						</span>
					) : (
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="text-label-medium text-md-on-surface-variant">
								{t("gm.library.rulesAria")}
							</span>
							<span className="flex items-baseline justify-between gap-3">
								<span className="truncate text-title-large-emph text-md-on-surface">
									{activeComponent?.shortName}
								</span>
								<span className="text-label-large tabular-nums text-accent">
									{active?.count ?? 0}
								</span>
							</span>
							<span className="truncate text-body-small text-md-on-surface-variant">
								{activeComponent?.metadata.name}
							</span>
						</span>
					)}
					<ChevronsUpDown
						aria-hidden
						className="size-4 shrink-0 text-md-on-surface-variant"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={6}
				className="flex w-(--radix-popover-trigger-width) min-w-72 flex-col gap-1 p-1.5"
				onOpenAutoFocus={(event) => {
					if (searchable) return;
					event.preventDefault();
					listRef.current
						?.querySelector<HTMLButtonElement>("[aria-current=true]")
						?.focus();
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						focusOption(1);
					} else if (event.key === "ArrowUp") {
						event.preventDefault();
						focusOption(-1);
					}
				}}
			>
				{searchable ? (
					<InputGroup className="h-9">
						<InputGroupAddon>
							<Search aria-hidden />
						</InputGroupAddon>
						<InputGroupInput
							value={query}
							type="search"
							onInput={(event) => setQuery(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && matches.length > 0) {
									event.preventDefault();
									choose((used[0] ?? unused[0])!.id);
								}
							}}
							placeholder={t("gm.library.ruleSearchPlaceholder")}
							aria-label={t("gm.library.ruleSearchPlaceholder")}
						/>
					</InputGroup>
				) : null}
				<div
					ref={listRef}
					role="group"
					aria-label={t("gm.library.rulesAria")}
					className="flex max-h-80 flex-col overflow-y-auto"
				>
					{matches.length === 0 ? (
						<p className="px-3 py-6 text-center text-body-medium text-md-on-surface-variant">
							{t("gm.library.ruleNoMatch")}
						</p>
					) : null}
					{showGroupLabels ? <RuleGroupLabel label={t("gm.library.ruleGroupUsed")} /> : null}
					{used.map(renderOption)}
					{showGroupLabels ? <RuleGroupLabel label={t("gm.library.ruleGroupEmpty")} /> : null}
					{unused.map(renderOption)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** 规则超过这个数量时，弹层顶部出现搜索框 */
const SEARCH_THRESHOLD = 6;
const libraryRuleCollator = new Intl.Collator("zh-Hans-CN-u-co-pinyin");

function RuleGroupLabel({ label }: { label: string }) {
	return (
		<div className="px-3 pt-2 pb-1 text-label-medium text-md-on-surface-variant">
			{label}
		</div>
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
		<nav aria-label={t("gm.library.foldersAria")} className="flex flex-col">
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
		</nav>
	);
}
