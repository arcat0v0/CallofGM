import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function ButtonGroup({ className, ...props }: ComponentProps<"fieldset">) {
	return (
		<fieldset
			data-slot="button-group"
			className={cn("items-center", className)}
			{...props}
		/>
	);
}
function SplitButton({
	children,
	menu,
	menuLabel = "更多操作",
	...props
}: ComponentProps<typeof Button> & { menu: ReactNode; menuLabel?: string }) {
	return (
		<ButtonGroup aria-label={menuLabel}>
			<Button {...props}>{children}</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						size={props.size}
						variant={props.variant}
						disabled={props.disabled}
						aria-label={menuLabel}
					>
						<ChevronDownIcon />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">{menu}</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}

export { ButtonGroup, SplitButton };
