import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = React.ComponentProps<typeof Card> & {
  icon: LucideIcon;
  value: React.ReactNode;
  label: React.ReactNode;
  iconClassName?: string;
  iconContainerClassName?: string;
};

function MetricCard({
  icon: Icon,
  value,
  label,
  iconClassName,
  iconContainerClassName,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card
      className={cn("border-separator flex-1 flex-row items-center gap-3 rounded-[14px] border", className)}
      {...props}
    >
      <span
        className={cn(
          "bg-default flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          iconContainerClassName,
        )}
      >
        <Icon className={cn("size-[17px]", iconClassName)} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground font-chip text-xl font-bold tabular-nums">{value}</span>
        <span className="text-foreground-secondary text-[11px]">{label}</span>
      </span>
    </Card>
  );
}

export { MetricCard };
