import { cva, type VariantProps } from "class-variance-authority";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  "inline-flex shrink-0 items-center rounded-full border-2 outline-none transition-all duration-350 ease-expressive-fast-spatial focus-visible:ring-4 focus-visible:ring-focus-ring/50 data-checked:border-transparent data-checked:bg-accent data-unchecked:border-border data-unchecked:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-6 w-10",
        md: "h-8 w-[52px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

function Switch({
  className,
  size,
  ...props
}: Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, "size"> & VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-foreground-secondary transition-all duration-350 ease-expressive-fast-spatial data-checked:bg-accent-foreground",
          size === "sm"
            ? "size-3.5 translate-x-[3px] data-checked:size-4.5 data-checked:translate-x-[19px]"
            : "size-4 translate-x-[6px] data-checked:size-6 data-checked:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchVariants };
