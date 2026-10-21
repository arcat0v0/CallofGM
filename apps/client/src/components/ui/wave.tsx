import { useId } from "react";
import { cn } from "@/lib/utils";

function Wave({
  playing = true,
  flat = false,
  className,
}: {
  playing?: boolean;
  flat?: boolean;
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      data-slot="wave"
      data-playing={playing}
      aria-hidden="true"
      className={cn("w-full", className)}
    >
      <defs>
        <pattern id={id} width="40" height="10" patternUnits="userSpaceOnUse">
          <path
            d={
              flat ? "M-40 5H80" : "M-40 5Q-30 -1 -20 5T0 5T20 5T40 5T60 5T80 5"
            }
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

export { Wave };
