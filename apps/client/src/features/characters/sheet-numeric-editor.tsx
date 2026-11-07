import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";

interface SheetNumericEditorProps {
	ruleId: string;
	attributes: Record<string, number>;
	skills: Array<{ key: string; value: number }>;
	onAttributesChange: (attrs: Record<string, number>) => void;
	onSkillsChange: (skills: Array<{ key: string; value: number }>) => void;
}

export function SheetNumericEditor({
	ruleId,
	attributes,
	skills,
	onAttributesChange,
	onSkillsChange,
}: SheetNumericEditorProps) {
	const [customSkill, setCustomSkill] = useState("");
	const rule = getRuleComponent(ruleId);
	const attributeKeys = rule.attributePairs().map((pair) => pair.key);

	function setAttribute(key: string, raw: string) {
		const value = Number.parseInt(raw, 10);
		onAttributesChange({
			...attributes,
			[key]: Number.isNaN(value) ? 0 : value,
		});
	}

	function setSkillValue(index: number, raw: string) {
		const value = Number.parseInt(raw, 10);
		onSkillsChange(
			skills.map((entry, i) =>
				i === index ? { ...entry, value: Number.isNaN(value) ? 0 : value } : entry,
			),
		);
	}

	function addSkill(key: string, value: number) {
		const trimmed = key.trim();
		if (!trimmed) {
			toast.error(t("gm.editSheet.skillRequired"));
			return;
		}
		if (skills.some((entry) => entry.key === trimmed)) {
			toast.error(t("gm.editSheet.skillExists", { name: trimmed }));
			return;
		}
		onSkillsChange([...skills, { key: trimmed, value }]);
	}

	const catalog = rule.skillCatalog.filter(
		(skill) => !skills.some((entry) => entry.key === skill.key),
	);

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between gap-3">
					<h3 className="text-md-on-surface font-sans text-title-medium-emph">
						{t("gm.editSheet.attributes")}
					</h3>
					<span className="text-md-on-surface-variant text-label-small">
						{t("gm.editSheet.attributeHint")}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					{attributeKeys.map((key) => {
						const pair = rule.attributePair(key);
						return (
							<label
								key={key}
								className="bg-md-surface-container-high border-field-border focus-within:border-field-border-focus focus-within:ring-focus-ring/35 flex flex-col gap-1 rounded-2xl border px-3 py-2.5 transition-[border-color,box-shadow] duration-200 focus-within:ring-4"
							>
								<span className="text-md-on-surface-variant text-label-small">
									{pair?.label ?? key}
									<span className="text-md-outline ml-1.5 font-mono uppercase">
										{pair?.abbr ?? key}
									</span>
								</span>
								<Input
									type="number"
									min={1}
									max={99}
									value={attributes[key] ?? 50}
									aria-label={pair?.label ?? key}
									className="text-md-on-surface h-8 border-0 bg-transparent px-0 font-mono text-title-large tabular-nums shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
									onInput={(event) => setAttribute(key, event.currentTarget.value)}
								/>
							</label>
						);
					})}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between gap-3">
					<h3 className="text-md-on-surface font-sans text-title-medium-emph">
						{t("gm.editSheet.skills")}
					</h3>
					<span className="text-md-on-surface-variant text-label-small">
						{t("gm.editSheet.skillCount", { count: skills.length })}
					</span>
				</div>
				{skills.length === 0 ? (
					<p className="text-md-on-surface-variant text-body-small">
						{t("gm.editSheet.noSkills")}
					</p>
				) : (
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{skills.map((skill, index) => (
							<div
								key={skill.key}
								className="bg-md-surface-container-high border-md-outline-variant/40 flex items-center gap-2 rounded-xl border px-3 py-1.5"
							>
								<span className="text-md-on-surface min-w-0 flex-1 truncate text-label-large">
									{skill.key}
								</span>
								<Input
									type="number"
									min={0}
									max={999}
									value={skill.value}
									aria-label={t("gm.editSheet.skillValueAria", { name: skill.key })}
									className="h-8 w-16 border-0 bg-transparent px-0 text-right font-mono text-label-large tabular-nums shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
									onInput={(event) => setSkillValue(index, event.currentTarget.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="text-md-on-surface-variant size-7 shrink-0"
									aria-label={t("gm.editSheet.removeSkill", { name: skill.key })}
									onClick={() =>
										onSkillsChange(skills.filter((_, i) => i !== index))
									}
								>
									<Trash2 className="size-3.5" />
								</Button>
							</div>
						))}
					</div>
				)}
				<div className="flex flex-wrap items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="sm" className="h-9">
								<Plus className="size-4" />
								{t("gm.editSheet.addCatalogSkill")}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
							{catalog.map((skill) => (
								<DropdownMenuItem
									key={skill.key}
									className="justify-between gap-3"
									onClick={() => addSkill(skill.key, skill.base)}
								>
									<span className="truncate">{skill.key}</span>
									<span className="text-md-on-surface-variant font-mono text-label-small">
										{skill.base}
									</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="flex min-w-48 flex-1 items-center gap-2">
						<Input
							value={customSkill}
							placeholder={t("gm.editSheet.customSkill")}
							aria-label={t("gm.editSheet.customSkill")}
							className="h-9"
							onInput={(event) => setCustomSkill(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									addSkill(customSkill, 0);
									setCustomSkill("");
								}
							}}
						/>
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest h-9"
							disabled={!customSkill.trim()}
							onClick={() => {
								addSkill(customSkill, 0);
								setCustomSkill("");
							}}
						>
							{t("gm.editSheet.add")}
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
