import type { GmConsoleLayoutCtx } from "@cogm/theme-sdk";

export function GmConsoleLayout({ nodes }: GmConsoleLayoutCtx) {
	return (
		<div className="bg-background relative h-full w-full overflow-hidden">
			{nodes.connection}
			<div className="absolute inset-0 z-0">{nodes.stage}</div>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-44 bg-linear-to-b from-md-surface-container-lowest/92 via-md-surface-container-lowest/35 to-transparent" />
			<div className="absolute inset-x-6 top-5 z-30 h-16">{nodes.topbar}</div>
			<div className="absolute top-5 left-1/2 z-40 -translate-x-1/2 max-xl:top-24">
				{nodes.dock}
			</div>
			<div className="absolute top-26 bottom-6 left-6 z-20 w-[clamp(248px,20vw,292px)]">
				{nodes.controls}
			</div>
			<div className="absolute top-26 right-6 bottom-6 z-20 w-[clamp(248px,20vw,292px)]">
				{nodes.chat}
			</div>
			{nodes.endedBanner}
			{nodes.overlays}
		</div>
	);
}
