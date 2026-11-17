import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

const PAPER_VARS = {
	"--paper": "#e9dfc6",
	"--paper-2": "#dfd2b2",
	"--paper-edge": "#c9b98f",
	"--paper-ink": "#2b2620",
	"--paper-ink-2": "#5c5344",
	"--paper-ink-3": "#8a7d63",
	"--ink-olive": "#4d6420",
	"--ink-red": "#8e1f2a",
	"--ink-gold": "#8a6414",
	"--paper-line": "rgba(43,38,32,.16)",
	"--phase-ink": "#f1e6cb",
	"--phase-ink-2": "#cbbd9b",
	"--phase-olive": "#c7df8c",
} as CSSProperties;

const PAPER_SURFACE: CSSProperties = {
	backgroundImage: [
		"radial-gradient(120px 60px at 88% 12%, rgba(120,90,40,.14), transparent 70%)",
		"radial-gradient(90px 90px at 8% 88%, rgba(120,90,40,.10), transparent 70%)",
		"repeating-linear-gradient(0deg, transparent 0 26px, rgba(43,38,32,.045) 26px 27px)",
		"linear-gradient(155deg, var(--paper), var(--paper-2))",
	].join(","),
	borderRadius: "3px 14px 4px 12px / 12px 3px 14px 4px",
	boxShadow:
		"0 10px 28px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,250,235,.35)",
};

function PaperSheet({
	children,
	className,
	ref,
	...rest
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
	return (
		<div
			ref={ref}
			{...rest}
			className={cn(
				"relative w-full min-w-0 overflow-hidden border border-[var(--paper-edge)] px-4 py-3.5 text-[var(--paper-ink)]",
				className,
			)}
			style={{ ...PAPER_VARS, ...PAPER_SURFACE }}
		>
			<img
				src="/cthulhu/corner-ornament.svg"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute left-1 top-1 size-8 opacity-30"
			/>
			{children}
		</div>
	);
}

export { PAPER_VARS, PaperSheet };
