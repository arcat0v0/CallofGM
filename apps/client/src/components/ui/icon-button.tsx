import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function IconButton({
  selected,
  shape = "round",
  width = "default",
  variant = "tonal",
  size = "md",
  className,
  "aria-label": label,
  ...props
}: Omit<ComponentProps<typeof Button>, "size"> & {
  "aria-label": string;
  selected?: boolean;
  width?: "narrow" | "default" | "wide";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Button
      {...props}
      data-slot="icon-button"
      data-width={width}
      aria-label={label}
      aria-pressed={selected}
      size={size}
      shape={selected ? (shape === "round" ? "square" : "round") : shape}
      variant={selected ? "filled" : variant}
      className={cn("p-0", className)}
    />
  );
}

export { IconButton };
