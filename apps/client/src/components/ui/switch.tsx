import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "focus-visible:ring-focus-ring/50 data-unchecked:bg-default data-checked:bg-accent inline-flex h-5 w-10 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="shadow-switch-thumb data-unchecked:bg-white data-checked:bg-accent-foreground pointer-events-none block h-4 w-[18px] rounded-full transition-transform data-checked:translate-x-[18px] data-unchecked:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
