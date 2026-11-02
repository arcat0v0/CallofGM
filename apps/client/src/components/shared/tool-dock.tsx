import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToolDock({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn("flex items-center gap-1 rounded-full backdrop-blur-xl", className)}
    >
      {children}
    </div>
  );
}

function ToolDockButton({
  icon: Icon,
  label,
  active,
  badge,
  showLabel = true,
  wideOnlyLabel = false,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
  showLabel?: boolean;
  wideOnlyLabel?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "ghost"}
      size="sm"
      aria-label={label}
      title={label}
      {...(active === undefined ? {} : { "aria-pressed": active })}
      className={cn(
        "relative gap-2 rounded-full text-label-medium transition-[background-color,color,border-radius] duration-200 ease-standard-fast-effects",
        showLabel ? "h-10 px-3.5" : "size-10 px-0",
        active
          ? "rounded-xl hover:bg-accent-hover"
          : "text-md-on-surface-variant hover:bg-md-on-surface/10 hover:text-md-on-surface",
        className,
      )}
      {...props}
    >
      <Icon className="size-4" />
      {showLabel ? (
        <span className={wideOnlyLabel ? "hidden min-[1440px]:inline" : undefined}>{label}</span>
      ) : null}
      {badge && badge > 0 ? (
        <span className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-label-small leading-none tabular-nums">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Button>
  );
}

export { ToolDock, ToolDockButton };
