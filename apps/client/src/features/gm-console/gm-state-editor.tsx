import type { SnapshotCharacter } from "@cogm/shared";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { parseCocState } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { getRuleComponent } from "@/rules/registry";
import { GmPanelShell } from "./gm-panel-fields";

type StatKey = "hp" | "mp" | "san";

const STATS: Array<{
	key: StatKey;
	maxKey: "maxHp" | "maxMp" | "maxSan";
	label: string;
}> = [
	{ key: "hp", maxKey: "maxHp", label: "HP" },
	{ key: "mp", maxKey: "maxMp", label: "MP" },
	{ key: "san", maxKey: "maxSan", label: "SAN" },
];

function clampNumber(
	value: string,
	min: number,
	max: number,
	fallback: number,
): number {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, parsed));
}

function GmStateEditor({
	character,
	open,
	onOpenChange,
}: {
	character: SnapshotCharacter | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const rule = getRuleComponent(character?.ruleId);
	const state = parseCocState(character?.state, character?.ruleId);
	const [values, setValues] = useState<Record<string, string>>({});
	const [delta, setDelta] = useState("1");
	const [tag, setTag] = useState("");

	useEffect(() => {
		if (!open) {
			return;
		}
		const next = parseCocState(character?.state, character?.ruleId);
		setValues(
			next
				? {
						hp: String(next.hp),
						maxHp: String(next.maxHp),
						mp: String(next.mp),
						maxMp: String(next.maxMp),
						san: String(next.san),
						maxSan: String(next.maxSan),
					}
				: {},
		);
		setDelta("1");
		setTag("");
	}, [open, character?.state]);

	function send(payload: Record<string, unknown>) {
		if (!character) {
			return;
		}
		const sent = sendSessionCommand("state:edit", {
			characterId: character.characterId,
			...payload,
		});
		if (!sent) {
			toast.error(t("chat.notConnected"));
		}
	}

	function applyValues() {
		if (!character) {
			return;
		}
		send({
			hp: clampNumber(values.hp ?? "", 0, 99, state?.hp ?? 0),
			maxHp: clampNumber(values.maxHp ?? "", 1, 99, state?.maxHp ?? 1),
			mp: clampNumber(values.mp ?? "", 0, 99, state?.mp ?? 0),
			maxMp: clampNumber(values.maxMp ?? "", 0, 99, state?.maxMp ?? 0),
			san: clampNumber(values.san ?? "", 0, 99, state?.san ?? 0),
			maxSan: clampNumber(values.maxSan ?? "", 0, 99, state?.maxSan ?? 0),
		});
	}

	function applyDelta(stat: StatKey) {
		const amount = Number.parseInt(delta, 10);
		if (Number.isNaN(amount) || amount === 0) {
			return;
		}
		send({ [`${stat}Delta`]: amount });
	}

	function toggleStatus(flag: string, on: boolean) {
		send(on ? { removeStatuses: [flag] } : { addStatuses: [flag] });
	}

	function addTag() {
		const next = tag.trim();
		if (!next) {
			return;
		}
		send({ addTags: [next] });
		setTag("");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="border-0! bg-transparent! p-0! shadow-none! rounded-none! w-auto! max-w-none!"
			>
				<GmPanelShell
					title={
						character
							? `${character.name} · ${t("gm.workbench.editState")}`
							: t("gm.workbench.editState")
					}
					subtitle={t("gm.workbench.stateScope")}
					onClose={() => onOpenChange(false)}
					className="max-h-[calc(100dvh-48px)] shadow-modal"
					footer={
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="tertiary"
								className="h-10"
								onClick={() => onOpenChange(false)}
							>
								{t("common.close")}
							</Button>
							<Button
								type="button"
								variant="primary"
								className="h-10 px-4"
								disabled={!character}
								onClick={applyValues}
							>
								{t("gm.workbench.applyValues")}
							</Button>
						</div>
					}
				>
					{!character ? (
						<p className="text-md-on-surface-variant text-body-medium">
							{t("gm.console.noTarget")}
						</p>
					) : (
						<div className="flex flex-col gap-4">
							<div className="grid grid-cols-3 gap-2.5">
								{STATS.map((stat) => (
									<div
										key={stat.key}
										className="bg-md-surface-container-high border-field-border focus-within:border-field-border-focus focus-within:ring-focus-ring/35 flex flex-col gap-2 rounded-lg border p-3 shadow-[inset_0_1px_0_#ffffff0a] transition-[border-color,box-shadow] duration-200 ease-standard-fast-effects focus-within:ring-4"
									>
										<span className="text-md-on-surface-variant text-label-medium-emph">
											{stat.label}
										</span>
										<div className="flex items-center gap-1">
											<Input
												value={values[stat.key] ?? ""}
												inputMode="numeric"
												aria-label={`${stat.label} ${t("gm.workbench.currentValue")}`}
												className="h-8 rounded-none border-0 bg-transparent px-1 py-0 text-label-large hover:bg-transparent focus-visible:ring-0"
												autoFocus={stat.key === "hp"}
												onChange={(event) =>
													setValues((current) => ({
														...current,
														[stat.key]: event.target.value,
													}))
												}
											/>
											<span className="text-md-on-surface-variant/60">/</span>
											<Input
												value={values[stat.maxKey] ?? ""}
												inputMode="numeric"
												aria-label={`${stat.label} ${t("gm.workbench.maxValue")}`}
												className="h-8 rounded-none border-0 bg-transparent px-1 py-0 text-label-large hover:bg-transparent focus-visible:ring-0"
												onChange={(event) =>
													setValues((current) => ({
														...current,
														[stat.maxKey]: event.target.value,
													}))
												}
											/>
										</div>
									</div>
								))}
							</div>

							<div className="flex flex-col gap-2">
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.workbench.deltaHint")}
								</span>
								<div className="flex items-center gap-2">
									<Input
										value={delta}
										inputMode="numeric"
										aria-label={t("gm.console.stateDelta")}
										className="h-10 w-24"
										onChange={(event) => setDelta(event.target.value)}
									/>
									{STATS.map((stat) => (
										<Button
											key={stat.key}
											type="button"
											variant="tertiary"
											size="sm"
											className="h-10 flex-1 gap-1.5"
											onClick={() => applyDelta(stat.key)}
										>
											± {stat.label}
										</Button>
									))}
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<span className="text-md-on-surface-variant text-label-medium-emph">
									{t("gm.workbench.statusFlags")}
								</span>
								<div className="flex flex-wrap gap-1.5">
									{rule.statusOptions().map(({ value: flag, label }) => {
										const on = Boolean(
											state?.statuses.some((item) => item === flag),
										);
										return (
											<Button
												key={flag}
												type="button"
												size="sm"
												variant={on ? "dangerSoft" : "tertiary"}
												className={cn(
													"h-8 gap-1.5",
													on
														? "border-danger/30 border"
														: "border-md-outline-variant/50 border",
												)}
												aria-pressed={on}
												onClick={() => toggleStatus(flag, on)}
											>
												{on ? <Check className="size-3" /> : null}
												{label}
											</Button>
										);
									})}
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<span className="text-md-on-surface-variant text-label-medium-emph">
									{t("gm.workbench.tags")}
								</span>
								{state && state.tags.length > 0 ? (
									<div className="flex flex-wrap gap-1.5">
										{state.tags.map((item) => (
											<Button
												key={item}
												type="button"
												size="sm"
												variant="tertiary"
												className="h-8"
												onClick={() => send({ removeTags: [item] })}
											>
												{item} ×
											</Button>
										))}
									</div>
								) : (
									<p className="text-md-on-surface-variant/75 text-label-small">
										{t("gm.workbench.noTags")}
									</p>
								)}
								<div className="flex gap-1.5">
									<Input
										value={tag}
										placeholder={t("gm.console.tagPlaceholder")}
										className="h-10"
										onChange={(event) => setTag(event.target.value)}
									/>
									<Button
										type="button"
										variant="tertiary"
										size="sm"
										className="h-10"
										onClick={addTag}
									>
										{t("gm.console.addTag")}
									</Button>
								</div>
							</div>

							{state &&
							(state.growthMarks.length > 0 ||
								state.hiddenGrowthMarks.length > 0) ? (
								<p className="text-md-on-surface-variant text-label-small">
									{t("gm.console.growth", {
										marks: [
											...state.growthMarks,
											...state.hiddenGrowthMarks.map((mark) =>
												t("gm.console.hiddenGrowth", { mark }),
											),
										].join(t("common.listSeparator")),
									})}
								</p>
							) : null}
						</div>
					)}
				</GmPanelShell>
			</DialogContent>
		</Dialog>
	);
}

export { GmStateEditor };
