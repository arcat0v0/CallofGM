import { coc7e } from "@cogm/shared";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { SearchBar } from "@/components/ui/search";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export interface Coc7eSkillPickerOption {
	key: string;
	label: string;
	base: number;
	group?: string;
}

export function coc7eCatalogOptions(
	family?: string,
	exclude: readonly string[] = [],
): Coc7eSkillPickerOption[] {
	const excluded = new Set(exclude);
	return coc7e.COC7E_SKILL_CATALOG.filter(
		(skill) =>
			skill.key !== "克苏鲁神话" &&
			skill.key !== "信用评级" &&
			(!family || coc7e.coc7eSkillFamily(skill.key) === family),
	)
		.filter((skill) => !excluded.has(skill.key))
		.map((skill) => ({
			key: skill.key,
			label: skill.key,
			base: skill.base,
			...(skill.group ? { group: skill.group } : {}),
		}));
}

export function Coc7eSkillPicker({
	options,
	exclude = [],
	onPick,
	triggerLabel,
	title,
	className,
}: {
	options?: readonly Coc7eSkillPickerOption[];
	exclude?: readonly string[];
	onPick: (key: string, base: number) => void;
	triggerLabel: string;
	title?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [custom, setCustom] = useState("");
	const excludeKey = exclude.join("\u0000");
	const filtered = useMemo(() => {
		const excluded = new Set(
			excludeKey === "" ? [] : excludeKey.split("\u0000"),
		);
		const source = options ?? coc7eCatalogOptions();
		const needle = query.trim().toLowerCase();
		return source.filter(
			(option) =>
				!excluded.has(option.key) &&
				(needle === "" || option.label.toLowerCase().includes(needle)),
		);
	}, [excludeKey, options, query]);

	function pick(key: string, base: number) {
		onPick(key, base);
		setOpen(false);
		setQuery("");
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					className={cn(
						"border-md-outline text-foreground-secondary h-8 rounded-full border border-dashed px-3 text-label-large",
						className,
					)}
				>
					{triggerLabel}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-3">
				<div className="flex flex-col gap-3">
					<SearchBar
						className="h-9"
						label={title ?? t("occupation.pickSkill")}
						value={query}
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<div className="max-h-64 overflow-y-auto">
						{filtered.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small px-1 py-2">
								{t("occupation.noSkillMatch")}
							</p>
						) : (
							<ul className="flex flex-col">
								{filtered.map((option) => (
									<li key={option.key}>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-full justify-between gap-3 px-2"
											onClick={() => pick(option.key, option.base)}
										>
											<span className="truncate">{option.label}</span>
											<span className="text-foreground-tertiary font-mono text-label-small">
												{option.base}
											</span>
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>
					<div className="border-separator-secondary/50 flex items-center gap-2 border-t pt-3">
						<input
							value={custom}
							placeholder={t("occupation.customSkillPlaceholder")}
							aria-label={t("occupation.customSkillPlaceholder")}
							className="border-field-border bg-field text-body-small h-9 min-w-0 flex-1 rounded-full border px-3 outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
							onInput={(event) => setCustom(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && custom.trim() !== "") {
									event.preventDefault();
									pick(custom.trim(), 0);
									setCustom("");
								}
							}}
						/>
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="h-9"
							disabled={custom.trim() === ""}
							onClick={() => {
								pick(custom.trim(), 0);
								setCustom("");
							}}
						>
							{t("common.add")}
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
