import type { LucideIcon } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	icon: LucideIcon;
	title: string;
	description: string;
	cancelLabel?: string;
	confirmLabel: string;
	confirmIcon?: LucideIcon;
	variant?: "danger" | "warning";
	onConfirm: () => void;
};

function ConfirmDialog({
	open,
	onOpenChange,
	icon: Icon,
	title,
	description,
	cancelLabel = t("common.cancel"),
	confirmLabel,
	confirmIcon: ConfirmIcon,
	variant = "danger",
	onConfirm,
}: ConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-100 gap-0 p-0">
				<div className="flex flex-col items-center gap-3.5 px-6 pt-6 pb-5 text-center">
					<div
						className={cn(
							"flex size-13 items-center justify-center rounded-full",
							variant === "danger" ? "bg-danger-soft" : "bg-warning-soft",
						)}
					>
						<Icon
							className={cn(
								"size-6",
								variant === "danger" ? "text-danger" : "text-warning",
							)}
						/>
					</div>
					<AlertDialogTitle className="font-serif text-headline-small-emph">
						{title}
					</AlertDialogTitle>
					<AlertDialogDescription className="text-body-medium">
						{description}
					</AlertDialogDescription>
				</div>
				<div className="flex gap-2.5 px-6 pt-4 pb-6">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="h-11 flex-1"
					>
						{cancelLabel}
					</Button>
					<AlertDialogAction
						variant={variant === "danger" ? "danger" : "primary"}
						onClick={onConfirm}
						className={cn(
							"flex h-11 flex-1 items-center justify-center gap-2",
							variant === "warning" &&
								"bg-warning text-warning-foreground hover:bg-warning-hover",
						)}
					>
						{ConfirmIcon && <ConfirmIcon className="size-4" />}
						{confirmLabel}
					</AlertDialogAction>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export { ConfirmDialog };
