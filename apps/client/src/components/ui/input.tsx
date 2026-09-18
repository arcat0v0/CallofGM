import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full min-w-0 rounded-t-xs rounded-b-none border-b-2 border-separator bg-field px-4 py-2 font-sans text-body-large text-field-foreground outline-none transition-all duration-150 ease-expressive-fast-effects placeholder:text-field-placeholder hover:bg-field-hover focus-visible:border-field-border-focus disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
