import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-12 w-full min-w-0 items-center gap-2 rounded-t-xs rounded-b-none border-b-2 border-separator bg-field px-4 transition-all duration-150 ease-expressive-fast-effects hover:bg-field-hover focus-within:border-field-border-focus",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-addon"
      className={cn(
        "flex shrink-0 items-center justify-center text-foreground-tertiary [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-auto flex-1 rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent focus-visible:border-transparent",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="input-group-button"
      variant="ghost"
      size="icon-sm"
      className={cn("-mr-2 size-7 text-foreground-tertiary", className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton };
