import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  solid: {
    default: "bg-default text-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-danger text-danger-foreground",
  },
  soft: {
    default: "bg-default text-foreground",
    accent: "bg-accent-soft text-accent-soft-foreground",
    success: "bg-success-soft text-success-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
    danger: "bg-danger-soft text-danger-soft-foreground",
  },
  secondary: {
    default: "bg-default text-foreground",
    accent: "bg-default text-accent",
    success: "bg-default text-success",
    warning: "bg-default text-warning",
    danger: "bg-default text-danger",
  },
  tertiary: {
    default: "text-foreground",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  },
} as const;

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-0.5 rounded-2xl font-chip font-medium whitespace-nowrap",
  {
    variants: {
      size: {
        sm: "px-1 py-0.5 text-[11px]",
        md: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type BadgeTone = "default" | "accent" | "success" | "warning" | "danger";
type BadgeVariant = "solid" | "soft" | "secondary" | "tertiary";

function Badge({
  className,
  tone = "default",
  variant = "solid",
  size,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    tone?: BadgeTone;
    variant?: BadgeVariant;
  }) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      data-variant={variant}
      className={cn(badgeVariants({ size }), toneClasses[variant][tone], className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
