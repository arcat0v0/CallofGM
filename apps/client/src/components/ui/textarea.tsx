import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-none rounded-md border border-field-border bg-field px-3.5 py-3 font-sans text-body-medium text-field-foreground outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects placeholder:text-field-placeholder hover:border-field-border-hover hover:bg-field-hover focus-visible:border-field-border-focus focus-visible:ring-4 focus-visible:ring-focus-ring/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };