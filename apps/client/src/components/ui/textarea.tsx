import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-field-border bg-field text-field-foreground placeholder:text-field-placeholder hover:border-field-border-hover focus-visible:border-field-border-focus flex min-h-20 w-full rounded-xl border px-3 py-2 font-sans text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
