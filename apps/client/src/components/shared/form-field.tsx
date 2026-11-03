import type * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = React.ComponentProps<"div"> & {
	label: React.ReactNode;
	htmlFor?: string;
	description?: React.ReactNode;
};

function FormField({
	label,
	htmlFor,
	description,
	className,
	children,
	...props
}: FormFieldProps) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)} {...props}>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{description ? (
				<p className="text-body-small text-foreground-tertiary">
					{description}
				</p>
			) : null}
		</div>
	);
}

export { FormField };
