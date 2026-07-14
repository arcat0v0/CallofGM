import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  cancelLabel = "取消",
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
              variant === "danger" ? "bg-danger" : "bg-warning",
            )}
          >
            <Icon className={cn("size-6", variant === "danger" ? "text-danger-foreground" : "text-warning-foreground")} />
          </div>
          <AlertDialogTitle className="font-serif text-[19px] font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-[1.7]">{description}</AlertDialogDescription>
        </div>
        <div className="flex gap-2.5 px-6 pt-4 pb-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border-separator-secondary text-foreground flex h-[42px] flex-1 items-center justify-center rounded-full border font-sans text-sm font-semibold"
          >
            {cancelLabel}
          </button>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "flex h-[42px] flex-1 items-center justify-center gap-2 rounded-full font-sans text-sm font-semibold",
              variant === "danger"
                ? "bg-danger text-danger-foreground hover:bg-danger-hover"
                : "bg-warning text-warning-foreground hover:bg-warning-hover",
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
