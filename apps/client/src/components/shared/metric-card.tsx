import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type MetricTone = "primary" | "secondary" | "tertiary" | "error";

const TONE_CLASSES: Record<MetricTone, string> = {
  primary: "bg-md-primary-container text-md-on-primary-container",
  secondary: "bg-md-secondary-container text-md-on-secondary-container",
  tertiary: "bg-md-tertiary-container text-md-on-tertiary-container",
  error: "bg-md-error-container text-md-on-error-container",
};

type MetricCardProps = React.ComponentProps<"div"> & {
  icon: LucideIcon;
  value: React.ReactNode;
  label: React.ReactNode;
  tone?: MetricTone;
};

function MetricCard({ icon: Icon, value, label, tone = "primary", className, ...props }: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex h-28 min-w-0 flex-1 flex-col justify-between rounded-2xl p-4",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <Icon className="size-6" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-sans text-display-small-emph tabular-nums">{value}</span>
        <span className="text-title-small opacity-80">{label}</span>
      </span>
    </div>
  );
}

export { MetricCard };
