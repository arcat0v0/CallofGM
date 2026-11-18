import { dnd5r } from "@cogm/shared";
import { Check, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { SearchBar } from "@/components/ui/search";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";

export type CatalogPickerItem = {
	id: string;
	name: string;
	meta: string;
	category?: string;
	disabled?: boolean;
	badge?: string;
};

export function DndCatalogPicker({
	legend,
	description,
	items,
	selectedIds,
	onToggle,
	searchLabel,
	categories,
	categoryLabel,
}: {
	legend: string;
	description: string;
	items: CatalogPickerItem[];
	selectedIds: string[];
	onToggle: (id: string) => void;
	searchLabel: string;
	categories?: { value: string; label: string }[];
	categoryLabel?: string;
}) {
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("all");
	const visible = useMemo(() => {
		const keyword = query.trim().toLocaleLowerCase();
		return items.filter(
			(item) =>
				(category === "all" || item.category === category) &&
				(!keyword ||
					`${item.name} ${item.meta} ${item.id}`
						.toLocaleLowerCase()
						.includes(keyword)),
		);
	}, [items, query, category]);

	return (
		<FieldSet className="gap-3">
			<FieldLegend>{legend}</FieldLegend>
			<FieldDescription>{description}</FieldDescription>
			<SearchBar
				label={searchLabel}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			{categories && categories.length > 0 ? (
				<Select value={category} onValueChange={setCategory}>
					<SelectTrigger aria-label={categoryLabel}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="popper">
						<SelectGroup>
							<SelectItem value="all">
								{t("dnd5r.catalog.allCategories")}
							</SelectItem>
							{categories.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : null}
			<p
				aria-live="polite"
				className="text-body-small text-foreground-secondary"
			>
				{t("dnd5r.catalog.results", {
					visible: visible.length,
					total: items.length,
					selected: selectedIds.length,
				})}
			</p>
			{visible.length === 0 ? (
				<p className="rounded-xl bg-md-surface-container px-4 py-6 text-center text-body-medium text-foreground-secondary">
					{t("dnd5r.catalog.empty")}
				</p>
			) : (
				<div className="grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
					{visible.map((item) => {
						const selected = selectedIds.includes(item.id);
						return (
							<button
								key={item.id}
								type="button"
								aria-pressed={selected}
								disabled={item.disabled}
								onClick={() => onToggle(item.id)}
								className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl bg-md-surface-container px-3 py-2 text-left outline-none transition-colors duration-200 ease-standard hover:bg-md-surface-container-high focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{selected ? (
									<Check
										aria-hidden="true"
										className="size-5 shrink-0 text-accent"
									/>
								) : null}
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate text-label-large-emph text-foreground">
										{item.name}
									</span>
									<span className="truncate text-body-small text-foreground-secondary">
										{item.meta}
									</span>
								</span>
								{selected || item.badge ? (
									<Badge
										variant="soft"
										tone={selected ? "accent" : "default"}
										size="sm"
									>
										{selected ? t("dnd5r.catalog.selected") : item.badge}
									</Badge>
								) : null}
							</button>
						);
					})}
				</div>
			)}
		</FieldSet>
	);
}

export function DndSourceCredit() {
	return (
		<Card variant="transparent" className="p-0">
			<CardHeader>
				<CardTitle>{t("dnd5r.source.title")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<p>{t("dnd5r.source.guide")}</p>
				<div className="flex flex-wrap gap-2">
					<a
						href="https://www.dndbeyond.com/sources/dnd/br-2024"
						target="_blank"
						rel="noreferrer"
						className="text-accent inline-flex min-h-11 items-center gap-1.5 rounded-md underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
					>
						{t("dnd5r.source.basicRules")}
						<ExternalLink aria-hidden="true" />
					</a>
					<a
						href={dnd5r.SRD_URL}
						target="_blank"
						rel="noreferrer"
						className="text-accent inline-flex min-h-11 items-center gap-1.5 rounded-md underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
					>
						{t("dnd5r.source.srd")}
						<ExternalLink aria-hidden="true" />
					</a>
				</div>
				<p className="text-body-small break-words">{dnd5r.SRD_ATTRIBUTION}</p>
			</CardContent>
		</Card>
	);
}
