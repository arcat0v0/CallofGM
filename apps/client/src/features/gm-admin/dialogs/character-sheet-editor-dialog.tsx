import type { CharacterDetailDto } from "@cogm/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { FALLBACK_RULE_ID, getRuleComponent } from "@/rules/registry";

const ATTRIBUTE_KEYS = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
] as const;

type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
type SkillEntry = { key: string; value: number };

const DEFAULT_ATTRIBUTES: Record<AttributeKey, number> = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 50,
	app: 50,
	int: 50,
	pow: 50,
	edu: 50,
	luck: 50,
};

function SheetAttributes({ sheet }: { sheet: unknown }) {
	return sheet;
}

function CharacterSheetEditorDialog({
	open,
	onOpenChange,
	characterId,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	characterId: string | null;
	onSaved?: () => void;
}) {
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"pc" | "npc">("pc");
	const [attributes, setAttributes] =
		useState<Record<AttributeKey, number>>(DEFAULT_ATTRIBUTES);
	const [skills, setSkills] = useState<SkillEntry[]>([]);
	const [customSkill, setCustomSkill] = useState("");
	const [ruleId, setRuleId] = useState(FALLBACK_RULE_ID);
	const rule = getRuleComponent(ruleId);

	useEffect(() => {
		if (!open || !characterId) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		void api<CharacterDetailDto>(
			`/gm/characters/${encodeURIComponent(characterId)}`,
		)
			.then((row) => {
				if (cancelled) {
					return;
				}
				const rowRule = getRuleComponent(row.ruleId);
				const sheet = rowRule.parseSheetJson(row.sheetJson);
				setRuleId(row.ruleId);
				setName(row.name);
				setKind(row.kind);
				setAttributes(
					sheet
						? { ...DEFAULT_ATTRIBUTES, ...rowRule.attributeValues(sheet) }
						: DEFAULT_ATTRIBUTES,
				);
				setSkills(sheet ? rowRule.skillEntries(sheet) : []);
				setCustomSkill("");
			})
			.catch((error) => {
				if (!cancelled) {
					toast.error(errorText(error, "gm.editSheet.loadFailed"));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open, characterId]);

	function setAttribute(key: AttributeKey, raw: string) {
		const value = Number.parseInt(raw, 10);
		setAttributes((current) => ({
			...current,
			[key]: Number.isNaN(value) ? 0 : value,
		}));
	}

	function setSkillValue(index: number, raw: string) {
		const value = Number.parseInt(raw, 10);
		setSkills((current) =>
			current.map((entry, entryIndex) =>
				entryIndex === index
					? { ...entry, value: Number.isNaN(value) ? 0 : value }
					: entry,
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
		setSkills((current) => [...current, { key: trimmed, value }]);
	}

	async function save() {
		if (!characterId || pending) {
			return;
		}
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error(t("gm.editSheet.nameRequired"));
			return;
		}
		for (const key of ATTRIBUTE_KEYS) {
			const value = attributes[key];
			const label = rule.attributeLabel(key) ?? key;
			if (!Number.isInteger(value) || value < 1 || value > 99) {
				toast.error(t("gm.editSheet.invalidAttribute", { name: label }));
				return;
			}
		}
		for (const skill of skills) {
			if (
				!Number.isInteger(skill.value) ||
				skill.value < 0 ||
				skill.value > 99
			) {
				toast.error(t("gm.editSheet.invalidSkill", { name: skill.key }));
				return;
			}
		}

		setPending(true);
		try {
			await api(`/gm/characters/${encodeURIComponent(characterId)}`, {
				method: "PATCH",
				body: JSON.stringify({
					name: trimmed,
					kind,
					sheetData: {
						schemaVersion: 1,
						attributes,
						skills: Object.fromEntries(
							skills.map((entry) => [entry.key, entry.value]),
						),
					},
				}),
			});
			toast.success(t("gm.editSheet.saved"));
			onOpenChange(false);
			onSaved?.();
		} catch (error) {
			toast.error(errorText(error, "gm.editSheet.saveFailed"));
		} finally {
			setPending(false);
		}
	}

	const catalog = rule.skillCatalog.filter(
		(skill) => !skills.some((entry) => entry.key === skill.key),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="border-separator-secondary/50 shrink-0 border-b px-6 pt-6 pb-4">
					<DialogTitle>{t("gm.editSheet.title")}</DialogTitle>
					<DialogDescription>{t("gm.editSheet.description")}</DialogDescription>
				</DialogHeader>

				{loading ? (
					<div className="flex min-h-56 items-center justify-center">
						<LoadingIndicator label={t("common.loading")} />
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<Label htmlFor="character-sheet-name">
									{t("gm.editSheet.name")}
								</Label>
								<Input
									id="character-sheet-name"
									value={name}
									maxLength={100}
									onChange={(event) => setName(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.editSheet.kind")}
								</span>
								<SegmentedControl
									value={kind}
									options={[
										{ value: "pc", label: t("common.pc") },
										{ value: "npc", label: t("common.npc") },
									]}
									onValueChange={(value) => setKind(value as "pc" | "npc")}
								/>
							</div>
						</div>

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
								{ATTRIBUTE_KEYS.map((key) => {
									const label = rule.attributePair(key);
									return (
										<label
											key={key}
											className="bg-md-surface-container-high border-field-border focus-within:border-field-border-focus focus-within:ring-focus-ring/35 flex flex-col gap-1 rounded-2xl border px-3 py-2.5 transition-[border-color,box-shadow] duration-200 focus-within:ring-4"
										>
											<span className="text-md-on-surface-variant text-label-small">
												{label?.label ?? key}
												<span className="text-md-outline ml-1.5 font-mono uppercase">
													{label?.abbr ?? key}
												</span>
											</span>
											<Input
												type="number"
												min={1}
												max={99}
												value={attributes[key]}
												aria-label={label?.label ?? key}
												className="text-md-on-surface h-8 border-0 bg-transparent px-0 font-mono text-title-large tabular-nums shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
												onChange={(event) =>
													setAttribute(key, event.target.value)
												}
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
												max={99}
												value={skill.value}
												aria-label={t("gm.editSheet.skillValueAria", {
													name: skill.key,
												})}
												className="h-8 w-16 border-0 bg-transparent px-0 text-right font-mono text-label-large tabular-nums shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
												onChange={(event) =>
													setSkillValue(index, event.target.value)
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className="text-md-on-surface-variant size-7 shrink-0"
												aria-label={t("gm.editSheet.removeSkill", {
													name: skill.key,
												})}
												onClick={() =>
													setSkills((current) =>
														current.filter(
															(_, entryIndex) => entryIndex !== index,
														),
													)
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
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-9"
										>
											<Plus className="size-4" />
											{t("gm.editSheet.addCatalogSkill")}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="max-h-72 w-64 overflow-y-auto"
									>
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
										onChange={(event) => setCustomSkill(event.target.value)}
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
				)}

				<DialogFooter className="border-separator-secondary/50 shrink-0 border-t px-6 py-4">
					<Button
						type="button"
						variant="tertiary"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={loading || pending}
						onClick={() => void save()}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { CharacterSheetEditorDialog };
