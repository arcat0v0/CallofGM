import type { GmConsoleLayoutCtx } from "@cogm/theme-sdk";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

type MobilePane = "controls" | "chat" | "stage";

export const DOCK_TOPBAR_CLEARANCE = 16;
export const MIN_TOPBAR_START_WIDTH = 160;
export const LG_BREAKPOINT = 1024;

export type DockPlacementInput = {
	containerWidth: number;
	topbarLeft: number;
	topbarWidth: number;
	dockWidth: number;
	endWidth: number;
	hasStart: boolean;
};

export type DockPlacement = {
	stacked: boolean | null;
	startMaxWidth: number | null;
};

const UNMEASURED_PLACEMENT: DockPlacement = {
	stacked: null,
	startMaxWidth: null,
};

/**
 * Decides whether the centered toolbar fits on row 1 between topbar clusters
 * with `DOCK_TOPBAR_CLEARANCE` on both sides, falling back to row 2 otherwise.
 * Below `LG_BREAKPOINT`, the dock renders in the mobile flex column instead of
 * overlaying the topbar, so no desktop collision check is needed.
 */
export function computeDockPlacement({
	containerWidth,
	topbarLeft,
	topbarWidth,
	dockWidth,
	endWidth,
	hasStart,
}: DockPlacementInput): DockPlacement {
	if (
		containerWidth < LG_BREAKPOINT ||
		containerWidth <= 0 ||
		topbarWidth <= 0 ||
		dockWidth <= 0
	) {
		return UNMEASURED_PLACEMENT;
	}
	const center = containerWidth / 2;
	const dockHalf = dockWidth / 2;
	const dockLeft = center - dockHalf;
	const dockRight = center + dockHalf;
	const endStart = topbarLeft + topbarWidth - endWidth;
	const availableStart = dockLeft - DOCK_TOPBAR_CLEARANCE - topbarLeft;

	const rightFits = dockRight + DOCK_TOPBAR_CLEARANCE <= endStart;
	const leftFits = !hasStart || availableStart >= MIN_TOPBAR_START_WIDTH;

	if (rightFits && leftFits) {
		return {
			stacked: false,
			startMaxWidth: hasStart ? Math.floor(availableStart) : null,
		};
	}

	return {
		stacked: true,
		startMaxWidth: null,
	};
}

function findTopbarRegions(topbarEl: HTMLElement): {
	startEl: HTMLElement | null;
	endEl: HTMLElement | null;
} {
	const markedStart = topbarEl.querySelector<HTMLElement>("[data-topbar-start]");
	const markedEnd = topbarEl.querySelector<HTMLElement>("[data-topbar-end]");
	if (markedStart || markedEnd) {
		return { startEl: markedStart, endEl: markedEnd };
	}
	const root = topbarEl.firstElementChild;
	if (!(root instanceof HTMLElement)) {
		return { startEl: null, endEl: null };
	}
	const children = Array.from(root.children).filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement && child.getBoundingClientRect().width > 0,
	);
	return {
		startEl: children[0] ?? null,
		endEl: children.length > 1 ? (children[children.length - 1] ?? null) : null,
	};
}

function findDockToolbar(dockEl: HTMLElement): HTMLElement | null {
	return (
		dockEl.querySelector<HTMLElement>('[role="toolbar"]') ??
		(dockEl.firstElementChild instanceof HTMLElement
			? dockEl.firstElementChild
			: null)
	);
}

export function GmConsoleLayout({ nodes }: GmConsoleLayoutCtx) {
	const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
	const containerRef = useRef<HTMLDivElement>(null);
	const topbarRef = useRef<HTMLDivElement>(null);
	const dockRef = useRef<HTMLDivElement>(null);
	const [placement, setPlacement] = useState<DockPlacement>(UNMEASURED_PLACEMENT);

	useLayoutEffect(() => {
		const containerEl = containerRef.current;
		const topbarEl = topbarRef.current;
		const dockEl = dockRef.current;
		if (!containerEl || !topbarEl || !dockEl) {
			return;
		}

		let resizeObserver: ResizeObserver | null = null;
		const observed = new Set<Element>();

		const syncObserved = () => {
			if (!resizeObserver) {
				return;
			}
			const targets = new Set<Element>([containerEl, topbarEl]);
			const { endEl } = findTopbarRegions(topbarEl);
			const toolbarEl = findDockToolbar(dockEl);
			if (endEl) {
				targets.add(endEl);
			}
			if (toolbarEl) {
				targets.add(toolbarEl);
			}
			for (const element of observed) {
				if (!targets.has(element)) {
					resizeObserver.unobserve(element);
					observed.delete(element);
				}
			}
			for (const element of targets) {
				if (!observed.has(element)) {
					resizeObserver.observe(element);
					observed.add(element);
				}
			}
		};

		const measure = () => {
			const containerRect = containerEl.getBoundingClientRect();
			const topbarRect = topbarEl.getBoundingClientRect();
			const { startEl, endEl } = findTopbarRegions(topbarEl);
			const toolbarEl = findDockToolbar(dockEl);
			const next = computeDockPlacement({
				containerWidth: containerRect.width,
				topbarLeft: topbarRect.left - containerRect.left,
				topbarWidth: topbarRect.width,
				dockWidth: toolbarEl ? toolbarEl.getBoundingClientRect().width : 0,
				endWidth: endEl ? endEl.getBoundingClientRect().width : 0,
				hasStart: Boolean(startEl),
			});
			setPlacement((prev) =>
				prev.stacked === next.stacked &&
				prev.startMaxWidth === next.startMaxWidth
					? prev
					: next,
			);
		};

		if (typeof ResizeObserver === "function") {
			resizeObserver = new ResizeObserver(() => {
				syncObserved();
				measure();
			});
		}

		let mutationObserver: MutationObserver | null = null;
		if (typeof MutationObserver === "function") {
			mutationObserver = new MutationObserver(() => {
				syncObserved();
				measure();
			});
			mutationObserver.observe(topbarEl, {
				childList: true,
				subtree: true,
			});
			mutationObserver.observe(dockEl, {
				childList: true,
				subtree: true,
			});
		}

		window.addEventListener("resize", measure);
		syncObserved();
		measure();

		return () => {
			window.removeEventListener("resize", measure);
			mutationObserver?.disconnect();
			resizeObserver?.disconnect();
		};
	}, [nodes.topbar, nodes.dock]);

	const layoutStyle =
		placement.stacked === null
			? undefined
			: ({
					"--gm-topbar-start-max":
						placement.startMaxWidth !== null
							? `${placement.startMaxWidth}px`
							: "none",
					"--gm-dock-panel-max-h": placement.stacked
						? "calc(100dvh - 176px)"
						: "calc(100dvh - 112px)",
				} as CSSProperties);

	return (
		<div
			ref={containerRef}
			data-dock-stacked={placement.stacked === true ? "true" : undefined}
			style={layoutStyle}
			className="bg-background relative flex h-full w-full flex-col overflow-hidden lg:block"
		>
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
			<div
				ref={topbarRef}
				className="relative z-30 shrink-0 px-3 pt-2 lg:absolute lg:inset-x-6 lg:top-5 lg:h-16 lg:px-0 lg:pt-0"
			>
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
			<div
				ref={dockRef}
				className={cn(
					"z-40 flex shrink-0 justify-center px-3 py-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:p-0",
					placement.stacked === true
						? "lg:top-24"
						: placement.stacked === false
							? "lg:top-5"
							: "lg:top-5 max-xl:lg:top-24",
				)}
			>
				{nodes.dock}
			</div>
			{nodes.endedBanner}
			{nodes.overlays}
		</div>
	);
}
