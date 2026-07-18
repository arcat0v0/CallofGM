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
        className={cn("bg-default relative w-full grow overflow-hidden rounded-full", size === "sm" ? "h-1" : "h-5")}
      >
        <SliderPrimitive.Range data-slot="slider-range" className="bg-accent absolute h-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "shadow-switch-thumb bg-white block shrink-0 rounded-full outline-none disabled:pointer-events-none",
            size === "sm" ? "size-3" : "h-5 w-[26px]",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
