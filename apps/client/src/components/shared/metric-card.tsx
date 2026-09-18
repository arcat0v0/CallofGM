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
      className={cn("flex-1 flex-row items-center gap-3 rounded-lg border border-separator", className)}
      {...props}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md bg-default",
          iconContainerClassName,
        )}
      >
        <Icon className={cn("size-5", iconClassName)} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-sans text-headline-small-emph tabular-nums text-foreground">{value}</span>
        <span className="text-label-small text-foreground-secondary">{label}</span>
      </span>
    </Card>
  );
}

export { MetricCard };
