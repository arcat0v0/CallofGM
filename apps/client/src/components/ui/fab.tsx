import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function Fab({
  size = "md",
  tone = "primary",
  extended = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "size"> & {
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "secondary" | "tertiary";
  extended?: boolean;
}) {
  const sizes = {
    sm: "h-10 min-w-10 rounded-md [&_svg]:size-6",
    md: "h-14 min-w-14 rounded-lg [&_svg]:size-6",
    lg: "h-24 min-w-24 rounded-xl [&_svg]:size-9",
  };
  const tones = {
    primary: "bg-accent-soft text-accent-soft-foreground",
    secondary: "bg-md-secondary-container text-md-on-secondary-container",
    tertiary: "bg-md-tertiary-container text-md-on-tertiary-container",
  };
  return (
    <Button
      {...props}
      data-slot="fab"
      className={cn(
        sizes[size],
        tones[tone],
        extended ? "gap-3 px-5" : "p-0",
        "shadow-dialogue hover:shadow-modal",
        className,
      )}
    />
  );
}
function FabMenu({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Fab, FabMenu };
