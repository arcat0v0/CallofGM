import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export function SheetSection({
	id,
	title,
	description,
	actions,
	children,
	className,
}: {
	id?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	const headingId = useId();
	return (
		<section
			id={id}
			aria-labelledby={headingId}
			className={cn(
				"flex flex-col gap-5 rounded-2xl bg-md-surface-container-low p-5 md:p-6",
				className,
			)}
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 flex-col gap-1.5">
					<h2
						id={headingId}
						className="font-sans text-title-large-emph text-foreground"
					>
						{title}
					</h2>
					{description ? (
						<p className="max-w-3xl text-body-medium text-foreground-secondary">
							{description}
						</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function NumericField({
	label,
	value,
	onChange,
	min,
	max,
	integer = true,
	nullable = false,
	showValidation = false,
	onErrorChange,
	hideLabel = false,
	className,
}: {
	label: string;
	value: number | null;
	onChange: (value: number | null) => void;
	min: number;
	max: number;
	integer?: boolean;
	nullable?: boolean;
	showValidation?: boolean;
	onErrorChange: (message: string | null) => void;
	hideLabel?: boolean;
	className?: string;
}) {
	const id = useId();
	const [text, setText] = useState(value === null ? "" : String(value));
	const [touched, setTouched] = useState(false);
	const errorRef = useRef(onErrorChange);
	errorRef.current = onErrorChange;
	const error = validateNumber(text, min, max, integer, nullable);

	useEffect(() => {
		setText((current) => {
			if (current.trim() !== "" && Number(current) === value) {
				return current;
			}
			return value === null ? "" : String(value);
		});
		errorRef.current(null);
	}, [value]);

	useEffect(() => () => errorRef.current(null), []);

	return (
		<div
			className={cn("flex min-w-0 flex-col gap-1.5", className)}
			data-invalid={Boolean(error)}
		>
			<Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
				{label}
			</Label>
			<NumberStepper
				id={id}
				value={text}
				label={label}
				min={min}
				max={max}
				step={integer ? 1 : 0.01}
				onValueChange={(next) => {
					setText(next);
					const nextError = validateNumber(next, min, max, integer, nullable);
					errorRef.current(nextError);
					if (!nextError) {
						onChange(next === "" ? null : Number(next));
					}
					setTouched(true);
				}}
			/>
			{error && (touched || showValidation) ? (
				<p id={`${id}-error`} className="text-body-small text-danger">
					{error}
				</p>
			) : null}
		</div>
	);
}

function validateNumber(
	raw: string,
	min: number,
	max: number,
	integer: boolean,
	nullable: boolean,
): string | null {
	if (raw.trim() === "") {
		return nullable
			? null
			: t(
					integer
						? "characterCreation.invalidIntegerRange"
						: "characterCreation.invalidNumberRange",
					{ min, max },
				);
	}
	const value = Number(raw);
	if (
		!Number.isFinite(value) ||
		(integer && !Number.isInteger(value)) ||
		value < min ||
		value > max
	) {
		return t(
			integer
				? "characterCreation.invalidIntegerRange"
				: "characterCreation.invalidNumberRange",
			{ min, max },
		);
	}
	return null;
}

export function TextField({
	label,
	value,
	onChange,
	required = false,
	multiline = false,
	showValidation = false,
	maxLength = 100,
	placeholder,
	className,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	multiline?: boolean;
	showValidation?: boolean;
	maxLength?: number;
	placeholder?: string;
	className?: string;
}) {
	const id = useId();
	const error =
		required && value.trim() === ""
			? t("characterCreation.requiredText")
			: null;
	return (
		<div
			className={cn("flex min-w-0 flex-col gap-1.5", className)}
			data-invalid={Boolean(error)}
		>
			<Label htmlFor={id}>{label}</Label>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					aria-label={label}
					aria-invalid={Boolean(error)}
					maxLength={maxLength}
					placeholder={placeholder}
					rows={3}
					onInput={(event) => onChange(event.currentTarget.value)}
				/>
			) : (
				<Input
					id={id}
					value={value}
					aria-label={label}
					aria-invalid={Boolean(error)}
					maxLength={maxLength}
					placeholder={placeholder}
					onInput={(event) => onChange(event.currentTarget.value)}
				/>
			)}
			{error && showValidation ? (
				<p className="text-body-small text-danger">{error}</p>
			) : null}
		</div>
	);
}

export function SelectField({
	label,
	value,
	options,
	onChange,
	placeholder,
	className,
}: {
	label: string;
	value: string;
	options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<Label>{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger aria-label={label}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent position="popper">
					{options.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							disabled={option.disabled}
						>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
