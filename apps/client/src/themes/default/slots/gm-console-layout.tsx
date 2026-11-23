import type { GmConsoleLayoutCtx } from "@cogm/theme-sdk";
import { useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type MobilePane = "controls" | "chat" | "stage";

export function GmConsoleLayout({ nodes }: GmConsoleLayoutCtx) {
	const [mobilePane, setMobilePane] = useState<MobilePane>("chat");

	return (
		<div className="bg-background relative flex h-full w-full flex-col overflow-hidden lg:block">
			{nodes.connection}
			<div
				className={cn(
					"z-0 min-h-0 flex-1 lg:absolute lg:inset-0",
					mobilePane === "stage" ? "relative" : "max-lg:hidden",
				)}
			>
				{nodes.stage}
			</div>
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-44 bg-linear-to-b from-md-surface-container-lowest/92 via-md-surface-container-lowest/35 to-transparent lg:block" />
			<div className="relative z-30 shrink-0 px-3 pt-2 lg:absolute lg:inset-x-6 lg:top-5 lg:h-16 lg:px-0 lg:pt-0">
				{nodes.topbar}
			</div>
			<div className="z-20 shrink-0 px-3 pt-2 lg:hidden">
				<SegmentedControl
					value={mobilePane}
					options={[
						{ value: "controls", label: t("gm.workbench.mobileTabControls") },
						{ value: "chat", label: t("gm.workbench.mobileTabChat") },
						{ value: "stage", label: t("gm.workbench.mobileTabStage") },
					]}
					onValueChange={setMobilePane}
					aria-label={t("gm.workbench.mobileViewAria")}
					className="bg-md-surface-container-low/90 border-md-outline-variant/40 w-full border p-1"
					itemClassName="h-8 text-label-medium"
				/>
			</div>
			<div
				className={cn(
					"z-20 min-h-0 flex-1 overflow-y-auto px-3 pt-2 lg:overflow-visible lg:px-0 lg:pt-0 lg:absolute lg:top-26 lg:bottom-6 lg:left-6 lg:w-[clamp(248px,20vw,292px)] [&>*]:max-lg:h-auto",
					mobilePane === "controls" ? "flex flex-col pb-2" : "max-lg:hidden",
				)}
			>
				{nodes.controls}
			</div>
			<div
				className={cn(
					"z-20 min-h-0 flex-1 px-3 pt-2 lg:px-0 lg:pt-0 lg:absolute lg:top-26 lg:right-6 lg:bottom-6 lg:w-[clamp(248px,20vw,292px)]",
					mobilePane === "chat" ? "flex flex-col" : "max-lg:hidden",
				)}
			>
				{nodes.chat}
			</div>
			<div className="z-40 flex shrink-0 justify-center px-3 py-2 lg:absolute lg:top-5 lg:left-1/2 lg:-translate-x-1/2 lg:p-0 max-xl:lg:top-24">
				{nodes.dock}
			</div>
			{nodes.endedBanner}
			{nodes.overlays}
		</div>
	);
}
