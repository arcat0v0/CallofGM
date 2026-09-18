import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  size = "md",
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "size"> & { size?: "sm" | "md" }) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      data-size={size}
      className={cn(
        "relative flex w-full touch-none items-center py-2 select-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative w-full grow overflow-hidden rounded-full bg-surface-tertiary",
          size === "sm" ? "h-2" : "h-4",
        )}
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block w-1 shrink-0 rounded-full bg-accent transition-all duration-350 ease-expressive-fast-spatial outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 active:w-[3px] disabled:pointer-events-none",
            size === "sm" ? "h-6" : "h-11",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
