import { cva, type VariantProps } from "class-variance-authority";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  "relative inline-flex shrink-0 items-center rounded-full p-0 outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:cursor-not-allowed",
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
  size = "md",
  ...props
}: Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, "size"> &
  VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute block rounded-full"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchVariants };
