import { cva, type VariantProps } from "class-variance-authority";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  "focus-visible:ring-focus-ring/50 data-unchecked:bg-default data-checked:bg-accent inline-flex shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-[18px] w-8",
        md: "h-5 w-10",
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
          "shadow-switch-thumb data-unchecked:bg-white data-checked:bg-accent-foreground pointer-events-none block rounded-full transition-transform data-unchecked:translate-x-0.5",
          size === "sm" ? "size-3.5 data-checked:translate-x-4" : "h-4 w-[18px] data-checked:translate-x-[18px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchVariants };
