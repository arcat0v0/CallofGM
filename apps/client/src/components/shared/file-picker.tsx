import { Paperclip } from "lucide-react";
import { type ChangeEvent, type ComponentProps, useId } from "react";
import { cn } from "@/lib/utils";

function FilePicker({
	name,
	accept,
	label,
	value,
	disabled = false,
	onChange,
	className,
}: {
	name: string;
	accept: string;
	label: string;
	value: string;
	disabled?: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	className?: string;
} & Pick<ComponentProps<"input">, "aria-label">) {
	const id = useId();
	return (
		<label
			htmlFor={id}
			className={cn(
				"bg-field border-field-border text-field-foreground hover:bg-field-hover focus-within:border-field-border-focus focus-within:ring-focus-ring/35 flex h-10 min-w-0 max-w-60 cursor-pointer items-center gap-2 rounded-md border px-3.5 text-body-medium transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects focus-within:ring-4",
				disabled && "pointer-events-none opacity-60",
				className,
			)}
		>
			<Paperclip className="text-md-on-surface-variant size-4 shrink-0" />
			<span
				className={cn(
					"min-w-0 flex-1 truncate",
					value ? "text-field-foreground" : "text-field-placeholder",
				)}
			>
				{value || label}
			</span>
			<input
				id={id}
				name={name}
				type="file"
				accept={accept}
				disabled={disabled}
				className="sr-only"
				aria-label={label}
				onChange={onChange}
			/>
		</label>
	);
}

export { FilePicker };
