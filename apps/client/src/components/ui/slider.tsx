import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";
import { Wave } from "@/components/ui/wave";
import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  size = "md",
  wavy = false,
  playing = true,
  orientation = "horizontal",
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  thumbLabels,
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "size"> & {
  size?: "sm" | "md";
  wavy?: boolean;
  playing?: boolean;
  thumbLabels?: string[];
}) {
  const values = value ?? defaultValue ?? [min];
  const thumbId = React.useId();
  const thumbs = React.useMemo(
    () =>
      Array.from({ length: values.length }, (_, position) => ({
        id: `${thumbId}-${position}`,
        position,
      })),
    [thumbId, values.length],
  );
  const [scrubbing, setScrubbing] = React.useState(false);
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-size={size}
      data-wave={wavy && orientation === "horizontal"}
      data-scrubbing={scrubbing}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      orientation={orientation}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-40",
        className,
      )}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) setScrubbing(true);
      }}
      onPointerUp={(event) => {
        setScrubbing(false);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        setScrubbing(false);
        onPointerCancel?.(event);
      }}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative w-full grow"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full"
        >
          {wavy && orientation === "horizontal" && (
            <Wave
              playing={playing && !scrubbing && !props.disabled}
              flat={scrubbing}
            />
          )}
        </SliderPrimitive.Range>
      </SliderPrimitive.Track>
      {thumbs.map(({ id, position }) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={id}
          aria-label={thumbLabels?.[position] ?? props["aria-label"]}
          className="block shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
