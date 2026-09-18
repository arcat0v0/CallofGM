import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-t-xs rounded-b-none border-b-2 border-separator bg-field px-4 py-3 font-sans text-body-large text-field-foreground outline-none transition-all duration-150 ease-expressive-fast-effects placeholder:text-field-placeholder hover:bg-field-hover focus-visible:border-field-border-focus disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
