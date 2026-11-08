import { coc7e } from "@cogm/shared";
import { Plus, XIcon } from "lucide-react";
import { useState } from "react";
import { NumericField } from "@/components/shared/creation-form";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";

const SLOT_MARKS = ["①", "②", "③", "④", "⑤", "⑥"] as const;

export interface Coc7eSpecialtyEntry {
	key: string;
	base: number;
}

export function SkillNameWithHint({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const description = coc7e.coc7eSkillDescription(name);
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						tabIndex={0}
						className={
							className ??
							"cursor-help truncate text-label-large-emph text-foreground underline decoration-dotted underline-offset-4"
						}
					>
						{name}
					</span>
				</TooltipTrigger>
				{description ? (
					<TooltipContent className="max-w-80 whitespace-pre-wrap">
						{description}
					</TooltipContent>
				) : null}
			</Tooltip>
		</TooltipProvider>
	);
}

function SlotInput({
	label,
	datalistId,
	suggestions,
	withPlaceholder,
	onAdd,
}: {
	label: string;
	datalistId: string;
	suggestions: readonly string[];
	withPlaceholder: boolean;
	onAdd: (name: string) => void;
}) {
	const [name, setName] = useState("");
	function submit() {
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		onAdd(trimmed);
		setName("");
	}
	return (
		<span className="border-md-outline flex items-center gap-1 rounded-full border border-dashed py-0.5 ps-3 pe-1">
			<span className="text-foreground-secondary text-label-large">
				{label}
			</span>
			<input
				list={datalistId}
				value={name}
				aria-label={`${label}名称`}
				placeholder={
					withPlaceholder ? t("characterCreation.specialtySlotPlaceholder") : ""
				}
				className="placeholder:text-foreground-tertiary h-8 w-32 bg-transparent text-label-large outline-none"
				onInput={(event) => setName(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						submit();
					}
				}}
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-6 rounded-full"
				aria-label={`添加${label}`}
				disabled={name.trim() === ""}
				onClick={submit}
			>
				<Plus className="size-3.5" />
			</Button>
		</span>
	);
}

export function Coc7eSpecialtySlotsSection({
	title,
	hint,
	family,
	slotsPrefix,
	entries,
	skills,
	suggestions,
	showValidation,
	onAddName,
	onRemoveKey,
	onSetValue,
	reportError,
}: {
	title: string;
	hint: string;
	family: string;
	slotsPrefix: string;
	entries: readonly Coc7eSpecialtyEntry[];
	skills: Record<string, number>;
	suggestions: readonly string[];
	showValidation: boolean;
	onAddName: (name: string) => void;
	onRemoveKey: (key: string) => void;
	onSetValue: (key: string, value: number) => void;
	reportError: (key: string, message: string | null) => void;
}) {
	const taken = entries.filter((entry) => skills[entry.key] !== undefined);
	const slotCount = Math.max(3, taken.length);
	const datalistId = `coc7e-specialty-${family}-suggestions`;
	return (
		<section
			aria-label={title}
			className="bg-md-surface-container flex flex-col gap-3 rounded-xl p-4"
		>
			<div className="flex flex-wrap items-baseline gap-2">
				<h3 className="text-label-large-emph text-foreground">{title}</h3>
				<span className="text-label-small text-foreground-tertiary">
					{hint}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{taken.map((entry) => {
					const current = skills[entry.key] ?? entry.base;
					return (
						<span
							key={entry.key}
							className="bg-md-secondary-container text-md-on-secondary-container flex items-center gap-2 rounded-full py-1 ps-3 pe-1.5"
						>
							<SkillNameWithHint name={entry.key} className="cursor-help text-label-large" />
							<NumericField
								label={t("characterCreation.skillValue", { name: entry.key })}
								hideLabel
								className="w-24"
								value={current}
								min={0}
								max={99}
								showValidation={showValidation}
								onErrorChange={(message) =>
									reportError(`${family}-${entry.key}`, message)
								}
								onChange={(value) => onSetValue(entry.key, value ?? current)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="size-6 rounded-full"
								aria-label={t("characterCreation.artRemove", {
									name: entry.key,
								})}
								onClick={() => onRemoveKey(entry.key)}
							>
								<XIcon className="size-3.5" />
							</Button>
						</span>
					);
				})}
				{Array.from({ length: slotCount - taken.length }, (_, index) => {
					const position = taken.length + index;
					return (
						<SlotInput
							key={`slot-${position}`}
							label={`${slotsPrefix}${SLOT_MARKS[position] ?? position + 1}`}
							datalistId={datalistId}
							suggestions={suggestions}
							withPlaceholder={position === 0}
							onAdd={onAddName}
						/>
					);
				})}
			</div>
			<datalist id={datalistId}>
				{suggestions.map((name) => (
					<option key={name} value={name} />
				))}
			</datalist>
		</section>
	);
}

export function Coc7eSpecialtyAddRow({
	group,
	onAdd,
}: {
	group: string;
	onAdd: (name: string) => void;
}) {
	const [name, setName] = useState("");
	function submit() {
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		onAdd(trimmed);
		setName("");
	}
	return (
		<div className="border-md-outline-variant/60 col-span-full flex items-center gap-2 rounded-xl border border-dashed px-3 py-2">
			<span className="text-foreground-secondary text-label-large">
				{t("characterCreation.customSpecialtyTitle", { group })}
			</span>
			<input
				value={name}
				aria-label={t("characterCreation.customSpecialtyInputLabel", {
					group,
				})}
				placeholder={t("characterCreation.specialtySlotPlaceholder")}
				className="placeholder:text-foreground-tertiary bg-field h-8 min-w-0 flex-1 rounded-full px-3 text-label-large outline-none"
				onInput={(event) => setName(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						submit();
					}
				}}
			/>
			<Button
				type="button"
				variant="tertiary"
				size="sm"
				aria-label={t("characterCreation.customSpecialtyAddLabel", { group })}
				disabled={name.trim() === ""}
				onClick={submit}
			>
				<Plus className="size-4" />
				{t("common.add")}
			</Button>
		</div>
	);
}
