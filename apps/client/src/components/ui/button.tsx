import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-sans whitespace-nowrap outline-none transition-all duration-350 ease-expressive-fast-spatial select-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:rounded-lg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground text-label-large-emph hover:bg-accent-hover",
        secondary: "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft-hover",
        accentSoft: "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft-hover",
        outline: "border border-border bg-transparent text-accent hover:bg-accent-soft/60",
        ghost: "text-accent hover:bg-accent-soft/60",
        danger: "bg-danger text-danger-foreground text-label-large-emph hover:bg-danger-hover",
        dangerSoft: "bg-danger-soft text-danger-soft-foreground hover:bg-danger-soft-hover",
        tertiary: "bg-default text-default-foreground hover:bg-default-hover",
      },
      size: {
        sm: "h-8 gap-1.5 px-4 text-label-large [&_svg]:size-3.5",
        md: "h-10 gap-2 px-6 text-label-large [&_svg]:size-4",
        lg: "h-12 gap-2 px-8 text-title-medium [&_svg]:size-[18px]",
        "icon-sm": "size-8 [&_svg]:size-3.5",
        "icon-md": "size-10 [&_svg]:size-4",
        "icon-lg": "size-12 [&_svg]:size-[18px]",
      },
    },
    compoundVariants: [
      {
        variant: "ghost",
        size: ["icon-sm", "icon-md", "icon-lg"],
        className: "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
      },
      {
        variant: "outline",
        size: ["icon-sm", "icon-md", "icon-lg"],
        className: "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
      },
    ],
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
