import { coc7e } from "@cogm/shared";
import { CheckIcon, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type Definition = coc7e.Coc7eOccupationDefinition;
type Era = coc7e.Coc7eEra;

const VISIBLE_LIMIT = 80;

function eraOf(definition: Definition): "any" | "classic" | "modern" {
	return definition.era;
}

function matchesEra(definition: Definition, era: Era): boolean {
	const value = eraOf(definition);
	if (value === "any") {
		return true;
	}
	return value === era;
}

function skillChips(definition: Definition) {
	const fixed = definition.fixedSkillKeys.map((key) => ({
		key,
		label: coc7e.coc7eSkillLabel(key),
		kind: "fixed" as const,
	}));
	const choices = definition.choiceGroups.flatMap((group) =>
		group.pool.map((key) => ({
			key: `${group.id}:${key}`,
			label: coc7e.coc7eSkillLabel(key),
			kind: "choice" as const,
		})),
	);
	return { fixed, choices };
}

function searchText(definition: Definition): string {
	const { fixed, choices } = skillChips(definition);
	return [
		definition.name,
		...fixed.map((entry) => entry.label),
		...choices.map((entry) => entry.label),
	]
		.join(" ")
		.toLowerCase();
}

export function Coc7eOccupationReferenceTable({
	attributes,
	selectedId,
	onSelect,
	className,
}: {
	attributes: Record<string, number>;
	selectedId: string | null;
	onSelect: (definition: Definition) => void;
	className?: string;
}) {
	const [query, setQuery] = useState("");
	const [eraFilter, setEraFilter] = useState<"all" | Era>("all");
	const [activeId, setActiveId] = useState<string | null>(selectedId);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return coc7e.COC7E_OCCUPATIONS.filter((definition) => {
			if (eraFilter !== "all" && !matchesEra(definition, eraFilter)) {
				return false;
			}
			if (needle === "") {
				return true;
			}
			return searchText(definition).includes(needle);
		});
	}, [eraFilter, query]);
	const visible = filtered.slice(0, VISIBLE_LIMIT);
	const active =
		coc7e.COC7E_OCCUPATIONS.find((item) => item.id === activeId) ??
		(filtered[0] as Definition | undefined);

	return (
		<div className={cn("flex min-w-0 flex-col gap-4", className)}>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<SearchBar
					className="lg:max-w-sm"
					label={t("occupation.searchPlaceholder")}
					value={query}
					onInput={(event) => setQuery(event.currentTarget.value)}
				/>
				<SegmentedControl
					value={eraFilter}
					onValueChange={setEraFilter}
					options={[
						{ value: "all", label: t("occupation.filterAll") },
						{
							value: "1920s",
							label: t("occupation.filterClassic"),
						},
						{ value: "modern", label: t("occupation.filterModern") },
					]}
				/>
				<span className="text-foreground-tertiary text-label-small lg:ml-auto">
					{t("occupation.resultCount", { count: filtered.length })}
				</span>
			</div>

			<Table className="min-w-[46rem]">
				<TableHeader>
					<TableRow className="border-separator-secondary/50 border-b">
						<TableHead className="w-[6.5rem]">
							{t("occupation.credit")}
						</TableHead>
						<TableHead className="min-w-[11rem]">
							{t("occupation.name")}
						</TableHead>
						<TableHead className="w-[11rem]">
							{t("occupation.attributes")}
						</TableHead>
						<TableHead className="w-[7rem] text-right">
							{t("occupation.skillPoints")}
						</TableHead>
						<TableHead>{t("occupation.skills")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visible.map((definition) => {
						const { fixed, choices } = skillChips(definition);
						const selected = definition.id === selectedId;
						return (
							<TableRow
								key={definition.id}
								aria-selected={selected}
								className={cn(
									"cursor-pointer border-separator-secondary/25 border-b align-top",
									selected
										? "bg-md-primary-container/60"
										: "hover:bg-md-on-surface/5",
								)}
								onClick={() => {
									setActiveId(definition.id);
									onSelect(definition);
								}}
							>
								<TableCell className="font-mono tabular-nums">
									{definition.creditMin}-{definition.creditMax}
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-1">
										<button
											type="button"
											className="text-body-medium-emph text-left"
											onClick={() => {
												setActiveId(definition.id);
												onSelect(definition);
											}}
										>
											{definition.name}
										</button>
										{definition.era === "modern" ? (
											<Badge variant="soft" tone="accent" size="sm">
												{t("occupation.modernTag")}
											</Badge>
										) : null}
									</div>
								</TableCell>
								<TableCell className="text-foreground-secondary">
									{coc7e.coc7eOccupationSkillPointOptionsLabel(definition)}
								</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{coc7e.coc7eOccupationSkillPointTotal(definition, attributes)}
								</TableCell>
								<TableCell>
									<div className="flex flex-wrap gap-1">
										{fixed.map((entry) => (
											<Badge
												key={entry.key}
												variant="soft"
												tone="accent"
												size="sm"
											>
												{entry.label}
											</Badge>
										))}
										{choices.map((entry) => (
											<Badge
												key={entry.key}
												variant="tertiary"
												size="sm"
												className="text-foreground-secondary"
											>
												{entry.label}
											</Badge>
										))}
										{definition.anySkillCount > 0 ? (
											<Badge variant="tertiary" size="sm">
												{t("occupation.anySkill", {
													count: definition.anySkillCount,
												})}
											</Badge>
										) : null}
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			{filtered.length > visible.length ? (
				<p className="text-foreground-tertiary text-label-small">
					{t("occupation.truncated", {
						shown: visible.length,
						total: filtered.length,
					})}
				</p>
			) : null}

			{active ? (
				<div className="bg-md-surface-container-high border-md-outline-variant/40 flex flex-col gap-3 rounded-2xl border p-4">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="font-sans text-title-medium-emph">{active.name}</h4>
						<Badge variant="soft" size="sm">
							{t("occupation.creditRange", {
								min: active.creditMin,
								max: active.creditMax,
							})}
						</Badge>
						<Badge variant="soft" tone="accent" size="sm">
							{coc7e.coc7eOccupationSkillPointOptionsLabel(active)}
						</Badge>
						<Badge variant="tertiary" size="sm">
							{t("occupation.pointsNow", {
								points: coc7e.coc7eOccupationSkillPointTotal(
									active,
									attributes,
								),
							})}
						</Badge>
						<Button
							type="button"
							variant={active.id === selectedId ? "tertiary" : "primary"}
							size="sm"
							className="ml-auto h-9"
							onClick={() => onSelect(active)}
						>
							{active.id === selectedId ? (
								<CheckIcon className="size-4" />
							) : (
								<Sparkles className="size-4" />
							)}
							{active.id === selectedId
								? t("occupation.selected")
								: t("occupation.use")}
						</Button>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-foreground-tertiary text-label-medium">
							{t("occupation.skillBreakdown")}
						</span>
						<div className="flex flex-wrap gap-1.5">
							{active.fixedSkillKeys.map((key) => (
								<Badge key={key} variant="soft" tone="accent" size="md">
									{coc7e.coc7eSkillLabel(key)}
								</Badge>
							))}
							{active.choiceGroups.map((group) => (
								<Badge
									key={group.id}
									variant="tertiary"
									size="md"
									className="text-foreground-secondary"
								>
									{t("occupation.chooseFrom", {
										count: group.choose,
										pool: group.pool
											.map((key) => coc7e.coc7eSkillLabel(key))
											.join("/"),
									})}
								</Badge>
							))}
							{active.anySkillCount > 0 ? (
								<Badge variant="tertiary" size="md">
									{t("occupation.anySkill", {
										count: active.anySkillCount,
									})}
								</Badge>
							) : null}
						</div>
					</div>
				</div>
			) : (
				<p className="text-foreground-tertiary text-body-medium">
					{t("occupation.empty")}
				</p>
			)}
		</div>
	);
}
