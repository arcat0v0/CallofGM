import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = Omit<React.ComponentProps<"div">, "onChange"> & {
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  itemClassName?: string;
};

function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  className,
  itemClassName,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn("bg-default flex items-center gap-0.5 rounded-xl p-0.5", className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            variant="ghost"
            size="sm"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "h-7 flex-1 rounded-lg px-3 text-xs",
              selected
                ? "bg-segment text-foreground-segment shadow-tab hover:bg-segment font-semibold"
                : "text-foreground-secondary hover:bg-surface-hover font-medium",
              itemClassName,
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
export type { SegmentedOption };
