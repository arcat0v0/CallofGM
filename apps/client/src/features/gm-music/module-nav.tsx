import { ChevronsUpDown, Search } from "lucide-react";
import { useRef, useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { ALL_MODULES, filterModulesByQuery } from "./music-library-model";

export type MusicModuleOption = { id: string; name: string; count: number };

type ModuleNavProps = {
	modules: readonly MusicModuleOption[];
	totalCount: number;
	activeId: string;
	onSelect: (id: string) => void;
};

/** 模组超过这个数量时出现搜索框，模组再多也只是一个可滚动、可搜索的列表。 */
const SEARCH_THRESHOLD = 6;

function ModuleOptionButton({
	label,
	count,
	selected,
	onClick,
}: {
	label: string;
	count: number;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			data-module-option
			aria-current={selected ? "true" : undefined}
			onClick={onClick}
			className={cn(
				"flex h-10 w-full shrink-0 items-center gap-3 rounded-sm px-3 text-left text-body-large outline-none transition-colors",
				"hover:bg-md-surface-container-high focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
				selected
					? "bg-md-surface-container-high text-md-on-surface"
					: "text-md-on-surface-variant",
			)}
		>
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<span
				className={cn(
					"font-mono text-label-large tabular-nums",
					selected ? "text-md-on-surface" : "text-md-on-surface-variant",
				)}
			>
				{count}
			</span>
		</button>
	);
}

function ModuleOptions({
	modules,
	totalCount,
	activeId,
	onSelect,
	autoFocusSearch = false,
}: ModuleNavProps & { autoFocusSearch?: boolean }) {
	const [query, setQuery] = useState("");
	const listRef = useRef<HTMLDivElement>(null);
	const searchable = modules.length > SEARCH_THRESHOLD;
	const matches = filterModulesByQuery(modules, searchable ? query : "");

	const focusOption = (delta: number) => {
		const options = Array.from(
			listRef.current?.querySelectorAll<HTMLButtonElement>(
				"[data-module-option]",
			) ?? [],
		);
		if (options.length === 0) {
			return;
		}
		const index = options.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			index === -1
				? delta > 0
					? 0
					: options.length - 1
				: (index + delta + options.length) % options.length;
		options[next]?.focus();
	};

	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-1"
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
				<InputGroup className="mx-1 h-9 w-auto">
					<InputGroupAddon>
						<Search aria-hidden />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						value={query}
						autoFocus={autoFocusSearch}
						onInput={(event) => setQuery(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && matches[0]) {
								event.preventDefault();
								onSelect(matches[0].id);
							}
						}}
						placeholder={t("gm.music.moduleSearchPlaceholder")}
						aria-label={t("gm.music.moduleSearchPlaceholder")}
					/>
				</InputGroup>
			) : null}
			<div
				ref={listRef}
				role="group"
				aria-label={t("gm.music.modulesLabel")}
				className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-4"
			>
				{query.trim() === "" ? (
					<>
						<ModuleOptionButton
							label={t("gm.music.allTracks")}
							count={totalCount}
							selected={activeId === ALL_MODULES}
							onClick={() => onSelect(ALL_MODULES)}
						/>
						<div
							aria-hidden
							className="mx-3 my-1.5 h-px shrink-0 bg-md-outline-variant/60"
						/>
					</>
				) : null}
				{matches.map((module) => (
					<ModuleOptionButton
						key={module.id}
						label={module.name}
						count={module.count}
						selected={activeId === module.id}
						onClick={() => onSelect(module.id)}
					/>
				))}
				{matches.length === 0 ? (
					<p className="px-3 py-6 text-center text-body-medium text-md-on-surface-variant">
						{t("gm.music.moduleSearchEmpty")}
					</p>
				) : null}
			</div>
		</div>
	);
}

/** 桌面端左栏。 */
export function ModuleNav(props: ModuleNavProps) {
	return (
		<nav
			aria-label={t("gm.music.modulesLabel")}
			className="flex min-h-0 flex-1 flex-col gap-2 pt-5"
		>
			<p
				aria-hidden
				className="px-4 text-label-medium tracking-widest text-md-on-surface-variant"
			>
				{t("gm.music.modulesLabel")}
			</p>
			<ModuleOptions {...props} />
		</nav>
	);
}

/** 移动端：单行触发器 + 可搜索弹层。 */
export function ModulePicker(props: ModuleNavProps) {
	const [open, setOpen] = useState(false);
	const activeName =
		props.activeId === ALL_MODULES
			? t("gm.music.allTracks")
			: (props.modules.find((module) => module.id === props.activeId)?.name ??
				"");
	const activeCount =
		props.activeId === ALL_MODULES
			? props.totalCount
			: (props.modules.find((module) => module.id === props.activeId)?.count ??
				0);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-11 w-full items-center gap-3 rounded-md border border-md-outline-variant bg-md-surface-container-low px-3 text-left outline-none transition-colors hover:bg-md-surface-container focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
				>
					<span className="text-label-medium tracking-widest text-md-on-surface-variant">
						{t("gm.music.modulesLabel")}
					</span>
					<span className="min-w-0 flex-1 truncate text-title-small text-md-on-surface">
						{activeName}
					</span>
					<span className="font-mono text-label-large tabular-nums text-md-on-surface-variant">
						{activeCount}
					</span>
					<ChevronsUpDown
						aria-hidden
						className="size-4 shrink-0 text-md-on-surface-variant"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={6}
				className="flex max-h-[min(24rem,70dvh)] w-(--radix-popover-trigger-width) min-w-64 flex-col p-1.5"
			>
				<ModuleOptions
					{...props}
					autoFocusSearch
					onSelect={(id) => {
						setOpen(false);
						props.onSelect(id);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
