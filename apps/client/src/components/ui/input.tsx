import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-field-border bg-field text-field-foreground placeholder:text-field-placeholder hover:border-field-border-hover focus-visible:border-field-border-focus flex h-10 w-full min-w-0 rounded-xl border px-3 py-2 font-sans text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
