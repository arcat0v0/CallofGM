import { useState } from "react";
import {
	DICE_SKIN_OPTIONS,
	type DiceSkinOption,
} from "@/features/dice-skin/dice-skin-preview";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type DiceSkinSelectorProps = {
	value: "olive" | "bone";
	onValueChange: (value: "olive" | "bone") => void;
	className?: string;
	disabled?: boolean;
};

function DiceSkinOptionCard({
	option,
	selected,
	disabled,
	onSelect,
}: {
	option: DiceSkinOption;
	selected: boolean;
	disabled?: boolean;
	onSelect: () => void;
}) {
	const [previewFailed, setPreviewFailed] = useState(false);
	return (
		<label
			aria-label={t(option.labelKey)}
			className={cn(
				"group relative min-w-0 overflow-hidden rounded-xl border text-left transition-colors",
				selected
					? "border-accent bg-accent-soft"
					: "border-separator-secondary bg-surface-tertiary hover:bg-md-surface-container-high",
			)}
		>
			<input
				type="radio"
				name="dice-skin"
				value={option.id}
				checked={selected}
				disabled={disabled}
				onChange={onSelect}
				className="sr-only"
			/>
			<img
				src={previewFailed ? DICE_SKIN_OPTIONS[0]?.preview : option.preview}
				alt=""
				aria-hidden="true"
				className="aspect-[16/9] w-full bg-md-surface-container-low object-cover"
				onError={(event) => {
					if (!previewFailed && option.id !== "olive") {
						event.currentTarget.src = "/dice/previews/olive-d20.webp";
					}
					setPreviewFailed(true);
				}}
			/>
			<span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
				<span className="text-foreground font-sans text-label-large-emph">
					{t(option.labelKey)}
				</span>
				<span className="text-md-on-surface-variant text-label-small">
					{previewFailed ? t(option.fallbackKey) : t(option.descriptionKey)}
				</span>
			</span>
			<span
				className={cn(
					"absolute right-2 top-2 grid size-5 place-items-center rounded-full border",
					selected
						? "border-accent bg-accent text-accent-foreground"
						: "border-md-outline bg-md-surface-container-low/80",
				)}
			>
				{selected ? <span className="size-2 rounded-full bg-current" /> : null}
			</span>
		</label>
	);
}

function DiceSkinSelector({
	value,
	onValueChange,
	className,
	disabled,
}: DiceSkinSelectorProps) {
	return (
		<fieldset className={cn("grid gap-2.5 sm:grid-cols-2", className)}>
			<legend className="sr-only">{t("diceSkin.selectorLabel")}</legend>
			{DICE_SKIN_OPTIONS.map((option) => (
				<DiceSkinOptionCard
					key={option.id}
					option={option}
					selected={option.id === value}
					disabled={disabled}
					onSelect={() => onValueChange(option.id)}
				/>
			))}
		</fieldset>
	);
}

export { DiceSkinSelector };
