import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "border-field-border bg-field hover:border-field-border-hover focus-within:border-field-border-focus flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border px-3 transition-colors",
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
        "text-foreground-tertiary flex shrink-0 items-center justify-center [&_svg]:size-4",
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
        "h-auto flex-1 rounded-none border-0 bg-transparent px-0 py-0 hover:border-transparent focus-visible:border-transparent",
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
      className={cn("-mr-1 size-7 text-foreground-tertiary", className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton };
