import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-field-border bg-field px-3.5 py-2 font-sans text-body-medium text-field-foreground outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects placeholder:text-field-placeholder hover:border-field-border-hover hover:bg-field-hover focus-visible:border-field-border-focus focus-visible:ring-4 focus-visible:ring-focus-ring/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };