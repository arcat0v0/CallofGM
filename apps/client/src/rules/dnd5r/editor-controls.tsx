import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";

export function DndSelectField({
	label,
	value,
	options,
	onChange,
	description,
	error,
	disabled = false,
}: {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
	description?: string;
	error?: string;
	disabled?: boolean;
}) {
	return (
		<Field data-invalid={Boolean(error)} data-disabled={disabled}>
			<FieldLabel>{label}</FieldLabel>
			<Select value={value} onValueChange={onChange} disabled={disabled}>
				<SelectTrigger aria-label={label} aria-invalid={Boolean(error)}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent position="popper">
					<SelectGroup>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError>{error}</FieldError>
		</Field>
	);
}

export function DndChoiceGrid({
	legend,
	description,
	options,
	selected,
	onToggle,
	disabled,
	badges,
}: {
	legend: string;
	description?: string;
	options: { value: string; label: string; detail?: string }[];
	selected: string[];
	onToggle: (value: string) => void;
	disabled?: (value: string) => boolean;
	badges?: (value: string) => string | null;
}) {
	return (
		<FieldSet>
			<FieldLegend>{legend}</FieldLegend>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldGroup className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{options.map((option) => {
					const checked = selected.includes(option.value);
					const isDisabled = disabled?.(option.value) ?? false;
					return (
						<Field
							key={option.value}
							orientation="horizontal"
							data-disabled={isDisabled}
							className="min-h-14 rounded-xl bg-md-surface-container px-3 py-2"
						>
							<Checkbox
								id={`choice-${legend}-${option.value}`}
								checked={checked}
								disabled={isDisabled}
								onCheckedChange={() => onToggle(option.value)}
							/>
							<FieldLabel
								htmlFor={`choice-${legend}-${option.value}`}
								className="min-w-0 flex-1 cursor-pointer"
							>
								<span className="flex min-w-0 flex-col">
									<span className="truncate">{option.label}</span>
									{option.detail ? (
										<span className="truncate text-body-small text-foreground-secondary">
											{option.detail}
										</span>
									) : null}
								</span>
								{badges?.(option.value) ? (
									<span className="ml-auto text-label-small text-accent">
										{badges(option.value)}
									</span>
								) : null}
							</FieldLabel>
						</Field>
					);
				})}
			</FieldGroup>
		</FieldSet>
	);
}

export function DndStringList({
	label,
	description,
	values,
	onChange,
	placeholder,
}: {
	label: string;
	description?: string;
	values: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
}) {
	const [value, setValue] = useState("");
	function add() {
		const next = value.trim();
		if (!next || values.includes(next)) {
			return;
		}
		onChange([...values, next]);
		setValue("");
	}
	return (
		<FieldSet>
			<FieldLegend>{label}</FieldLegend>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<div className="flex flex-wrap gap-2">
				{values.map((item) => (
					<Button
						key={item}
						type="button"
						variant="tertiary"
						size="sm"
						onClick={() => onChange(values.filter((value) => value !== item))}
						aria-label={t("dnd5r.list.remove", { name: item })}
					>
						{item}
						<X data-icon="inline-end" />
					</Button>
				))}
			</div>
			<div className="flex gap-2">
				<Input
					value={value}
					aria-label={label}
					placeholder={placeholder}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							add();
						}
					}}
				/>
				<Button
					type="button"
					variant="outline"
					disabled={!value.trim()}
					onClick={add}
				>
					<Plus data-icon="inline-start" />
					{t("dnd5r.list.add")}
				</Button>
			</div>
		</FieldSet>
	);
}

export function DndDerivedGrid({
	items,
}: {
	items: { label: string; value: string | number | null }[];
}) {
	return (
		<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-md-surface-container-high sm:grid-cols-3 lg:grid-cols-6">
			{items.map((item) => (
				<div
					key={item.label}
					className="flex flex-col gap-1 bg-md-surface-container px-3 py-3"
				>
					<dt className="text-label-small text-foreground-secondary">
						{item.label}
					</dt>
					<dd className="text-title-medium-emph tabular-nums text-foreground">
						{item.value ?? "—"}
					</dd>
				</div>
			))}
		</dl>
	);
}

export function namedRecordRows<T extends { name: string }>(items: T[]) {
	const counts = new Map<string, number>();
	return items.map((item, index) => {
		const occurrence = (counts.get(item.name) ?? 0) + 1;
		counts.set(item.name, occurrence);
		return { item, index, key: `${occurrence}:${item.name}` };
	});
}
