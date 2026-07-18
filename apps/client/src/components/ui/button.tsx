import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-3xl font-sans font-medium whitespace-nowrap outline-none transition-colors select-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
        primaryGradient: "from-accent to-accent-hover bg-linear-to-b text-accent-foreground hover:brightness-105",
        secondary: "bg-default text-accent hover:bg-default-hover",
        accentSoft: "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft-hover",
        outline: "border border-border text-foreground hover:bg-surface-hover",
        ghost: "text-foreground hover:bg-surface-hover",
        danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
        dangerSoft: "bg-danger-soft text-danger-soft-foreground hover:bg-danger-soft-hover",
        tertiary: "bg-default text-foreground hover:bg-default-hover",
      },
      size: {
        sm: "h-8 gap-[5px] px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 gap-2 px-4 text-sm [&_svg]:size-4",
        lg: "h-10 gap-2 px-5 text-base [&_svg]:size-[18px]",
        "icon-sm": "size-8 [&_svg]:size-3.5",
        "icon-md": "size-9 [&_svg]:size-4",
        "icon-lg": "size-10 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
