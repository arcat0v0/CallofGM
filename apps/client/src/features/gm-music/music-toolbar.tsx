import type { TrackDto } from "@cogm/shared";
import { Repeat, Search, Trash2, X, Zap } from "lucide-react";
import type { RefObject } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import type { TrackSort, TrackTypeFilter } from "./music-library-model";

const SORT_KEYS: Record<TrackSort, string> = {
	added: "gm.music.sortAdded",
	name: "gm.music.sortName",
	duration: "gm.music.sortDuration",
};

export function MusicToolbar({
	visible,
	query,
	onQueryChange,
	type,
	onTypeChange,
	sort,
	onSortChange,
	selectedCount,
	onClearSelection,
	onBulkRetype,
	onBulkDelete,
	searchRef,
}: {
	/** 曲目为空时整条工具栏留白占位，页面不会因此跳动 */
	visible: boolean;
	query: string;
	onQueryChange: (query: string) => void;
	type: TrackTypeFilter;
	onTypeChange: (type: TrackTypeFilter) => void;
	sort: TrackSort;
	onSortChange: (sort: TrackSort) => void;
	selectedCount: number;
	onClearSelection: () => void;
	onBulkRetype: (type: TrackDto["type"]) => void;
	onBulkDelete: () => void;
	searchRef: RefObject<HTMLInputElement | null>;
}) {
	if (selectedCount > 0) {
		return (
			<div>
				<div
					role="toolbar"
					className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-3xl bg-md-surface-container-high py-1 pr-2 pl-1 sm:flex-nowrap sm:rounded-full"
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("gm.music.bulkClearAria")}
						onClick={onClearSelection}
					>
						<X />
					</Button>
					<span className="min-w-0 flex-1 whitespace-nowrap text-label-large tabular-nums text-md-on-surface">
						{t("gm.music.selectedCount", { count: selectedCount })}
					</span>
					<div className="flex w-full items-center gap-1 pb-1 sm:w-auto sm:pb-0">
						<Button
							type="button"
							variant="tertiary"
							size="xs"
							className="px-3 sm:px-4 max-sm:[&_svg]:hidden"
							onClick={() => onBulkRetype("bgm")}
						>
							<Repeat />
							{t("gm.music.bulkToBgm")}
						</Button>
						<Button
							type="button"
							variant="tertiary"
							size="xs"
							className="px-3 sm:px-4 max-sm:[&_svg]:hidden"
							onClick={() => onBulkRetype("se")}
						>
							<Zap />
							{t("gm.music.bulkToSe")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="xs"
							className="ml-auto px-3 text-danger sm:ml-0 sm:px-4 max-sm:[&_svg]:hidden"
							onClick={onBulkDelete}
						>
							<Trash2 />
							{t("gm.music.bulkDelete")}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-11">
			{visible ? (
				<div className="flex flex-wrap items-center gap-2">
					<InputGroup className="h-10 min-w-0 flex-1 basis-full rounded-full border-transparent bg-md-surface-container max-lg:h-11 sm:basis-auto sm:max-w-md">
						<InputGroupAddon>
							<Search aria-hidden />
						</InputGroupAddon>
						<InputGroupInput
							ref={searchRef}
							type="search"
							value={query}
							onInput={(event) => onQueryChange(event.currentTarget.value)}
							placeholder={t("gm.music.searchPlaceholder")}
							aria-label={t("gm.music.searchAria")}
						/>
						<InputGroupAddon className="hidden lg:flex">
							<kbd className="rounded-sm bg-md-surface-container-high px-2 font-mono text-label-small text-md-on-surface-variant">
								/
							</kbd>
						</InputGroupAddon>
					</InputGroup>
					<SegmentedControl
						value={type}
						aria-label={t("gm.music.typeFilterAria")}
						onValueChange={onTypeChange}
						className="min-w-0 max-lg:flex-1"
						options={[
							{ value: "all", label: t("gm.music.typeAll") },
							{ value: "bgm", label: t("gm.music.bgm") },
							{ value: "se", label: t("gm.music.se") },
						]}
					/>
					<Select
						value={sort}
						onValueChange={(value) => onSortChange(value as TrackSort)}
					>
						<SelectTrigger
							aria-label={`${t("gm.music.sortAria")}：${t(SORT_KEYS[sort])}`}
							className="h-10 w-auto shrink-0 rounded-full px-4 max-lg:h-11"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{(Object.keys(SORT_KEYS) as TrackSort[]).map((key) => (
								<SelectItem key={key} value={key}>
									{t(SORT_KEYS[key])}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}
		</div>
	);
}
