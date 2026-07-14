import { useId } from "react";
import type * as React from "react";

function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="CoGM" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7BA23F" />
          <stop offset="100%" stopColor="#86C166" />
        </linearGradient>
      </defs>
      <path d="M50 2l42 54-42 42-42-42z" fill={`url(#${gradientId})`} />
      <path d="M50 2l19 61-19 21-19-21z" fill="#FFFFFF2E" />
      <path
        d="M50 2l-19 61 19 21 19-21z m-42 54l23 7m61-7l-23 7m-38 0l19 35m19-35l-19 35m0-14l0 14"
        fill="none"
        stroke="#1C1C1CBF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { Logo };
