import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

function List({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="list"
      className={cn(
        "flex flex-col gap-0.5 overflow-hidden rounded-xl bg-md-surface-container-low",
        className,
      )}
      {...props}
    />
  );
}
function ListItem({
  headline,
  supporting,
  leading,
  trailing,
  className,
  ...props
}: ComponentProps<"li"> & {
  headline: ReactNode;
  supporting?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li
      data-slot="list-item"
      className={cn(
        "flex min-h-16 items-center gap-4 bg-md-surface-container px-4 py-3",
        className,
      )}
      {...props}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="text-body-large">{headline}</div>
        {supporting && (
          <div className="mt-1 text-body-medium text-foreground-muted">
            {supporting}
          </div>
        )}
      </div>
      {trailing}
    </li>
  );
}

export { List, ListItem };
