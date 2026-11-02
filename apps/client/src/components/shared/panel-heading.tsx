import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function PanelHeading({
  title,
  description,
  size = "lg",
  actions,
  className,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  size?: "lg" | "sm";
  actions?: ReactNode;
  className?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className={cn(
            "text-md-on-surface font-serif",
            size === "lg" ? "text-headline-small font-semibold" : "text-title-medium-emph",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "text-md-on-surface-variant",
              size === "lg" ? "text-label-medium" : "text-label-small",
              descriptionClassName,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export { PanelHeading };
