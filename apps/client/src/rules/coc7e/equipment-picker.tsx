import { coc7e } from "@cogm/shared";
import { BookOpen, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { SearchBar } from "@/components/ui/search";
import { t } from "@/i18n";

type WeaponDefinition = coc7e.Coc7eWeaponDefinition;
type ArmorDefinition = coc7e.Coc7eArmorDefinition;
type Era = coc7e.Coc7eEra;

const VISIBLE_LIMIT = 20;

export interface Coc7eWeaponPickerProps {
	era: Era;
	exclude?: readonly string[];
	onPick: (weapon: coc7e.Coc7eWeapon) => void;
	disabled?: boolean;
	className?: string;
}

export interface Coc7eArmorPickerProps {
	era: Era;
	onPick: (armor: coc7e.Coc7eArmor) => void;
	disabled?: boolean;
	className?: string;
}

function matchesWeapon(definition: WeaponDefinition, needle: string): boolean {
	if (needle === "") {
		return true;
	}
	return (
		definition.name.toLowerCase().includes(needle) ||
		definition.skillKey.toLowerCase().includes(needle) ||
		definition.damage.toLowerCase().includes(needle)
	);
}

function matchesArmor(definition: ArmorDefinition, needle: string): boolean {
	if (needle === "") {
		return true;
	}
	return (
		definition.name.toLowerCase().includes(needle) ||
		definition.locations.toLowerCase().includes(needle) ||
		String(definition.value).includes(needle)
	);
}

export function Coc7eWeaponPicker({
	era,
	exclude = [],
	onPick,
	disabled = false,
	className,
}: Coc7eWeaponPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const excludeKey = exclude.join("\u0000");

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const excluded = new Set(
			excludeKey === "" ? [] : excludeKey.split("\u0000"),
		);
		return coc7e
			.coc7eWeaponsForEra(era)
			.filter(
				(definition) =>
					!excluded.has(definition.name) && matchesWeapon(definition, needle),
			);
	}, [era, excludeKey, query]);

	const visible = filtered.slice(0, VISIBLE_LIMIT);

	function pick(definition: WeaponDefinition) {
		onPick(coc7e.coc7eWeaponFromCatalog(definition));
		setOpen(false);
		setQuery("");
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					aria-label={t("equipment.pickWeapon")}
					className={className}
				>
					<BookOpen className="size-4" />
					{t("equipment.pickWeapon")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-3 sm:w-96">
				<div className="flex flex-col gap-3">
					<SearchBar
						className="h-9"
						label={t("equipment.searchWeapon")}
						value={query}
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<div className="max-h-80 overflow-y-auto">
						{filtered.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small px-2 py-3 text-center">
								{t("equipment.noMatch")}
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{visible.map((definition) => (
									<li key={definition.name}>
										<button
											type="button"
											className="hover:bg-md-on-surface/5 focus-visible:bg-md-on-surface/5 flex w-full flex-col gap-1 rounded-lg p-2 text-left transition-colors outline-none"
											onClick={() => pick(definition)}
										>
											<div className="flex flex-wrap items-center gap-1.5">
												<span className="text-body-medium-emph text-foreground">
													{definition.name}
												</span>
												{definition.rare ? (
													<Badge variant="soft" tone="warning" size="sm">
														{t("equipment.rareTag")}
													</Badge>
												) : null}
												{definition.anachronistic ? (
													<Badge variant="soft" tone="default" size="sm">
														{t("equipment.anachronisticTag")}
													</Badge>
												) : null}
												{definition.impale ? (
													<Badge
														variant="tertiary"
														size="sm"
														className="text-foreground-secondary"
													>
														{t("equipment.weaponImpale")}
													</Badge>
												) : null}
												{definition.damageBonus === "half" ? (
													<Badge
														variant="tertiary"
														size="sm"
														className="text-foreground-secondary"
													>
														{t("equipment.halfDbTag")}
													</Badge>
												) : null}
												{definition.damageBonus === "full" ? (
													<Badge
														variant="tertiary"
														size="sm"
														className="text-foreground-secondary"
													>
														{t("equipment.fullDbTag")}
													</Badge>
												) : null}
											</div>
											<div className="text-foreground-secondary text-label-small flex flex-wrap items-center gap-x-2 gap-y-0.5">
												<span>{definition.skillKey}</span>
												<span className="font-mono">{definition.damage}</span>
												{definition.range ? (
													<span>
														{t("equipment.weaponRange", {
															range: definition.range,
														})}
													</span>
												) : null}
												{definition.ammo !== null ? (
													<span className="font-mono">
														{t("equipment.weaponAmmo", {
															ammo: definition.ammo,
														})}
													</span>
												) : null}
												{definition.malfunction !== null ? (
													<span className="font-mono">
														{t("equipment.weaponMalfunction", {
															malfunction: definition.malfunction,
														})}
													</span>
												) : null}
											</div>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
					{filtered.length > visible.length ? (
						<p className="text-foreground-tertiary text-label-small px-1">
							{t("equipment.truncated", {
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

export function Coc7eArmorPicker({
	era,
	onPick,
	disabled = false,
	className,
}: Coc7eArmorPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const list = coc7e.coc7eArmorForEra(era);
		const sorted = [...list].sort((a, b) => {
			if (a.official !== b.official) {
				return a.official ? -1 : 1;
			}
			return a.name.localeCompare(b.name, "zh-CN");
		});
		return sorted.filter((definition) => matchesArmor(definition, needle));
	}, [era, query]);

	const visible = filtered.slice(0, VISIBLE_LIMIT);

	function pick(definition: ArmorDefinition) {
		onPick(coc7e.coc7eArmorFromCatalog(definition));
		setOpen(false);
		setQuery("");
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					aria-label={t("equipment.pickArmor")}
					className={className}
				>
					<Shield className="size-4" />
					{t("equipment.pickArmor")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-3 sm:w-96">
				<div className="flex flex-col gap-3">
					<SearchBar
						className="h-9"
						label={t("equipment.searchArmor")}
						value={query}
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<div className="max-h-80 overflow-y-auto">
						{filtered.length === 0 ? (
							<p className="text-foreground-tertiary text-body-small px-2 py-3 text-center">
								{t("equipment.noMatch")}
							</p>
						) : (
							<ul className="flex flex-col gap-1">
								{visible.map((definition) => (
									<li key={definition.name}>
										<button
											type="button"
											className="hover:bg-md-on-surface/5 focus-visible:bg-md-on-surface/5 flex w-full flex-col gap-1 rounded-lg p-2 text-left transition-colors outline-none"
											onClick={() => pick(definition)}
										>
											<div className="flex flex-wrap items-center gap-1.5">
												<span className="text-body-medium-emph text-foreground">
													{definition.name}
												</span>
												{definition.official ? (
													<Badge variant="soft" tone="accent" size="sm">
														{t("equipment.officialTag")}
													</Badge>
												) : null}
											</div>
											<div className="text-foreground-secondary text-label-small flex flex-wrap items-center gap-x-2 gap-y-0.5">
												<span className="font-mono">
													{t("equipment.armorValue", {
														value: definition.value,
													})}
												</span>
												{definition.locations &&
												definition.locations !== "——" ? (
													<span>{definition.locations}</span>
												) : null}
												{definition.penalty > 0 ? (
													<span className="font-mono">
														{t("equipment.armorPenalty", {
															penalty: definition.penalty,
														})}
													</span>
												) : null}
											</div>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
					{filtered.length > visible.length ? (
						<p className="text-foreground-tertiary text-label-small px-1">
							{t("equipment.truncated", {
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
