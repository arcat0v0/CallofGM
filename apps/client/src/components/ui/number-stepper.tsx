import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const sizeStyles = {
	sm: {
		shell: "h-8 gap-0 px-0.5",
		button: "size-6",
		input: "text-label-large",
		icon: "size-3.5",
	},
	md: {
		shell: "h-11 gap-1 px-1.5",
		button: "size-8",
		input: "text-title-small",
		icon: "size-4",
	},
} as const;

export function NumberStepper({
	value,
	onValueChange,
	min,
	max,
	step = 1,
	disabled = false,
	label,
	id,
	size = "md",
	className,
}: {
	value: string;
	onValueChange: (text: string) => void;
	min: number;
	max: number;
	step?: number;
	disabled?: boolean;
	label: string;
	id?: string;
	size?: keyof typeof sizeStyles;
	className?: string;
}) {
	const styles = sizeStyles[size];
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
	const latest = useRef({ value, min, max, step });
	latest.current = { value, min, max, step };

	const stopHold = useCallback(() => {
		if (holdTimer.current !== null) {
			clearTimeout(holdTimer.current);
			holdTimer.current = null;
		}
		if (holdInterval.current !== null) {
			clearInterval(holdInterval.current);
			holdInterval.current = null;
		}
	}, []);

	useEffect(() => stopHold, [stopHold]);

	const nudge = useCallback(
		(direction: 1 | -1) => {
			const current = latest.current;
			const parsed = Number(current.value.trim());
			const base = Number.isFinite(parsed)
				? parsed
				: direction === 1
					? current.min
					: current.max;
			const next = Math.min(
				current.max,
				Math.max(current.min, Math.round(base + direction * current.step)),
			);
			onValueChange(String(next));
		},
		[onValueChange],
	);

	const startHold = useCallback(
		(direction: 1 | -1) => {
			stopHold();
			holdTimer.current = setTimeout(() => {
				holdInterval.current = setInterval(() => nudge(direction), 70);
			}, 420);
		},
		[nudge, stopHold],
	);

	const button = (direction: 1 | -1) => {
		const Icon = direction === 1 ? PlusIcon : MinusIcon;
		const actionLabel =
			direction === 1 ? `${label} +${step}` : `${label} -${step}`;
		return (
			<button
				type="button"
				aria-label={actionLabel}
				disabled={disabled}
				className={cn(
					styles.button,
					"text-md-on-surface-variant grid shrink-0 place-items-center rounded-full transition-[background-color,transform,color] duration-150 ease-standard-fast-effects hover:bg-md-on-surface/10 hover:text-md-on-surface active:scale-90 disabled:pointer-events-none disabled:opacity-40",
				)}
				onPointerDown={() => startHold(direction)}
				onPointerUp={stopHold}
				onPointerLeave={stopHold}
				onPointerCancel={stopHold}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						nudge(direction);
					}
				}}
				onClick={(event) => {
					if (event.detail !== 0) {
						nudge(direction);
					}
				}}
			>
				<Icon className={styles.icon} />
			</button>
		);
	};

	return (
		<div
			data-slot="number-stepper"
			className={cn(
				styles.shell,
				"border-field-border bg-field focus-within:border-field-border-focus focus-within:ring-focus-ring/35 flex w-full min-w-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects focus-within:ring-4",
				disabled && "opacity-60",
				className,
			)}
		>
			{button(-1)}
			<input
				id={id}
				type="text"
				role="spinbutton"
				inputMode="numeric"
				autoComplete="off"
				aria-label={label}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={
					Number.isFinite(Number(value.trim())) ? Number(value) : undefined
				}
				disabled={disabled}
				value={value}
				className={cn(
					styles.input,
					"text-md-on-surface min-w-0 flex-1 bg-transparent text-center font-mono tabular-nums outline-none placeholder:text-field-placeholder",
				)}
				onInput={(event) => {
					const next = event.currentTarget.value.replace(/[^\d.-]/g, "");
					onValueChange(next);
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowUp") {
						event.preventDefault();
						nudge(1);
					} else if (event.key === "ArrowDown") {
						event.preventDefault();
						nudge(-1);
					}
				}}
			/>
			{button(1)}
		</div>
	);
}
