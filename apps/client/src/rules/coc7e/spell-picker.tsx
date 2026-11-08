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

const VISIBLE_LIMIT = 60;

export function Coc7eSpellPicker({
	exclude = [],
	onPick,
	className,
}: {
	exclude?: readonly string[];
	onPick: (spell: coc7e.Coc7eSpellDefinition) => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const excludeKey = exclude.join("\u0000");

	const filtered = useMemo(() => {
		const excluded = new Set(
			excludeKey === "" ? [] : excludeKey.split("\u0000"),
		);
		const needle = query.trim().toLowerCase();
		return coc7e.COC7E_SPELLS.filter(
			(spell) =>
				!excluded.has(spell.name) &&
				(needle === "" ||
					spell.name.toLowerCase().includes(needle) ||
					spell.englishName.toLowerCase().includes(needle) ||
					spell.effect.toLowerCase().includes(needle)),
		);
	}, [excludeKey, query]);
	const visible = filtered.slice(0, VISIBLE_LIMIT);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn("h-9", className)}
				>
					{t("spellPicker.trigger")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[26rem] p-3">
				<div className="flex flex-col gap-3">
					<SearchBar
						className="h-9"
						label={t("spellPicker.search")}
						value={query}
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<div className="max-h-80 overflow-y-auto">
						{visible.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small px-1 py-2">
								{t("spellPicker.empty")}
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{visible.map((spell) => (
									<li key={spell.name}>
										<button
											type="button"
											className="hover:bg-md-on-surface/5 flex w-full flex-col gap-0.5 rounded-xl px-2 py-2 text-left"
											onClick={() => {
												onPick(spell);
												setOpen(false);
												setQuery("");
											}}
										>
											<span className="text-label-large-emph">
												{spell.name}
											</span>
											<span className="text-foreground-tertiary text-label-small">
												{[
													spell.mpCost
														? t("spellPicker.mp", { value: spell.mpCost })
														: "",
													spell.sanCost
														? t("spellPicker.san", { value: spell.sanCost })
														: "",
													spell.castingTime
														? t("spellPicker.time", {
																value: spell.castingTime,
															})
														: "",
												]
													.filter((part) => part !== "")
													.join(" · ")}
											</span>
											{spell.effect ? (
												<span className="text-foreground-secondary text-body-small">
													{spell.effect}
												</span>
											) : null}
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
					{filtered.length > visible.length ? (
						<p className="text-foreground-tertiary text-label-small">
							{t("spellPicker.truncated", {
								shown: visible.length,
								total: filtered.length,
							})}
						</p>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
